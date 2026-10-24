import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log("-> Iniciando seed de Moodle y Matrícula Global 360...");

    await client.query("BEGIN");

    // 1. Obtener docente y materias
    const docenteRes = await client.query(
      `SELECT u.id FROM public.usuario u JOIN public.rol r ON r.id = u.rol_id WHERE r.nombre = 'docente' LIMIT 1`,
    );
    const docenteId = docenteRes.rows[0]?.id;

    const estudianteRes = await client.query(
      `SELECT e.id FROM public.estudiante e WHERE e.tipo = 'becado' LIMIT 1`,
    );
    const estudianteId = estudianteRes.rows[0]?.id;

    const periodoRes = await client.query(
      `SELECT id FROM public.periodo WHERE estado = 'activo' LIMIT 1`,
    );
    let periodoId = periodoRes.rows[0]?.id;

    if (!periodoId) {
      const nuevoPeriodo = await client.query(
        `INSERT INTO public.periodo (nombre, fecha_inicio, fecha_fin, estado)
         VALUES ('2026-III', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '90 days', 'activo')
         RETURNING id`,
      );
      periodoId = nuevoPeriodo.rows[0].id;
    }

    // 2. Actualizar materias de Global 360 con Horarios, Aulas y Docentes
    await client.query(
      `UPDATE public.materia_360
          SET horario = 'Martes y Jueves 6:00 PM - 8:00 PM',
              aula = 'Laboratorio Informática A',
              cupo_maximo = 25,
              docente_id = $1
        WHERE codigo = 'G360-ORAT' OR nombre ILIKE '%Oratoria%'`,
      [docenteId],
    );

    await client.query(
      `UPDATE public.materia_360
          SET horario = 'Sábados 9:00 AM - 1:00 PM',
              aula = 'Salón Multiusos Nexus',
              cupo_maximo = 30,
              docente_id = $1
        WHERE codigo = 'G360-EXCEL' OR nombre ILIKE '%Excel%'`,
      [docenteId],
    );

    await client.query(
      `UPDATE public.materia_360
          SET horario = 'Lunes y Miércoles 7:00 PM - 9:00 PM',
              aula = 'Aula Virtual Zoom 1',
              cupo_maximo = 35,
              docente_id = $1
        WHERE codigo = 'G360-ETICA' OR nombre ILIKE '%Ética%'`,
      [docenteId],
    );

    // 3. Ventanas de Matrícula Cuatrimestral (Ronda 1 y Ronda 2)
    await client.query(
      `INSERT INTO public.ventana_prematricula (periodo_id, abre, cierra, mensaje, activa, ronda)
       VALUES 
       ($1, now() - INTERVAL '2 days', now() + INTERVAL '5 days', 'Matrícula Regular de Inicio de Cuatrimestre (Ronda 1). Selecciona tus asignaturas prioritarias con cupo.', true, 1),
       ($1, now() + INTERVAL '30 days', now() + INTERVAL '35 days', 'Matrícula de Ajustes y Segundo Bloque (Ronda 2). Ajuste de cupos y materias modulares.', false, 2)
       ON CONFLICT DO NOTHING`,
      [periodoId],
    );

    // 4. Asignaciones estilo Moodle para las materias
    const materiaRes = await client.query(`SELECT id FROM public.materia LIMIT 1`);
    const materiaId = materiaRes.rows[0]?.id;

    if (materiaId) {
      // Tarea 1: Moodle con PDF y 10 MB
      const asignacion1 = await client.query(
        `INSERT INTO public.asignacion (
           materia_id, titulo, descripcion, tipo, fecha_publicacion, fecha_vencimiento,
           limite_mb, formatos_permitidos, puntaje_maximo, permite_entregas_tardias,
           instrucciones_entrega, creada_por_id
         ) VALUES (
           $1,
           'Proyecto Final: Arquitectura de Red y Seguridad Perimetral',
           'Diseñar la topología de red para una sucursal bancaria incluyendo direccionamiento IPv4/IPv6, VLANs y reglas de firewall. El documento debe entregarse en formato PDF firmado digitalmente.',
           'tarea',
           now() - INTERVAL '5 days',
           now() + INTERVAL '3 days',
           15,
           ARRAY['pdf'],
           100.00,
           true,
           '1. Carátula institucional con matrícula.\n2. Diagrama en draw.io o Visio insertado en alta resolución.\n3. Conclusiones y recomendaciones técnicas.',
           $2
         ) RETURNING id`,
        [materiaId, docenteId],
      );

      const asig1Id = asignacion1.rows[0]?.id;

      // Entrega de prueba del estudiante
      if (estudianteId && asig1Id) {
        await client.query(
          `INSERT INTO public.entrega_estudiante (
             asignacion_id, estudiante_id, estado, archivo_url, archivo_nombre,
             archivo_tamano_mb, archivo_formato, fecha_entrega, calificacion,
             comentario_profesor, revisada_por_id, revisada_en
           ) VALUES (
             $1, $2, 'calificado',
             'https://storage.globaleffect.org/entregas/isc215_proyecto_topologia.pdf',
             'isc215_proyecto_topologia.pdf',
             4.20,
             'pdf',
             now() - INTERVAL '1 day',
             95.00,
             'Excelente análisis de seguridad y segmentación de subredes. Se sugiere reforzar el failover WAN.',
             $3,
             now() - INTERVAL '6 hours'
           ) ON CONFLICT (asignacion_id, estudiante_id) DO NOTHING`,
          [asig1Id, estudianteId, docenteId],
        );
      }

      // Tarea 2: Moodle con ZIP y 25 MB
      await client.query(
        `INSERT INTO public.asignacion (
           materia_id, titulo, descripcion, tipo, fecha_publicacion, fecha_vencimiento,
           limite_mb, formatos_permitidos, puntaje_maximo, permite_entregas_tardias,
           instrucciones_entrega, creada_por_id
         ) VALUES (
           $1,
           'Laboratorio Práctico: Implementación de API RESTful con Postgres',
           'Desarrollar el CRUD de servicios estudiantiles con autenticación JWT y tests unitarios. Comprimir el código fuente omitiendo la carpeta node_modules.',
           'tarea',
           now() - INTERVAL '2 days',
           now() + INTERVAL '7 days',
           25,
           ARRAY['zip', 'tar.gz'],
           100.00,
           false,
           'Subir archivo comprimido (.zip). Debe incluir archivo README.md con comandos para levantar el entorno docker-compose.',
           $2
         ) ON CONFLICT DO NOTHING`,
        [materiaId, docenteId],
      );
    }

    await client.query("COMMIT");
    console.log("✓ Seed de Moodle y Matrícula Global 360 completado con éxito.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error en seed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
