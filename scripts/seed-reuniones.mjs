// Script de seed para Agenda Institucional de Reuniones
// Uso: node scripts/seed-reuniones.mjs
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log("🌱 Sembrando reuniones institucionales...");

// Obtener usuarios clave
const { rows: usuarios } = await client.query(
  `SELECT id, email, nombre, rol_id FROM usuario`
);
const usuarioPorEmail = new Map(usuarios.map((u) => [u.email, u]));

const admin = usuarioPorEmail.get("admin@globaleffect.org") || usuarios[0];
const coordinacion = usuarioPorEmail.get("coordinacion@globaleffect.org") || admin;
const contabilidad = usuarioPorEmail.get("contabilidad@globaleffect.org") || admin;
const docente = usuarioPorEmail.get("docente@globaleffect.org") || admin;
const habitudes = usuarioPorEmail.get("habitudes@globaleffect.org") || admin;

// Obtener un estudiante
const { rows: estudiantes } = await client.query(
  `SELECT id, nombre FROM estudiante LIMIT 3`
);
const estudianteYeimy = estudiantes[0];

// Limpiar reuniones previas de seed si existieran
await client.query("DELETE FROM reunion WHERE titulo LIKE '[DEMO]%'");

const hoy = new Date();
const formatoFecha = (diasOffset) => {
  const f = new Date(hoy);
  f.setDate(f.getDate() + diasOffset);
  return f.toISOString().slice(0, 10);
};

// Insertar 4 reuniones modelo
const reuniones = [
  {
    titulo: "[DEMO] Coordinación Operativa Semanal",
    descripcion: "Revisión de avance de academias, distribución de raciones alimentarias y eventos comunitarios.",
    tipo: "coordinacion",
    modalidad: "presencial",
    lugar_o_enlace: "Sala de Juntas Principal (Sede La Vega)",
    fecha: formatoFecha(1), // Mañana
    hora_inicio: "09:00",
    hora_fin: "10:30",
    organizador_id: coordinacion.id,
    estudiante_id: null,
    estado: "programada",
    minuta: null,
    participantes: [
      { usuario_id: coordinacion.id, rol: "anfitrion", asistencia: "confirmada" },
      { usuario_id: admin.id, rol: "participante", asistencia: "confirmada" },
      { usuario_id: contabilidad.id, rol: "participante", asistencia: "pendiente" },
      { usuario_id: habitudes.id, rol: "participante", asistencia: "confirmada" },
    ],
  },
  {
    titulo: "[DEMO] Tutoría Académica y Rendimiento",
    descripcion: "Sesión de apoyo personalizado sobre proyectos finales de desarrollo de software y beca.",
    tipo: "tutoria",
    modalidad: "hibrida",
    lugar_o_enlace: "Oficina Docencia / meet.google.com/nex-tuto-2026",
    fecha: formatoFecha(2), // Pasado mañana
    hora_inicio: "15:00",
    hora_fin: "16:00",
    organizador_id: docente.id,
    estudiante_id: estudianteYeimy?.id || null,
    estado: "programada",
    minuta: null,
    participantes: [
      { usuario_id: docente.id, rol: "anfitrion", asistencia: "confirmada" },
      ...(estudianteYeimy
        ? [{ estudiante_id: estudianteYeimy.id, rol: "invitado", asistencia: "confirmada" }]
        : []),
    ],
  },
  {
    titulo: "[DEMO] Planificación Presupuestaria y Cierre Fiscal",
    descripcion: "Evaluación de ejecución presupuestaria de proyectos comunitarios y rendición DGII.",
    tipo: "departamental",
    modalidad: "presencial",
    lugar_o_enlace: "Oficina de Finanzas y Control Interno",
    fecha: formatoFecha(4),
    hora_inicio: "11:00",
    hora_fin: "12:30",
    organizador_id: contabilidad.id,
    estudiante_id: null,
    estado: "programada",
    minuta: null,
    participantes: [
      { usuario_id: contabilidad.id, rol: "anfitrion", asistencia: "confirmada" },
      { usuario_id: admin.id, rol: "participante", asistencia: "confirmada" },
    ],
  },
  {
    titulo: "[DEMO] Evaluación de Impacto Habitudes Liceo Don Pepe Álvarez",
    descripcion: "Minuta de la sesión de cierre y acuerdos con directores distritales para talleres 2026.",
    tipo: "seguimiento_estudiante",
    modalidad: "presencial",
    lugar_o_enlace: "Liceo Don Pepe Álvarez (Salón Multiuso)",
    fecha: formatoFecha(-3), // Hace 3 días
    hora_inicio: "14:00",
    hora_fin: "15:30",
    organizador_id: habitudes.id,
    estudiante_id: null,
    estado: "realizada",
    minuta: "1. Se completó el ciclo con 145 estudiantes de 4to de bachillerato.\n2. Se acordó fecha de feria vocacional para el 15 de noviembre.\n3. La dirección distrital agradeció el apoyo de la Fundación Global Effect.",
    participantes: [
      { usuario_id: habitudes.id, rol: "anfitrion", asistencia: "asistio" },
      { usuario_id: coordinacion.id, rol: "participante", asistencia: "asistio" },
    ],
  },
];

for (const r of reuniones) {
  const { rows } = await client.query(
    `INSERT INTO reunion (
       titulo, descripcion, tipo, modalidad, lugar_o_enlace,
       fecha, hora_inicio, hora_fin, organizador_usuario_id,
       estudiante_id, estado, conclusiones_o_minuta
     ) VALUES ($1, $2, $3, $4, $5, $6::date, $7::time, $8::time, $9, $10, $11, $12)
     RETURNING id, folio`,
    [
      r.titulo,
      r.descripcion,
      r.tipo,
      r.modalidad,
      r.lugar_o_enlace,
      r.fecha,
      r.hora_inicio,
      r.hora_fin,
      r.organizador_id,
      r.estudiante_id,
      r.estado,
      r.minuta,
    ]
  );
  const reunionId = rows[0].id;
  const folio = rows[0].folio;

  for (const part of r.participantes) {
    await client.query(
      `INSERT INTO reunion_participante (
         reunion_id, usuario_id, estudiante_id, rol_en_reunion, asistencia
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        reunionId,
        part.usuario_id || null,
        part.estudiante_id || null,
        part.rol,
        part.asistencia,
      ]
    );
  }
  console.log(`✓ Creada reunión #${folio}: ${r.titulo}`);
}

await client.end();
console.log("✅ Seed de reuniones completado exitosamente.");
