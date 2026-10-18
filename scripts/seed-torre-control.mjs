/**
 * Seed para la Torre de Control del Colaborador, Asignación de Proyectos por Rol
 * y Rendición de Gastos de Empleados hacia Contabilidad.
 *
 * Uso: node scripts/seed-torre-control.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  console.log("-> Iniciando seed de Torre de Control y Rendición de Gastos...");

  // 1. Obtener usuarios
  const { rows: usuarios } = await db.query(
    "SELECT id, email, nombre, rol_id FROM public.usuario WHERE email IN ('admin@globaleffect.org', 'coordinacion@globaleffect.org', 'docente@globaleffect.org', 'contabilidad@globaleffect.org')"
  );

  const porEmail = Object.fromEntries(usuarios.map((u) => [u.email, u]));
  const adminId = porEmail["admin@globaleffect.org"]?.id;
  const coordId = porEmail["coordinacion@globaleffect.org"]?.id ?? adminId;
  const docenteId = porEmail["docente@globaleffect.org"]?.id ?? adminId;
  const contaId = porEmail["contabilidad@globaleffect.org"]?.id ?? adminId;

  // 2. Programas / Proyectos Institucionales de la Fundación
  const PROGRAMAS = [
    {
      nombre: "Casa de Herramientas y Talleres Prácticos",
      descripcion: "Uso y préstamo de herramientas, talleres de soldadura, electricidad y oficios prácticos.",
      responsable: "Roberto Gómez",
      roles: ["admin", "docente"],
    },
    {
      nombre: "Programa Comunitario Juan Bosch",
      descripcion: "Proyectos barriales, servicio comunitario y mentoría ciudadana en La Vega.",
      responsable: "Marisol Peña",
      roles: ["admin", "habitudes", "docente"],
    },
    {
      nombre: "Programa de Becas Universitarias",
      descripcion: "Acompañamiento académico, estipendios y seguimiento de índice GPA para becados.",
      responsable: "Marisol Peña",
      roles: ["admin", "contabilidad"],
    },
    {
      nombre: "Red de Liceos Habitudes",
      descripcion: "Docencia presencial de valores y liderazgo en escuelas públicas secundarias.",
      responsable: "Marisol Peña",
      roles: ["habitudes", "docente", "admin"],
    },
  ];

  const proyectosCreados = {};

  for (const p of PROGRAMAS) {
    const res = await db.query(
      `INSERT INTO public.proyecto (nombre, descripcion, responsable, estado, fecha_inicio, fecha_fin, progreso)
       VALUES ($1, $2, $3, 'en_curso', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '180 days', 45)
       ON CONFLICT DO NOTHING
       RETURNING id, nombre`,
      [p.nombre, p.descripcion, p.responsable]
    );

    let id = res.rows[0]?.id;
    if (!id) {
      const q = await db.query("SELECT id FROM public.proyecto WHERE nombre = $1", [p.nombre]);
      id = q.rows[0]?.id;
    }
    proyectosCreados[p.nombre] = id;

    // Asignar proyecto a roles (gobernanza de superadmin)
    for (const rol of p.roles) {
      await db.query(
        `INSERT INTO public.proyecto_rol (proyecto_id, rol, asignado_por)
         VALUES ($1, $2, $3)
         ON CONFLICT (proyecto_id, rol) DO NOTHING`,
        [id, rol, adminId]
      );
    }
  }

  // 3. Tareas reales para hoy con los 4 estados
  const TAREAS = [
    {
      titulo: "Comprar discos de corte y electrodos para Casa de Herramientas (con NCF)",
      descripcion: "Diligencia urgente en ferretería para taller de soldadura de las 3:00 PM. Solicitar NCF B01.",
      proyecto: "Casa de Herramientas y Talleres Prácticos",
      estado: "por_hacer",
      prioridad: "urgente",
      asignado: docenteId,
    },
    {
      titulo: "Revisar rendición de factura de combustible de camioneta comunitaria",
      descripcion: "Validar comprobante fiscal B01 emitido por Texaco La Vega para el programa Juan Bosch.",
      proyecto: "Programa Comunitario Juan Bosch",
      estado: "en_progreso",
      prioridad: "alta",
      asignado: coordId,
    },
    {
      titulo: "Arqueo físico de caja chica operativa con desglose de denominaciones",
      descripcion: "Conteo físico de billetes y monedas con el custodio antes del cierre de fin de semana.",
      proyecto: "Programa de Becas Universitarias",
      estado: "en_revision",
      prioridad: "alta",
      asignado: contaId,
    },
    {
      titulo: "Verificar auditoría de códigos QR de computadoras de laboratorio",
      descripcion: "Escaneo físico con cámara en Aula 2 de las máquinas Dell OptiPlex recién asignadas.",
      proyecto: "Casa de Herramientas y Talleres Prácticos",
      estado: "completada",
      prioridad: "media",
      asignado: adminId,
    },
  ];

  for (const t of TAREAS) {
    const proyId = proyectosCreados[t.proyecto] ?? null;
    const res = await db.query(
      `INSERT INTO public.tarea (titulo, descripcion, proyecto_id, visibilidad, estado, prioridad, fecha_limite)
       VALUES ($1, $2, $3, 'asignados', $4, $5, CURRENT_DATE)
       RETURNING id`,
      [t.titulo, t.descripcion, proyId, t.estado, t.prioridad]
    );

    const tareaId = res.rows[0].id;

    if (t.asignado) {
      await db.query(
        `INSERT INTO public.tarea_asignado (tarea_id, usuario_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [tareaId, t.asignado]
      );

      // Crear entrada en bitácora diaria para mostrar actividad de hoy
      await db.query(
        `INSERT INTO public.colaborador_bitacora_diaria (usuario_id, fecha, descripcion, tarea_id, minutos_dedicados)
         VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
        [t.asignado, `Avance en: ${t.titulo}`, tareaId, 45]
      );
    }
  }

  // 4. Rendición de Gastos con OCR demo
  const casaHerrId = proyectosCreados["Casa de Herramientas y Talleres Prácticos"];
  const juanBoschId = proyectosCreados["Programa Comunitario Juan Bosch"];

  const RENDICIONES = [
    {
      codigo: "RDG-0001",
      empleado_id: docenteId,
      programa_id: casaHerrId,
      proveedor_nombre: "Ferretería Ochoa La Vega",
      proveedor_rnc: "130-99887-1",
      ncf: "B0100000412",
      fecha_comprobante: "2026-10-18",
      moneda: "DOP",
      monto_total: 3850.0,
      monto_itbis: 587.29,
      concepto: "Discos de desbaste, electrodos 6013 y guantes de carnaza para talleres prácticos",
      comprobante_url: "https://images.unsplash.com/photo-1554415707-9e49017aed81?w=600&auto=format&fit=crop&q=80",
      ocr_data: JSON.stringify({
        rnc: "130-99887-1",
        ncf: "B0100000412",
        fecha: "2026-10-18",
        subtotal: 3262.71,
        itbis: 587.29,
        total: 3850.0,
        proveedor: "Ferretería Ochoa",
        confianzaOcr: 0.96,
      }),
      estado: "en_revision",
    },
    {
      codigo: "RDG-0002",
      empleado_id: coordId,
      programa_id: juanBoschId,
      proveedor_nombre: "Estación Texaco Camú",
      proveedor_rnc: "101-55443-2",
      ncf: "B0100001099",
      fecha_comprobante: "2026-10-18",
      moneda: "DOP",
      monto_total: 2500.0,
      monto_itbis: 0.0,
      concepto: "Combustible Diesel para traslado de voluntarios al operativo barrial Juan Bosch",
      comprobante_url: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&auto=format&fit=crop&q=80",
      ocr_data: JSON.stringify({
        rnc: "101-55443-2",
        ncf: "B0100001099",
        fecha: "2026-10-18",
        subtotal: 2500.0,
        itbis: 0.0,
        total: 2500.0,
        proveedor: "Texaco Camú",
        confianzaOcr: 0.94,
      }),
      estado: "enviada",
    },
  ];

  for (const r of RENDICIONES) {
    await db.query(
      `INSERT INTO public.rendicion_gasto (
        codigo, empleado_id, programa_id, proveedor_nombre, proveedor_rnc, ncf,
        fecha_comprobante, moneda, monto_total, monto_itbis, concepto,
        comprobante_url, ocr_data, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (codigo) DO UPDATE SET
        estado = EXCLUDED.estado,
        monto_total = EXCLUDED.monto_total`,
      [
        r.codigo,
        r.empleado_id,
        r.programa_id,
        r.proveedor_nombre,
        r.proveedor_rnc,
        r.ncf,
        r.fecha_comprobante,
        r.moneda,
        r.monto_total,
        r.monto_itbis,
        r.concepto,
        r.comprobante_url,
        r.ocr_data,
        r.estado,
      ]
    );
  }

  // Sincronizar secuencia
  await db.query("SELECT setval('public.seq_rendicion_gasto', 3, false)");

  console.log("✓ Seed de Torre de Control, Proyectos por Rol y Rendiciones completado con éxito.");
} catch (error) {
  console.error("! Error durante el seed de Torre de Control:", error);
  process.exitCode = 1;
} finally {
  await db.end();
}
