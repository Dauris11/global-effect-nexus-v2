import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedHabitudes() {
  const client = await pool.connect();
  try {
    console.log("-> Sembrando datos para Hub Habitudes y Evidencias de Liceos...");
    await client.query("BEGIN");

    // 1. Obtener usuario de habitudes y docente
    const userRes = await client.query(
      `SELECT u.id, r.nombre as rol
         FROM public.usuario u
         JOIN public.rol r ON r.id = u.rol_id
        WHERE r.nombre IN ('habitudes', 'docente', 'admin')
        ORDER BY (r.nombre = 'habitudes') DESC
        LIMIT 2`,
    );

    const facilitadorId = userRes.rows[0]?.id;
    if (!facilitadorId) {
      throw new Error("No se encontró usuario para Habitudes");
    }

    // 2. Insertar Liceos de La Vega
    const liceos = [
      {
        nombre: "Liceo Secundario Don Pepe Álvarez",
        codigo: "LIC-DPA-01",
        distrito: "Distrito 06-04 La Vega Oeste",
        director: "Prof. Marcos Antonio Rosario",
        telefono: "809-573-2210",
        direccion: "Av. Monseñor Panal esq. Colón, La Vega",
      },
      {
        nombre: "Politécnico Femenino Mercedes Morel",
        codigo: "POL-PMM-02",
        distrito: "Distrito 06-05 La Vega Este",
        director: "Licda. Carmen Altagracia Núñez",
        telefono: "809-573-4580",
        direccion: "Calle Las Carreras #45, La Vega",
      },
      {
        nombre: "Politécnico San Ignacio de Loyola",
        codigo: "POL-PSL-03",
        distrito: "Distrito 06-04 La Vega Oeste",
        director: "P. Fernando Ramos, S.J.",
        telefono: "809-573-1192",
        direccion: "Sector La Primavera, La Vega",
      },
      {
        nombre: "Liceo Federico García Godoy",
        codigo: "LIC-FGG-04",
        distrito: "Distrito 06-05 La Vega Este",
        director: "Prof. Rafael Holguín",
        telefono: "809-573-9034",
        direccion: "Calle Padre Adolfo #12, La Vega",
      },
    ];

    const liceoIds = [];
    for (const lic of liceos) {
      const res = await client.query(
        `INSERT INTO public.habitudes_liceo (nombre, codigo, distrito_educativo, director_nombre, telefono, direccion)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (codigo) DO UPDATE
            SET nombre = EXCLUDED.nombre,
                director_nombre = EXCLUDED.director_nombre,
                telefono = EXCLUDED.telefono,
                direccion = EXCLUDED.direccion
         RETURNING id`,
        [lic.nombre, lic.codigo, lic.distrito, lic.director, lic.telefono, lic.direccion],
      );
      liceoIds.push(res.rows[0].id);
    }

    // 3. Insertar Recursos Didácticos Colaborativos
    const recursos = [
      {
        titulo: "Módulo 1: El Arte de la Autodisciplina — Diapositivas Oficiales",
        descripcion: "Presentación maestra para proyectar en liceos: metáforas visuales del Iceberg, la Brújula y el Termostato de carácter.",
        categoria: "diapositiva",
        formato: "pptx",
        url: "https://storage.globaleffect.org/habitudes/presentaciones/modulo_1_autodisciplina_v3.pptx",
        nombre: "modulo_1_autodisciplina_v3.pptx",
        tamano_mb: 18.5,
      },
      {
        titulo: "Guía Pedagógica del Facilitador — Dinámicas para 4to y 5to de Secundaria",
        descripcion: "Manual de bolsillo con preguntas reflexivas, tiempos por dinámica, manejo de grupo en aulas de 35+ alumnos y evaluación formativa.",
        categoria: "guia_facilitador",
        formato: "pdf",
        url: "https://storage.globaleffect.org/habitudes/guias/guia_facilitador_habitudes_2026.pdf",
        nombre: "guia_facilitador_habitudes_2026.pdf",
        tamano_mb: 4.8,
      },
      {
        titulo: "Infografía Imprimible: Las 7 Leyes del Liderazgo Juvenil",
        descripcion: "Póster en alta resolución para colocar en murales escolares de los centros visitados.",
        categoria: "infografia_didactica",
        formato: "pdf",
        url: "https://storage.globaleffect.org/habitudes/recursos/poster_7_leyes_liderazgo.pdf",
        nombre: "poster_7_leyes_liderazgo.pdf",
        tamano_mb: 12.3,
      },
      {
        titulo: "Taller Práctico: El Espejo vs La Ventana — Hoja de Trabajo Estudiantil",
        descripcion: "Plantilla de autorreflexión individual para entregar a cada alumno durante la charla.",
        categoria: "dinamica_taller",
        formato: "docx",
        url: "https://storage.globaleffect.org/habitudes/talleres/hoja_trabajo_espejo_ventana.docx",
        nombre: "hoja_trabajo_espejo_ventana.docx",
        tamano_mb: 2.1,
      },
      {
        titulo: "Rúbrica de Evaluación de Impacto y Actitud Post-Taller",
        descripcion: "Encuesta de satisfacción y medición de cambio conductual en los estudiantes del liceo.",
        categoria: "evaluacion",
        formato: "pdf",
        url: "https://storage.globaleffect.org/habitudes/evaluaciones/evaluacion_impacto_liceos.pdf",
        nombre: "evaluacion_impacto_liceos.pdf",
        tamano_mb: 1.5,
      },
    ];

    for (const rec of recursos) {
      await client.query(
        `INSERT INTO public.habitudes_recurso (
           titulo, descripcion, categoria, formato, archivo_url, archivo_nombre, tamano_mb, subido_por_id, descargas_conteo
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, floor(random() * 40 + 5)::int)
         ON CONFLICT DO NOTHING`,
        [rec.titulo, rec.descripcion, rec.categoria, rec.formato, rec.url, rec.nombre, rec.tamano_mb, facilitadorId],
      );
    }

    // 4. Insertar Visitas a Liceos con Fotografías de Evidencia
    if (liceoIds.length > 0) {
      await client.query(
        `INSERT INTO public.habitudes_visita_evidencia (
           liceo_id, facilitador_id, fecha_visita, tema_impartido, tanda, estudiantes_impactados, observaciones, fotos_urls, estado
         ) VALUES
         ($1, $2, CURRENT_DATE - INTERVAL '1 day', 'El Termostato del Carácter: Liderazgo ante la Presión', 'matutina', 48,
          'Excelente recepción por parte de los alumnos de 5to de secundaria. Se formaron 6 grupos de trabajo con la hoja de reflexión.',
          ARRAY['https://storage.globaleffect.org/habitudes/evidencias/dpa_taller_aula1.jpg', 'https://storage.globaleffect.org/habitudes/evidencias/dpa_grupo_alumnos.jpg'],
          'auditada'),
         ($3, $2, CURRENT_DATE - INTERVAL '4 days', 'El Espejo y la Ventana: Responsabilidad Personal', 'vespertina', 62,
          'Participación activa con la orientadora del centro presente. Se entregaron 60 cuadernos de trabajo.',
          ARRAY['https://storage.globaleffect.org/habitudes/evidencias/mercedes_morel_auditorio.jpg'],
          'completada')
         ON CONFLICT DO NOTHING`,
        [liceoIds[0], facilitadorId, liceoIds[1]],
      );
    }

    await client.query("COMMIT");
    console.log("✓ Semilla de Habitudes completada exitosamente.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al sembrar datos de Habitudes:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedHabitudes();
