/**
 * Datos de demostración del módulo Operaciones (proyectos, tareas y eventos).
 *
 * Sirve para ver el tablero con contenido real: tareas en las tres columnas,
 * con prioridades, asignados y una vencida a propósito para comprobar que la
 * fecha se pinta en rojo. Los eventos hacen lo mismo con el calendario: sin
 * ellos, la rejilla del mes solo mostraría tareas.
 *
 * Idempotente: borra y vuelve a crear solo los registros que él mismo creó,
 * marcados con `metadata->>'demo' = 'true'`. No toca datos reales.
 *
 * Uso: npm run db:seed:operaciones
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

/**
 * Fecha relativa a hoy, en formato YYYY-MM-DD.
 *
 * Se arma con los componentes locales y no con `toISOString()`: en UTC-4, un
 * `toISOString()` ejecutado por la noche devuelve ya el día siguiente, y el
 * calendario colocaría las tareas un día corridas.
 */
function enDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const PROYECTOS = [
  {
    nombre: "Campaña de becas 2027",
    descripcion:
      "Captación de patrocinadores y asignación de becas para el próximo año lectivo.",
    responsable: "Marisol Peña",
    estado: "en_curso",
    inicio: enDias(-40),
    fin: enDias(60),
  },
  {
    nombre: "Habilitación del laboratorio de computación",
    descripcion: "Compra de equipos, instalación de red y puesta en marcha del aula.",
    responsable: "Carlos Reyes",
    estado: "en_curso",
    inicio: enDias(-15),
    fin: enDias(30),
  },
  {
    nombre: "Memoria anual de la Fundación",
    descripcion: "Informe de resultados y rendición de cuentas para los patrocinadores.",
    responsable: "Dauris Santana",
    estado: "planificacion",
    inicio: enDias(20),
    fin: enDias(90),
  },
];

const TAREAS = [
  // proyecto, título, estado, prioridad, días para la fecha límite, correos asignados
  [0, "Actualizar el listado de patrocinadores activos", "completada", "media", -20, ["coordinacion@globaleffect.org"]],
  [0, "Redactar la carta de renovación de aportes", "en_progreso", "alta", 5, ["coordinacion@globaleffect.org", "contabilidad@globaleffect.org"]],
  [0, "Revisar los expedientes de los 12 candidatos", "pendiente", "urgente", -2, ["habitudes@globaleffect.org", "coordinacion@globaleffect.org", "docente@globaleffect.org"]],
  [0, "Preparar el acto de entrega de becas", "pendiente", "baja", 45, []],
  [1, "Cotizar 20 equipos con tres proveedores", "completada", "alta", -10, ["contabilidad@globaleffect.org"]],
  [1, "Instalar el cableado de red del aula", "en_progreso", "media", 8, ["docente@globaleffect.org"]],
  [1, "Definir el plan de clases del curso técnico", "pendiente", "media", 21, ["docente@globaleffect.org"]],
  [2, "Recopilar las cifras de matrícula del año", "pendiente", "media", 25, ["coordinacion@globaleffect.org"]],
  [2, "Cerrar el balance contable anual", "pendiente", "alta", 30, ["contabilidad@globaleffect.org"]],
  [null, "Renovar el permiso de operación de la cocina", "pendiente", "urgente", 3, ["coordinacion@globaleffect.org"]],
];

/**
 * Eventos del calendario: tipo, título, días respecto a hoy, hora de inicio,
 * hora de fin, lugar y responsable. Reparte a un lado y otro de hoy para que
 * se vean a la vez el mes en curso y la agenda de 30 días.
 */
const EVENTOS = [
  ["reunion", "Reunión mensual del equipo", -6, "09:00", "11:00", "Sala de juntas", "Marisol Peña"],
  ["academico", "Entrega de calificaciones del bimestre", -1, "14:00", null, "Oficina académica", "Roberto Gómez"],
  ["social", "Jornada de servicio comunitario", 2, "08:00", "13:00", "Barrio Los Ríos, La Vega", "Marisol Peña"],
  ["administrativo", "Auditoría interna de inventario", 4, "10:00", "12:00", "Almacén", "Ana Santana"],
  ["reunion", "Comité de becas", 7, "15:00", "16:30", "Sala de juntas", "Dauris Santana"],
  ["academico", "Inicio del curso técnico de redes", 12, "08:00", null, "Laboratorio de computación", "Roberto Gómez"],
  ["social", "Encuentro con familias patrocinadas", 18, null, null, "Salón principal", "Laura Fermín"],
  ["administrativo", "Cierre contable del mes", 26, "16:00", null, null, "Ana Santana"],
  ["reunion", "Asamblea anual de la Fundación", 40, "18:00", "20:00", "Salón principal", "Dauris Santana"],
];

try {
  await db.query("BEGIN");

  // Limpia solo lo que creó este script en ejecuciones anteriores. Los eventos
  // van primero: los espejo de tareas caen con la tarea, y los de demo aquí.
  await db.query(`DELETE FROM evento WHERE metadata->>'demo' = 'true'`);
  await db.query(
    `DELETE FROM tarea WHERE metadata->>'demo' = 'true'
        OR proyecto_id IN (SELECT id FROM proyecto WHERE metadata->>'demo' = 'true')`,
  );
  await db.query(`DELETE FROM proyecto WHERE metadata->>'demo' = 'true'`);

  const idsProyecto = [];
  for (const p of PROYECTOS) {
    const { rows } = await db.query(
      `INSERT INTO proyecto (nombre, descripcion, responsable, estado, fecha_inicio, fecha_fin, progreso, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,0,'{"demo":"true"}'::jsonb) RETURNING id`,
      [p.nombre, p.descripcion, p.responsable, p.estado, p.inicio, p.fin],
    );
    idsProyecto.push(rows[0].id);
  }

  let nTareas = 0;
  for (const [idxProyecto, titulo, estado, prioridad, dias, correos] of TAREAS) {
    const { rows } = await db.query(
      `INSERT INTO tarea (titulo, proyecto_id, visibilidad, estado, prioridad, fecha_limite, metadata)
       VALUES ($1,$2,'todos',$3,$4,$5,'{"demo":"true"}'::jsonb) RETURNING id`,
      [
        titulo,
        idxProyecto === null ? null : idsProyecto[idxProyecto],
        estado,
        prioridad,
        enDias(dias),
      ],
    );
    const tareaId = rows[0].id;

    if (correos.length > 0) {
      await db.query(
        `INSERT INTO tarea_asignado (tarea_id, usuario_id)
         SELECT $1, id FROM usuario WHERE email = ANY($2::citext[])
         ON CONFLICT DO NOTHING`,
        [tareaId, correos],
      );
    }
    nTareas++;
  }

  let nEventos = 0;
  for (const [tipo, titulo, dias, inicio, fin, lugar, responsable] of EVENTOS) {
    await db.query(
      `INSERT INTO evento (titulo, tipo, fecha, hora_inicio, hora_fin, ubicacion, responsable, estado, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{"demo":"true"}'::jsonb)`,
      [
        titulo,
        tipo,
        enDias(dias),
        inicio,
        fin,
        lugar,
        responsable,
        // Lo que ya pasó se marca como completado; lo demás, programado.
        dias < 0 ? "completado" : "programado",
      ],
    );
    nEventos++;
  }

  await db.query("COMMIT");
  console.log(
    `✓ ${idsProyecto.length} proyectos, ${nTareas} tareas y ${nEventos} eventos de demostración`,
  );
} catch (e) {
  await db.query("ROLLBACK");
  console.error("! error sembrando operaciones:", e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
