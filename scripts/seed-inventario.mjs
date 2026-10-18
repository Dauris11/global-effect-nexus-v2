/**
 * Datos de demostración para el Módulo 30: Inventario de Activos Físicos con QR.
 *
 * Pobla activos reales representativos de la Casa de Herramientas,
 * Laboratorios de Cómputo, Aulas y Oficinas de la Fundación Global Effect.
 *
 * Uso: node scripts/seed-inventario.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  console.log("-> Iniciando seed de inventario de activos físicos con QR...");

  // Obtener IDs de usuarios reales
  const { rows: usuarios } = await db.query(
    "SELECT id, email, nombre FROM public.usuario WHERE email IN ('admin@globaleffect.org', 'coordinacion@globaleffect.org', 'docente@globaleffect.org', 'contabilidad@globaleffect.org')"
  );

  const porEmail = Object.fromEntries(usuarios.map((u) => [u.email, u]));
  const adminId = porEmail["admin@globaleffect.org"]?.id;
  const coordId = porEmail["coordinacion@globaleffect.org"]?.id ?? adminId;
  const docenteId = porEmail["docente@globaleffect.org"]?.id ?? adminId;
  const contaId = porEmail["contabilidad@globaleffect.org"]?.id ?? adminId;

  const ACTIVOS = [
    {
      codigo: "ACT-0001",
      nombre: "Taladro Percutor Industrial Dewalt 20V Max",
      categoria: "herramientas",
      ubicacion: "Taller Casa de Herramientas",
      estado: "operativo",
      foto_url: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop&q=80",
      responsable_id: docenteId,
      valor_estimado: 14500.0,
      numero_serie: "DW-9921884",
      marca_modelo: "DeWalt DCD996B",
      notas: "Incluye dos baterías de 5Ah y cargador rápido en maletín rígido.",
    },
    {
      codigo: "ACT-0002",
      nombre: "Soldadora Inverter 200A Profesional",
      categoria: "herramientas",
      ubicacion: "Taller Casa de Herramientas",
      estado: "operativo",
      foto_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80",
      responsable_id: docenteId,
      valor_estimado: 22000.0,
      numero_serie: "ST-8812401",
      marca_modelo: "Stanley Star 4000",
      notas: "Cables reforzados y careta fotosensible incluida.",
    },
    {
      codigo: "ACT-0003",
      nombre: "Computadora de Escritorio Dell OptiPlex 7090 Core i7",
      categoria: "tecnologia",
      ubicacion: "Laboratorio de Cómputo - Aula 2",
      estado: "operativo",
      foto_url: "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=80",
      responsable_id: coordId,
      valor_estimado: 48000.0,
      numero_serie: "DL-7729103",
      marca_modelo: "Dell OptiPlex 7090 / 16GB RAM / 512GB SSD",
      notas: "Uso asignado a clases técnicas y capacitación de beneficiarios.",
    },
    {
      codigo: "ACT-0004",
      nombre: "Proyector Multimedia Epson PowerLite 3LCD",
      categoria: "tecnologia",
      ubicacion: "Salón de Conferencias Principal",
      estado: "operativo",
      foto_url: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600&auto=format&fit=crop&q=80",
      responsable_id: coordId,
      valor_estimado: 32500.0,
      numero_serie: "EP-4491022",
      marca_modelo: "Epson PowerLite E20",
      notas: "Brillo de 3,400 lúmenes con cable HDMI de 10 metros.",
    },
    {
      codigo: "ACT-0005",
      nombre: "Generador Eléctrico Honda 5.5KW Insonorizado",
      categoria: "herramientas",
      ubicacion: "Almacén Central de Operaciones",
      estado: "mantenimiento",
      foto_url: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&auto=format&fit=crop&q=80",
      responsable_id: coordId,
      valor_estimado: 85000.0,
      numero_serie: "HN-5501982",
      marca_modelo: "Honda EU70is",
      notas: "En revisión de bujías y cambio de aceite preventivo.",
    },
    {
      codigo: "ACT-0006",
      nombre: "Escritorio Ejecutivo en L con Gavetero Metálico",
      categoria: "mobiliario",
      ubicacion: "Oficina de Dirección",
      estado: "operativo",
      foto_url: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80",
      responsable_id: adminId,
      valor_estimado: 18900.0,
      numero_serie: "MB-1029384",
      marca_modelo: "Moduform Premium L-180",
      notas: "Madera tratada color nogal con pasa-cables integrados.",
    },
    {
      codigo: "ACT-0007",
      nombre: "Impresora Multifuncional Epson EcoTank L6270",
      categoria: "tecnologia",
      ubicacion: "Área Administrativa",
      estado: "operativo",
      foto_url: "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&auto=format&fit=crop&q=80",
      responsable_id: contaId,
      valor_estimado: 27800.0,
      numero_serie: "EP-8829104",
      marca_modelo: "Epson EcoTank L6270 Wi-Fi Dúplex",
      notas: "Tanques de tinta continua para emisión de informes contables y solicitudes.",
    },
    {
      codigo: "ACT-0008",
      nombre: "Refrigerador Industrial 2 Puertas en Acero Inoxidable",
      categoria: "electrodomesticos",
      ubicacion: "Cocina y Comedor Comunitario",
      estado: "operativo",
      foto_url: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80",
      responsable_id: coordId,
      valor_estimado: 54000.0,
      numero_serie: "RF-9921044",
      marca_modelo: "Torrey R-36 2P",
      notas: "Destinado a la conservación de raciones del programa de bienestar y comida.",
    },
  ];

  for (const activo of ACTIVOS) {
    const qrPayload = JSON.stringify({
      id: activo.codigo,
      codigo: activo.codigo,
      nombre: activo.nombre,
      institucion: "Fundación Global Effect",
      verificacion: "nexus.globaleffect.org/inventario/" + activo.codigo,
    });

    const res = await db.query(
      `INSERT INTO public.inventario_activo (
        codigo, nombre, categoria, ubicacion, estado, foto_url,
        codigo_qr, responsable_id, valor_estimado, numero_serie, marca_modelo, notas, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (codigo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        categoria = EXCLUDED.categoria,
        ubicacion = EXCLUDED.ubicacion,
        estado = EXCLUDED.estado,
        foto_url = EXCLUDED.foto_url,
        codigo_qr = EXCLUDED.codigo_qr,
        responsable_id = EXCLUDED.responsable_id,
        valor_estimado = EXCLUDED.valor_estimado,
        numero_serie = EXCLUDED.numero_serie,
        marca_modelo = EXCLUDED.marca_modelo,
        notas = EXCLUDED.notas
      RETURNING id, codigo`,
      [
        activo.codigo,
        activo.nombre,
        activo.categoria,
        activo.ubicacion,
        activo.estado,
        activo.foto_url,
        qrPayload,
        activo.responsable_id,
        activo.valor_estimado,
        activo.numero_serie,
        activo.marca_modelo,
        activo.notas,
        adminId,
      ]
    );

    const activoId = res.rows[0].id;

    // Registrar historial de creación inicial si no existe
    await db.query(
      `INSERT INTO public.inventario_historial (
        activo_id, usuario_id, accion, ubicacion_nueva, estado_nuevo, notas
      ) VALUES ($1, $2, 'creacion', $3, $4, 'Alta patrimonial inicial en Global Effect Nexus')
      ON CONFLICT DO NOTHING`,
      [activoId, adminId, activo.ubicacion, activo.estado]
    );
  }

  // Sincronizar la secuencia seq_inventario_activo al número 9
  await db.query("SELECT setval('public.seq_inventario_activo', 9, false)");

  console.log("✓ Seed de inventario completado con éxito (8 activos institucionales).");
} catch (error) {
  console.error("! Error durante el seed de inventario:", error);
  process.exitCode = 1;
} finally {
  await db.end();
}
