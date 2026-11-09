/**
 * Datos de demostración completos: todos los roles y todos los estados.
 *
 * Los seeds anteriores dejaron un caso feliz por pantalla. Para ver cómo se
 * comporta el sistema hace falta además lo incómodo: una solicitud rechazada,
 * una rendición contabilizada, un viaje averiado, una inscripción reprobada,
 * un estudiante suspendido. Este script siembra al menos una fila por cada
 * valor de estado de cada entidad, y deja trabajo pendiente para cada uno de
 * los ocho roles (tareas, reuniones, notificaciones, chat).
 *
 * Idempotente: cada fila lleva un id derivado de una clave fija (`uid`), así
 * que correrlo dos veces actualiza en vez de duplicar. No borra nada ni toca
 * lo que sembraron los otros scripts. Las fechas son relativas a hoy para que
 * lo vencido y lo próximo lo sigan siendo.
 *
 * Requiere haber corrido antes db:seed:usuarios y db:seed:portales.
 *
 * Uso: npm run db:seed:demo
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

/** UUID estable a partir de una clave: la misma clave da siempre el mismo id. */
function uid(clave) {
  const h = createHash("md5").update(`ge-demo:${clave}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Fecha ISO (yyyy-mm-dd) desplazada `dias` respecto de hoy. */
function dia(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Instante ISO desplazado `dias` y `horas` respecto de ahora. */
function instante(dias, horas = 0) {
  return new Date(Date.now() + dias * 86_400_000 + horas * 3_600_000).toISOString();
}

/**
 * Inserta o actualiza una fila. `conflicto` son las columnas de la clave
 * única; con el resto se actualiza. Devuelve el número de filas tocadas (1).
 */
async function upsert(tabla, fila, conflicto = ["id"]) {
  const cols = Object.keys(fila);
  const vals = cols.map((c) => {
    const v = fila[c];
    return v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
      ? JSON.stringify(v)
      : v;
  });
  const marcas = cols.map((_, i) => `$${i + 1}`).join(", ");
  const resto = cols.filter((c) => !conflicto.includes(c));
  const accion = resto.length
    ? `DO UPDATE SET ${resto.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")}`
    : "DO NOTHING";
  await db.query(
    `INSERT INTO ${tabla} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${marcas})
     ON CONFLICT (${conflicto.map((c) => `"${c}"`).join(", ")}) ${accion}`,
    vals,
  );
}

const cuenta = {};
async function sembrar(tabla, filas, conflicto) {
  for (const f of filas) await upsert(tabla, f, conflicto);
  cuenta[tabla] = (cuenta[tabla] ?? 0) + filas.length;
}

// --- Referencias: usuarios y catálogos que ya existen -----------------------
const { rows: usuariosFila } = await db.query(
  `SELECT u.id, u.email, r.nombre AS rol FROM usuario u JOIN rol r ON r.id = u.rol_id`,
);
const U = Object.fromEntries(usuariosFila.map((u) => [u.email.split("@")[0], u.id]));
const faltan = ["admin", "coordinacion", "docente", "estudiante", "habitudes", "contabilidad", "chofer"]
  .concat("director.habitudes")
  .filter((k) => !U[k]);
if (faltan.length) {
  console.error(`Faltan usuarios: ${faltan.join(", ")}. Corre antes npm run db:seed:usuarios.`);
  process.exit(1);
}
const COORD = U.coordinacion;
const DOCENTE = U.docente;
const DIRHAB = U["director.habitudes"];

const una = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const PERIODO = (await una(`SELECT id FROM periodo WHERE estado = 'activo' ORDER BY fecha_inicio DESC LIMIT 1`)).id;
const MATERIAS360 = (await db.query(`SELECT id, nombre FROM materia_360 ORDER BY orden`)).rows;
const MATERIAS = (await db.query(`SELECT id FROM materia ORDER BY nombre`)).rows;
const LICEOS = (await db.query(`SELECT id FROM habitudes_liceo ORDER BY codigo`)).rows;
const HORARIOS = (await db.query(`SELECT id FROM transporte_horario ORDER BY hora_salida`)).rows;
const PARADAS = (await db.query(`SELECT id FROM transporte_parada ORDER BY orden`)).rows;
const DEPTOS = (await db.query(`SELECT id, nombre FROM departamento ORDER BY nombre`)).rows;
const YEIMY = (await una(`SELECT id FROM estudiante WHERE usuario_id = $1`, [U.estudiante]))?.id;

await db.query("BEGIN");
try {
  // ===== 1. Patrocinadores y estudiantes (los 8 estados) ====================
  const PATROCINADORES = [
    ["empresa", "Grupo Ramos Industrial", "activo", 18000, "DO"],
    ["persona", "Carlos Almánzar", "activo", 5000, "DO"],
    ["iglesia", "Iglesia Bautista Central La Vega", "activo", 7500, "DO"],
    ["ong", "Fundación Esperanza Dominicana", "pausado", 12000, "DO"],
    ["otro", "Club Rotario de La Vega", "inactivo", 4000, "DO"],
  ].map(([tipo, nombre, estado, monto, pais]) => ({
    id: uid(`pat:${nombre}`), nombre, tipo, estado, monto_mensual: monto, pais,
    email: `contacto@${nombre.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.org`,
    telefono: "809-555-01" + String(nombre.length).padStart(2, "0"),
  }));
  await sembrar("patrocinador", PATROCINADORES);

  // [nombre, estado, programa, cedula, género, nacimiento (años atrás)]
  const ESTUDIANTES = [
    ["Luis Miguel Peralta", "reclutado", "Ingeniería en Sistemas", "40200010011", "masculino", 18],
    ["Daniela Fernández", "postulado", "Administración de Empresas", "40200010022", "femenino", 19],
    ["Kelvin Tavárez", "academia_liderazgo", "Mercadeo", "40200010033", "masculino", 19],
    ["Rosa Elena Ureña", "standby_tecnico", "Enfermería", "40200010044", "femenino", 20],
    ["Joel Santos Reyes", "activo", "Derecho", "40200010055", "masculino", 21],
    ["Ashley Cabrera", "activo", "Psicología Clínica", "40200010066", "femenino", 20],
    ["Mariela Vargas", "activo", "Contabilidad", "40200010077", "femenino", 22],
    ["Pedro Antonio Disla", "inactivo", "Arquitectura", "40200010088", "masculino", 23],
    ["Génesis Mejía", "graduado", "Educación Básica", "40200010099", "femenino", 25],
    ["Ramón Alberto Núñez", "suspendido", "Ingeniería Civil", "40200010100", "masculino", 22],
    ["Yaritza Polanco", "activo", "Turismo", "40200010111", "femenino", 20],
    ["Frank Emmanuel Ortiz", "activo", "Informática", "40200010122", "masculino", 21],
  ].map(([nombre, estado, programa, cedula, genero, edad], i) => ({
    id: uid(`est:${cedula}`), nombre, estado, programa, cedula, genero, tipo: "becado",
    email: `${nombre.toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "").replace(/ /g, ".")}@correo.com`,
    telefono: `829-555-${String(1000 + i * 37).slice(0, 4)}`,
    fecha_nacimiento: dia(-365 * edad - 40 * i),
    nacionalidad: "Dominicana", lugar_nacimiento: "La Vega",
    universidad: ["UCATECI", "UASD", "PUCMM", "UTESA"][i % 4],
    fecha_ingreso: dia(-200 - i * 45),
    patrocinador_id: PATROCINADORES[i % PATROCINADORES.length].id,
    centro_educativo: "Liceo Secundario Don Pepe Álvarez",
  }));
  await sembrar("estudiante", ESTUDIANTES);
  const EST = ESTUDIANTES.map((e) => e.id);
  const ACTIVOS = ESTUDIANTES.filter((e) => e.estado === "activo").map((e) => e.id);
  if (YEIMY) ACTIVOS.unshift(YEIMY);

  await sembrar("perfil_salud", ESTUDIANTES.map((e, i) => ({
    estudiante_id: e.id,
    enfermedades: i % 4 === 0 ? "Asma leve" : "Ninguna",
    alergias: i % 3 === 0 ? "Penicilina" : "Ninguna",
    contacto_emergencia_nombre: "Madre o tutor de " + e.nombre.split(" ")[0],
    contacto_emergencia_telefono: "809-555-02" + String(i).padStart(2, "0"),
  })), ["estudiante_id"]);
  await sembrar("perfil_socioeconomico", ESTUDIANTES.map((e) => ({
    estudiante_id: e.id,
    historia_de_vida: "Creció en La Vega con apoyo de su familia extendida; destaca por su constancia.",
    situacion_familiar: "Hogar monoparental con tres hermanos.",
    situacion_economica: "Ingreso familiar por debajo del salario mínimo.",
    motivo_beca: "Sin la beca no podría costear la matrícula universitaria.",
    metas_academicas: "Graduarse con honores y retornar a servir a su comunidad.",
  })), ["estudiante_id"]);
  await sembrar("perfil_vivienda", ESTUDIANTES.map((e, i) => ({
    estudiante_id: e.id, con_quien_vive: i % 2 ? "Madre y hermanos" : "Abuela", casa_propia: i % 2 ? "no" : "si",
    tipo_casa: "Block y zinc", bano_dentro: i % 3 ? "si" : "no", habitaciones: 2 + (i % 3), camas: 2 + (i % 2),
    direccion: `Calle ${i + 1} #${10 + i}`, comunidad: ["Los Jardines", "Villa Progreso", "El Mamey"][i % 3],
    ciudad_residencia: "La Vega", pais_residencia: "República Dominicana", municipio: "La Vega",
    latitud: 19.2205 + i * 0.002, longitud: -70.5288 - i * 0.002,
  })), ["estudiante_id"]);
  const PARENTESCOS = ["madre", "padre", "tutor", "hermana", "otro"];
  await sembrar("familiar", ESTUDIANTES.slice(0, 8).flatMap((e, i) => [
    { id: uid(`fam:${e.id}:1`), estudiante_id: e.id, parentesco: PARENTESCOS[i % 5], nombre: `Familiar de ${e.nombre.split(" ")[0]}`, edad: 38 + i, telefono: "809-555-03" + i, profesion: "Comerciante" },
  ]));

  // Becas: una por estado de asignación.
  const ESTADOS_BECA = ["activo", "activo", "activo", "pausado", "finalizado", "suspendido"];
  await sembrar("asignacion_beca", ESTADOS_BECA.map((estado, i) => ({
    id: uid(`beca:${i}`), estudiante_id: ACTIVOS[i % ACTIVOS.length], patrocinador_id: PATROCINADORES[i % 5].id,
    monto: 3500 + i * 500, fecha_inicio: dia(-300 + i * 20), fecha_fin: estado === "finalizado" ? dia(-30) : dia(200), estado,
  })));

  // ===== 2. Académico: 360, matrícula, notas, servicio ======================
  await sembrar("periodo", [{
    id: uid("periodo:2025-III"), nombre: "2025-III", tipo: "cuatrimestre", estado: "cerrado",
    fecha_inicio: "2025-09-01", fecha_fin: "2025-12-20",
  }]);
  const PERIODO_CERRADO = uid("periodo:2025-III");

  // Docente asignado al catálogo de 360 donde no tenía a nadie.
  await db.query(`UPDATE materia_360 SET docente_id = $1 WHERE docente_id IS NULL`, [DOCENTE]);

  // Una inscripción por cada estado de 360 (una sola por tanda y estudiante).
  const ESTADOS_360 = ["prematriculada", "cursando", "aprobada", "reprobada", "retirada"];
  await sembrar("inscripcion_360", ESTADOS_360.flatMap((estado, i) => {
    const hecha = estado === "aprobada" || estado === "reprobada";
    return [{
      id: uid(`i360:${estado}`), estudiante_id: ACTIVOS[(i + 1) % ACTIVOS.length],
      materia_id: MATERIAS360[i % MATERIAS360.length].id,
      periodo_id: hecha ? PERIODO_CERRADO : PERIODO, estado,
      nota: estado === "aprobada" ? 91 : estado === "reprobada" ? 54 : null, ronda: 1,
    }];
  }));
  // Estudiantes cursando, con asistencia por sesión.
  const CURSANDO = ACTIVOS.slice(0, 5).map((estudiante_id, i) => ({
    id: uid(`i360:curso:${i}`), estudiante_id, materia_id: MATERIAS360[(i + 2) % MATERIAS360.length].id,
    periodo_id: PERIODO, estado: "cursando", nota: null, ronda: 2,
  }));
  await sembrar("inscripcion_360", CURSANDO);
  const sesiones = [];
  for (const m of MATERIAS360.slice(0, 3)) {
    for (const d of [-21, -14, -7, 7]) {
      sesiones.push({
        id: uid(`ses:${m.id}:${d}`), materia_360_id: m.id, periodo_id: PERIODO, fecha: dia(d),
        hora_inicio: "09:00", hora_fin: "11:00", creado_por: DOCENTE,
      });
    }
  }
  await sembrar("sesion_360", sesiones, ["materia_360_id", "periodo_id", "fecha"]);
  for (const s of sesiones.filter((x) => x.fecha < dia(0))) {
    for (const [k, insc] of CURSANDO.filter((c) => c.materia_id === s.materia_360_id).entries()) {
      await upsert("asistencia_360", {
        sesion_id: (await una(`SELECT id FROM sesion_360 WHERE materia_360_id=$1 AND periodo_id=$2 AND fecha=$3`, [s.materia_360_id, s.periodo_id, s.fecha])).id,
        inscripcion_id: insc.id, presente: (k + s.fecha.length) % 3 !== 0, marcado_por: DOCENTE, marcado_en: instante(-7),
      }, ["sesion_id", "inscripcion_id"]);
      cuenta.asistencia_360 = (cuenta.asistencia_360 ?? 0) + 1;
    }
  }

  // Matrícula del plan regular + historial con notas en todas las bandas.
  await sembrar("inscripcion", ACTIVOS.slice(0, 6).flatMap((estudiante_id, i) => MATERIAS.map((m, j) => ({
    id: uid(`insc:${i}:${j}`), estudiante_id, materia_id: m.id, periodo_id: PERIODO, estado: "activa",
  }))), ["estudiante_id", "materia_id", "periodo_id"]);
  const letra = (n) => (n >= 90 ? "A" : n >= 80 ? "B" : n >= 70 ? "C" : n >= 60 ? "D" : "F");
  await sembrar("historial_calificacion", ACTIVOS.slice(1, 7).flatMap((estudiante_id, i) =>
    [[95, "2025-II", "Liderazgo"], [84 - i * 3, "2025-II", "Inglés"], [72 - i * 4, "2025-III", "Ofimática"]].map(([n, cuat, materia], j) => ({
      id: uid(`hist:${i}:${j}`), estudiante_id, cuatrimestre: cuat, materia, nota_numerica: n, nota_letra: letra(n),
      gpa: Math.max(0, +((n - 50) / 12.5).toFixed(2)), estado: n >= 70 ? "aprobada" : "en_riesgo",
    }))));
  const meses = [0, 1, 2].map((k) => dia(-30 * k).slice(0, 7));
  await sembrar("registro_servicio", ACTIVOS.slice(1, 6).flatMap((estudiante_id, i) =>
    meses.map((mes, k) => ({
      id: uid(`serv:${i}:${k}`), estudiante_id, mes, hizo_servicio: (i + k) % 3 !== 0, asistio_reunion: (i + k) % 2 === 0,
      notas: (i + k) % 3 === 0 ? "No reportó horas de servicio comunitario." : "Apoyó en el comedor comunitario.",
    }))), ["estudiante_id", "mes"]);

  // Aula virtual: tareas con los cuatro estados de entrega.
  const ASIG = [
    ["Reflexión sobre liderazgo servicial", "tarea", -20, "calificado"],
    ["Ensayo: mi plan de vida", "tarea", -9, "entregado"],
    ["Ejercicio de Excel — presupuesto familiar", "tarea", -3, "tarde"],
    ["Presentación de emprendimiento", "tarea", 6, "pendiente"],
    ["Examen parcial de Inglés", "examen", 12, "pendiente"],
    ["Lectura: hábitos efectivos", "material", 2, null],
    ["Aviso: cierre de prematrícula", "anuncio", 4, null],
  ].map(([titulo, tipo, venc, estadoEntrega], i) => ({
    a: {
      id: uid(`asig:${i}`), materia_id: MATERIAS[i % MATERIAS.length]?.id, titulo, tipo,
      descripcion: `Material de la clase: ${titulo}.`, fecha_publicacion: instante(venc - 10),
      fecha_vencimiento: instante(venc), creada_por_id: DOCENTE, puntaje_maximo: 100,
      permite_entregas_tardias: true, periodo_id: PERIODO, peso: 10,
    },
    estadoEntrega, i,
  }));
  await sembrar("asignacion", ASIG.map((x) => x.a));
  for (const { a, estadoEntrega, i } of ASIG.filter((x) => x.estadoEntrega)) {
    for (const [k, estudiante_id] of ACTIVOS.slice(0, 5).entries()) {
      const calificada = estadoEntrega === "calificado";
      await upsert("entrega_estudiante", {
        id: uid(`ent:${i}:${k}`), asignacion_id: a.id, estudiante_id,
        estado: estadoEntrega === "pendiente" && k < 2 ? "pendiente" : estadoEntrega,
        fecha_entrega: estadoEntrega === "pendiente" ? null : instante(-5 - k),
        calificacion: calificada ? 78 + k * 4 : null,
        comentario_profesor: calificada ? "Buen trabajo, desarrolla más tus ejemplos." : null,
        revisada_por_id: calificada ? DOCENTE : null, revisada_en: calificada ? instante(-3) : null,
        texto_respuesta: estadoEntrega === "pendiente" ? null : "Adjunto mi respuesta al ejercicio solicitado.",
      });
      cuenta.entrega_estudiante = (cuenta.entrega_estudiante ?? 0) + 1;
    }
  }
  await sembrar("ventana_prematricula", [
    { id: uid("vp:cerrada"), periodo_id: PERIODO_CERRADO, abre: instante(-120), cierra: instante(-100), mensaje: "Prematrícula del cuatrimestre anterior.", activa: false, ronda: 1 },
    { id: uid("vp:abierta"), periodo_id: PERIODO, abre: instante(-2), cierra: instante(10), mensaje: "Elige tu materia de Global Effect 360.", activa: true, ronda: 2 },
  ]);

  // ===== 3. Solicitudes y gastos (todos los estados) ========================
  const SOLIC = [
    ["constancia", "enviada", "Constancia de estudios para el banco", null, false],
    ["carta", "en_revision", "Carta de recomendación para pasantía", null, false],
    ["beca", "pendiente_direccion", "Renovación de beca 2027", 3500, true],
    ["permiso", "aprobada", "Permiso para taller del sábado", null, false],
    ["gasto", "rechazada", "Reembolso de materiales de impresión", 1850, false],
    ["alta_expediente", "completada", "Alta de expediente — nuevo ingreso", null, false],
    ["cita_administracion", "cancelada", "Cita para revisar apoyo de transporte", null, false],
    ["compra", "en_revision", "Compra de 10 sillas para el aula 2", 24500, true],
    ["otro", "aprobada", "Uso del salón para reunión de padres", null, false],
  ];
  for (const [i, [tipo, estado, titulo, monto, direccion]] of SOLIC.entries()) {
    const id = uid(`sol:${i}`);
    await upsert("solicitud", {
      id, tipo, estado, titulo, detalle: `${titulo}. Solicitud de demostración con detalle suficiente para revisarla.`,
      solicitante_id: i % 2 ? U.estudiante : U.docente, estudiante_id: ["beca", "alta_expediente"].includes(tipo) ? ACTIVOS[i % ACTIVOS.length] : null,
      monto, fecha_requerida: dia(3 + i), requiere_direccion: direccion, responsable_id: estado === "enviada" ? null : COORD,
      respuesta: ["aprobada", "rechazada", "completada"].includes(estado) ? (estado === "rechazada" ? "No cumple con el soporte requerido: falta la factura con NCF." : "Atendida por coordinación.") : null,
      resuelta_en: ["aprobada", "rechazada", "completada", "cancelada"].includes(estado) ? instante(-1) : null,
    });
    const camino = { enviada: [], en_revision: ["en_revision"], pendiente_direccion: ["en_revision", "pendiente_direccion"], aprobada: ["en_revision", "aprobada"], rechazada: ["en_revision", "rechazada"], completada: ["en_revision", "aprobada", "completada"], cancelada: ["cancelada"] }[estado];
    let previo = "enviada";
    await upsert("solicitud_paso", { id: uid(`solp:${i}:0`), solicitud_id: id, estado_anterior: null, estado_nuevo: "enviada", comentario: null, usuario_id: i % 2 ? U.estudiante : U.docente });
    for (const [k, nuevo] of camino.entries()) {
      await upsert("solicitud_paso", {
        id: uid(`solp:${i}:${k + 1}`), solicitud_id: id, estado_anterior: previo, estado_nuevo: nuevo,
        comentario: nuevo === "rechazada" ? "Falta comprobante fiscal." : null, usuario_id: nuevo === "aprobada" && direccion ? U.admin : COORD,
      });
      previo = nuevo;
    }
    cuenta.solicitud = (cuenta.solicitud ?? 0) + 1;
  }

  const RENDICIONES = [
    ["enviada", "Ferretería Vega Real", 3250, "Materiales de mantenimiento del aula"],
    ["en_revision", "Supermercado La Cadena", 6890, "Compra de refrigerios para taller Habitudes"],
    ["aprobada", "Estación Sunix La Vega", 2400, "Combustible para viaje a liceos"],
    ["rechazada", "Papelería Central", 1280, "Útiles de oficina sin comprobante legible"],
    ["contabilizada", "Editora Listín Diario", 4100, "Publicación de convocatoria de becas"],
  ];
  await sembrar("rendicion_gasto", RENDICIONES.map(([estado, proveedor, monto, concepto], i) => ({
    id: uid(`rend:${estado}`), codigo: `RG-DEMO-${String(i + 1).padStart(3, "0")}`,
    empleado_id: [U.habitudes, U.chofer, U.docente, U.habitudes, U.chofer][i], proveedor_nombre: proveedor,
    proveedor_rnc: `1310${i}8765${i}`, ncf: `B01000000${i + 10}`, fecha_comprobante: dia(-3 - i), moneda: "DOP",
    monto_total: monto, monto_itbis: +(monto * 0.18 / 1.18).toFixed(2), concepto, estado,
    motivo_rechazo: estado === "rechazada" ? "El comprobante no es legible; súbelo de nuevo." : null,
    revisado_por: ["aprobada", "rechazada", "contabilizada"].includes(estado) ? U.contabilidad : null,
    revisado_en: ["aprobada", "rechazada", "contabilizada"].includes(estado) ? instante(-1) : null,
  })));

  // ===== 4. Proyectos, tareas, bitácora, reuniones, eventos ==================
  const PROYECTOS = [
    ["Jornada de salud comunitaria", "planificacion", 5], ["Torneo interescolar de debate", "en_curso", 45],
    ["Remodelación del aula 3", "pausado", 30], ["Graduación 2026", "completado", 100], ["Campaña de becas 2027", "cancelado", 10],
  ].map(([nombre, estado, progreso], i) => ({
    id: uid(`proy:${i}`), nombre, descripcion: `Proyecto institucional: ${nombre}.`, estado, progreso,
    responsable: "Marisol Peña", responsable_id: COORD, fecha_inicio: dia(-90 + i * 10), fecha_fin: dia(60 - i * 15),
  }));
  await sembrar("proyecto", PROYECTOS);
  const ROLES_PROY = ["admin", "docente", "contabilidad", "habitudes", "dir_habitudes", "chofer"];
  const CORREO = { admin: U.coordinacion, docente: DOCENTE, contabilidad: U.contabilidad, habitudes: U.habitudes, dir_habitudes: DIRHAB, chofer: U.chofer };
  await sembrar("proyecto_miembro", PROYECTOS.flatMap((p) => Object.values(CORREO).map((usuario_id) => ({ proyecto_id: p.id, usuario_id, asignado_por: COORD }))), ["proyecto_id", "usuario_id"]);
  await sembrar("proyecto_hito", PROYECTOS.slice(0, 4).flatMap((p, i) => [
    { id: uid(`hito:${i}:a`), proyecto_id: p.id, nombre: "Aprobación del presupuesto", fecha: dia(-20), alcanzado: true },
    { id: uid(`hito:${i}:b`), proyecto_id: p.id, nombre: "Ejecución de la actividad central", fecha: dia(15 + i * 7), alcanzado: false },
  ]));

  const TAREAS = [];
  const ESTADOS_TAREA = ["por_hacer", "en_progreso", "en_revision", "completada", "cancelada"];
  const PRIORIDADES = ["baja", "media", "alta", "urgente"];
  const TITULOS = {
    admin: "Conciliar lista de becados con patrocinadores", docente: "Corregir ensayos de liderazgo",
    contabilidad: "Cerrar conciliación bancaria del mes", habitudes: "Preparar taller de hábitos para liceo",
    dir_habitudes: "Revisar evidencias de visitas de la semana", chofer: "Revisión mecánica de la guagua",
  };
  let n = 0;
  for (const [rol, usuario_id] of Object.entries(CORREO)) {
    for (const [e, estado] of ESTADOS_TAREA.entries()) {
      TAREAS.push({
        id: uid(`tar:${rol}:${estado}`), titulo: `${TITULOS[rol]} (${estado.replace("_", " ")})`,
        descripcion: "Tarea de demostración con descripción para probar el detalle y los comentarios.",
        proyecto_id: PROYECTOS[n % 5].id, visibilidad: "asignados", estado, prioridad: PRIORIDADES[(n + e) % 4],
        fecha_limite: dia(estado === "completada" || estado === "cancelada" ? -4 : (e === 0 && n % 2 ? -2 : 3 + n % 9)),
        progreso: { por_hacer: 0, en_progreso: 40, en_revision: 85, completada: 100, cancelada: 20 }[estado],
        horas_estimadas: 2 + e, horas_reales: estado === "por_hacer" ? 0 : 1 + e, es_hito: false, _usuario: usuario_id,
      });
      n++;
    }
  }
  await sembrar("tarea", TAREAS.map(({ _usuario, ...t }) => t));
  await sembrar("tarea_asignado", TAREAS.map((t) => ({ tarea_id: t.id, usuario_id: t._usuario })), ["tarea_id", "usuario_id"]);
  await sembrar("tarea_comentario", TAREAS.filter((_, i) => i % 3 === 0).map((t, i) => ({
    id: uid(`com:${t.id}`), tarea_id: t.id, usuario_id: i % 2 ? COORD : t._usuario,
    texto: i % 2 ? "Por favor adjunta el soporte antes del viernes." : "Avancé con lo principal; me falta validarlo con dirección.",
  })));
  await sembrar("colaborador_bitacora_diaria", Object.values(CORREO).flatMap((usuario_id, i) => [0, -1, -2].map((d) => ({
    id: uid(`bit:${i}:${d}`), usuario_id, fecha: dia(d), descripcion: "Seguimiento de actividades del día y coordinación con el equipo.",
    tarea_id: TAREAS[i * 5 + 1].id, minutos_dedicados: 90 + i * 15,
  }))));

  const REUNIONES = [
    ["coordinacion", "virtual", "programada", 2], ["seguimiento_estudiante", "presencial", "en_curso", 0],
    ["departamental", "hibrida", "realizada", -6], ["direccion", "presencial", "cancelada", -2],
    ["tutoria", "virtual", "reprogramada", 5], ["general", "presencial", "programada", 9],
  ];
  for (const [i, [tipo, modalidad, estado, d]] of REUNIONES.entries()) {
    const id = uid(`reu:${i}`);
    await upsert("reunion", {
      id, titulo: `Reunión ${tipo.replace("_", " ")} — ${estado}`, descripcion: "Agenda de demostración.", tipo, modalidad,
      lugar_o_enlace: modalidad === "virtual" ? "https://meet.google.com/abc-defg-hij" : "Sala de juntas, sede La Vega",
      fecha: dia(d), hora_inicio: "10:00", hora_fin: "11:00", organizador_usuario_id: COORD,
      estudiante_id: tipo === "seguimiento_estudiante" || tipo === "tutoria" ? ACTIVOS[1] : null, estado,
      conclusiones_o_minuta: estado === "realizada" ? "Se acordó reforzar el seguimiento mensual y revisar asistencia a servicio." : null,
    });
    const asist = ["confirmada", "pendiente", "justificada", "asistio", "ausente"];
    await upsert("reunion_participante", { id: uid(`reup:${i}:0`), reunion_id: id, usuario_id: COORD, rol_en_reunion: "anfitrion", asistencia: "confirmada" });
    for (const [k, u] of [DOCENTE, U.habitudes, U.contabilidad, DIRHAB].entries()) {
      await upsert("reunion_participante", { id: uid(`reup:${i}:${k + 1}`), reunion_id: id, usuario_id: u, rol_en_reunion: ["participante", "secretario", "invitado", "participante"][k], asistencia: asist[(i + k) % 5] });
    }
    cuenta.reunion = (cuenta.reunion ?? 0) + 1;
  }
  await sembrar("evento", [
    ["Taller de oratoria", "academico", 4, "programado"], ["Convivio de fin de año", "social", 25, "programado"],
    ["Cierre contable de octubre", "administrativo", -3, "completado"], ["Visita de patrocinadores", "reunion", 14, "programado"],
    ["Feria vocacional", "academico", -10, "completado"], ["Jornada de limpieza comunitaria", "social", 1, "programado"],
  ].map(([titulo, tipo, d, estado], i) => ({
    id: uid(`evt:${i}`), titulo, tipo, fecha: dia(d), hora_inicio: "09:00", hora_fin: "12:00", ubicacion: "Sede La Vega",
    responsable: "Marisol Peña", estado, descripcion: `Evento de demostración: ${titulo}.`,
  })));

  // ===== 5. Transporte (viaje en cada estado + incidencias) =================
  const ESTADOS_VIAJE = ["programado", "en_curso", "completado", "averiado", "cancelado"];
  const VIAJES = ESTADOS_VIAJE.map((estado, i) => ({
    id: uid(`via:${estado}`), horario_id: HORARIOS[i % HORARIOS.length].id, chofer_id: U.chofer,
    fecha: estado === "programado" ? dia(1) : estado === "cancelado" ? dia(-2) : estado === "completado" ? dia(-1 - i) : dia(0),
    estado,
    iniciado_en: ["en_curso", "completado", "averiado"].includes(estado) ? instante(0, -3 - i) : null,
    finalizado_en: estado === "completado" ? instante(0, -1 - i) : null,
    lat_actual: ["en_curso", "averiado"].includes(estado) ? 19.2205 + i * 0.003 : null,
    lng_actual: ["en_curso", "averiado"].includes(estado) ? -70.5288 - i * 0.003 : null,
    velocidad_kmh: estado === "en_curso" ? 38 : null, parada_actual_id: PARADAS[i % PARADAS.length]?.id,
  }));
  // Un solo viaje activo por chofer a la vez: se revisa antes de sembrar.
  await db.query(`UPDATE transporte_viaje SET estado = 'completado', finalizado_en = now() WHERE chofer_id = $1 AND estado = 'en_curso' AND id <> $2`, [U.chofer, uid("via:en_curso")]).catch(() => {});
  await sembrar("transporte_viaje", VIAJES);
  const TIPOS_INC = ["averia_mecanica", "transito_pesado", "desvio_ruta", "accidente", "otro"];
  await sembrar("transporte_incidencia", TIPOS_INC.map((tipo, i) => ({
    id: uid(`inc:${tipo}`), viaje_id: VIAJES[(i + 2) % 5].id, chofer_id: U.chofer, tipo,
    descripcion: { averia_mecanica: "Se recalentó el motor en la subida de Jarabacoa.", transito_pesado: "Tapón de 25 minutos en la circunvalación.", desvio_ruta: "Calle cerrada por obras; se tomó la ruta alterna.", accidente: "Roce leve con otro vehículo sin heridos.", otro: "Pasajero se sintió mal; se detuvo la marcha 10 minutos." }[tipo],
    lat: 19.22 + i * 0.004, lng: -70.53 - i * 0.004,
  })));
  await sembrar("transporte_inscripcion_recurrente", ACTIVOS.slice(0, 5).map((estudiante_id, i) => ({
    id: uid(`tir:${i}`), estudiante_id, horario_id: HORARIOS[i % HORARIOS.length].id, dia_semana: (i % 5) + 1,
    parada_abordaje_id: PARADAS[0].id, parada_destino_id: PARADAS[PARADAS.length - 1].id, activo: i !== 4,
  })));
  await sembrar("transporte_inscripcion_diaria", ACTIVOS.slice(0, 6).map((estudiante_id, i) => ({
    id: uid(`tid:${i}`), fecha: dia(i < 3 ? 0 : -1), horario_id: HORARIOS[i % HORARIOS.length].id, estudiante_id,
    nombre_beneficiario: ESTUDIANTES[i]?.nombre ?? "Yeimy Rodríguez", parada_abordaje_id: PARADAS[0].id,
    parada_destino_id: PARADAS[PARADAS.length - 1].id, presente: i % 3 !== 2, inscrito_por: COORD,
  })));

  // ===== 6. Habitudes: liceos, profesores, visitas en cada estado ===========
  await sembrar("habitudes_liceo_estudiante", EST.slice(0, 8).map((estudiante_id, i) => ({
    id: uid(`hle:${i}`), liceo_id: LICEOS[i % LICEOS.length].id, estudiante_id, grado: `${4 + (i % 3)}to`, seccion: "AB"[i % 2],
    activo: i !== 7, registrado_por: U.habitudes,
  })), ["liceo_id", "estudiante_id"]);
  const ESTADOS_VISITA = ["borrador", "completada", "auditada"];
  await sembrar("habitudes_visita_evidencia", LICEOS.flatMap((l, i) => ESTADOS_VISITA.slice(0, i % 3 + 1).map((estado, k) => ({
    id: uid(`vis:${i}:${k}`), liceo_id: l.id, facilitador_id: U.habitudes, fecha_visita: dia(-5 * (i + k) - 1),
    tema_impartido: ["Proyecto de vida", "Manejo de emociones", "Trabajo en equipo", "Orientación vocacional"][(i + k) % 4],
    tanda: ["matutina", "vespertina"][k % 2], estudiantes_impactados: 25 + i * 3 + k * 5,
    observaciones: estado === "borrador" ? null : "Excelente participación; el grupo pidió una segunda sesión.", estado,
    latitud: 19.22 + i * 0.004, longitud: -70.53 - i * 0.004,
  }))));

  // ===== 7. Inventario: estados que faltaban + historial ====================
  const INV = [
    ["GE-INV-DEMO-01", "Proyector Epson X49", "tecnologia", "prestado", "Salón multiuso", 18500],
    ["GE-INV-DEMO-02", "Archivador metálico 4 gavetas", "mobiliario", "baja", "Depósito", 6200],
    ["GE-INV-DEMO-03", "Guagua Toyota Coaster 2018", "vehiculos", "operativo", "Parqueo principal", 2450000],
    ["GE-INV-DEMO-04", "Nevera Whirlpool", "electrodomesticos", "mantenimiento", "Cocina", 21000],
    ["GE-INV-DEMO-05", "Taladro inalámbrico Bosch", "herramientas", "operativo", "Almacén", 7400],
    ["GE-INV-DEMO-06", "Kit de bocinas portátiles", "otros", "prestado", "Dirección", 9800],
  ];
  await sembrar("inventario_activo", INV.map(([codigo, nombre, categoria, estado, ubicacion, valor], i) => ({
    id: uid(`inv:${codigo}`), codigo, nombre, categoria, estado, ubicacion, codigo_qr: `GE-QR-${codigo}`, valor_estimado: valor,
    responsable_id: [DOCENTE, U.habitudes, U.chofer, U.contabilidad, COORD, DIRHAB][i], creado_por: COORD,
    marca_modelo: nombre.split(" ").slice(-2).join(" "), numero_serie: `SN-${7000 + i}`, notas: "Registrado en la auditoría de demostración.",
  })));
  await sembrar("inventario_historial", INV.flatMap(([codigo, , , estado, ubicacion], i) => [
    { id: uid(`invh:${codigo}:0`), activo_id: uid(`inv:${codigo}`), usuario_id: COORD, accion: "creacion", ubicacion_nueva: ubicacion, estado_nuevo: "operativo", notas: "Alta en inventario." },
    ...(estado !== "operativo" ? [{ id: uid(`invh:${codigo}:1`), activo_id: uid(`inv:${codigo}`), usuario_id: COORD, accion: "cambio_estado", estado_anterior: "operativo", estado_nuevo: estado, notas: `Pasó a ${estado}.` }] : []),
  ]));

  // ===== 8. Comunicación: chat, notificaciones, correo, asistente IA =========
  const CANALES = [
    ["grupo", "Equipo de coordinación", null], ["departamento", "Contabilidad y Finanzas", DEPTOS.find((d) => d.nombre.startsWith("Contabilidad"))?.id],
    ["directo", null, null], ["hilo_caso", "Hilo: rendición RG-DEMO-004", null],
  ];
  const MENSAJES = [
    [COORD, "Buenos días equipo, recuerden subir sus reportes antes del jueves."], [DOCENTE, "Listo, ya subí las notas del parcial."],
    [U.contabilidad, "Necesito el comprobante legible de la rendición rechazada."], [U.habitudes, "Lo escaneo hoy y lo envío."],
  ];
  for (const [i, [tipo, nombre, departamento_id]] of CANALES.entries()) {
    const canal = uid(`canal:${i}`);
    await upsert("chat_canal", { id: canal, tipo, nombre, departamento_id, creado_por: COORD, ...(tipo === "hilo_caso" ? { entidad_tipo: "gasto", entidad_id: uid("rend:rechazada") } : {}) });
    for (const u of Object.values(CORREO)) await upsert("chat_participante", { canal_id: canal, usuario_id: u, rol: u === COORD ? "admin" : "miembro" }, ["canal_id", "usuario_id"]);
    for (const [k, [remitente_id, contenido]] of MENSAJES.entries()) await upsert("chat_mensaje", { id: uid(`msg:${i}:${k}`), canal_id: canal, remitente_id, contenido, tipo: "texto", created_at: instante(0, -(k + 1) * 2) });
    cuenta.chat_canal = (cuenta.chat_canal ?? 0) + 1;
  }
  const todos = { ...CORREO, estudiante: U.estudiante, super_admin: U.admin };
  const NOTIS = [
    ["solicitud", "Tu solicitud cambió de estado", "Coordinación actualizó tu solicitud.", "/portal/estudiante/solicitudes"],
    ["tarea", "Tienes una tarea por vencer", "Una tarea vence en los próximos 3 días.", "/administrativo/tareas"],
    ["reunion", "Reunión programada", "Te invitaron a una reunión de coordinación.", "/administrativo/reuniones"],
    ["sistema", "Bienvenido a Global Effect Nexus", "Tu cuenta está activa y lista para usar.", "/"],
  ];
  await sembrar("notificacion", Object.entries(todos).flatMap(([rol, usuario_id]) => NOTIS.map(([tipo, titulo, mensaje, enlace], k) => ({
    id: uid(`not:${rol}:${k}`), usuario_id, titulo, mensaje, tipo, enlace, leida: k === 3 || (k === 1 && rol.length % 2 === 0),
  }))));
  await sembrar("correo_cola", [["pendiente", 0, null], ["enviado", 1, null], ["fallido", 3, "SMTP 550: buzón inexistente"]].map(([estado, intentos, ultimo_error], i) => ({
    id: uid(`mail:${estado}`), destinatario: `destino${i}@correo.com`, asunto: `Aviso institucional — ${estado}`,
    cuerpo_html: "<p>Mensaje de demostración de Global Effect.</p>", cuerpo_texto: "Mensaje de demostración de Global Effect.",
    estado, intentos, ultimo_error, enviado_en: estado === "enviado" ? instante(-1) : null,
  })));
  await sembrar("ai_accion", ["propuesta", "aprobada", "rechazada", "ejecutada", "fallida"].map((estado, i) => ({
    id: uid(`aia:${estado}`), usuario_id: [COORD, U.contabilidad, DIRHAB, U.habitudes, U.chofer][i], agente_clave: ["agente_admin", "agente_contabilidad", "agente_direccion", "agente_habitudes", "agente_colaborador"][i],
    herramienta: ["crear_tarea", "registrar_gasto", "agendar_reunion", "crear_tarea", "reportar_incidencia"][i],
    argumentos: { titulo: "Acción de demostración", origen: "seed-demo" }, estado, reversible: estado === "ejecutada",
    aprobador_id: estado === "propuesta" ? null : COORD, resultado: estado === "ejecutada" ? { ok: true } : estado === "fallida" ? { error: "Permiso insuficiente" } : null,
  })));
  await sembrar("departamento_colaborador", [
    [DEPTOS[0], COORD, "Coordinadora general", true], [DEPTOS[1], DOCENTE, "Docente", false], [DEPTOS[2], U.contabilidad, "Contadora", true],
    [DEPTOS[3], U.chofer, "Chofer", false], [DEPTOS[4], DOCENTE, "Docente titular", false], [DEPTOS[5], U.habitudes, "Facilitadora", false], [DEPTOS[5], DIRHAB, "Director", true],
  ].filter(([d]) => d).map(([d, usuario_id, cargo, es_responsable]) => ({ departamento_id: d.id, usuario_id, cargo, es_responsable })), ["departamento_id", "usuario_id"]);

  await db.query("COMMIT");
} catch (e) {
  await db.query("ROLLBACK");
  console.error("Falló el sembrado (se revirtió todo):", e.message);
  process.exitCode = 1;
}
await db.end();
if (!process.exitCode) {
  console.log("Sembrado de demostración completo:");
  for (const [t, n] of Object.entries(cuenta)) console.log(`  ${t.padEnd(32)} ${n}`);
}
