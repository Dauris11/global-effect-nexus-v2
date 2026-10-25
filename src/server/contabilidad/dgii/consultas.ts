import { consultar, consultarUna } from "@/lib/db";

export type EventoFiscal = {
  codigo: string;
  nombre: string;
  descripcion: string;
  frecuencia: string;
  diaLimite: number;
  fechaVencimiento: string;
  diasRestantes: number;
  estadoVencimiento: "al_dia" | "proximo" | "vencido";
  presentada: boolean;
};

export type DeclaracionItem = {
  id: string;
  tipo: string;
  ejercicio: number;
  periodo: string;
  version: number;
  esRectificativa: boolean;
  estado: "borrador" | "generada" | "presentada" | "anulada";
  totalOperaciones: number;
  montoTotal: number;
  impuestoDeterminado: number;
  fechaPresentacion: string | null;
  numeroAutorizacionDgii: string | null;
  hashSha256: string | null;
  creadoEn: string;
};

export async function obtenerCalendarioFiscal(anio: number, mes: number): Promise<EventoFiscal[]> {
  const obligaciones = await consultar<{
    codigo: string;
    nombre: string;
    descripcion: string;
    frecuencia: string;
    dia_limite: number;
  }>(`SELECT codigo, nombre, descripcion, frecuencia, dia_limite FROM contabilidad.obligacion_fiscal WHERE activo = true ORDER BY dia_limite ASC`);

  const periodoIso = `${anio}-${String(mes).padStart(2, "0")}`;
  const hoy = new Date();

  // Buscar cuáles ya están presentadas para el período
  const presentadas = await consultar<{ tipo: string }>(
    `SELECT tipo FROM contabilidad.declaracion WHERE periodo = $1 AND estado = 'presentada'`,
    [periodoIso]
  );
  const presentadasSet = new Set(presentadas.map((p) => p.tipo));

  return obligaciones.map((ob) => {
    // Para obligaciones mensuales, vencen en el mes siguiente
    let anioVto = anio;
    let mesVto = mes + 1;
    if (mesVto > 12) {
      mesVto = 1;
      anioVto += 1;
    }

    const diaVto = Math.min(ob.dia_limite, 28);
    const fechaVto = new Date(anioVto, mesVto - 1, diaVto);
    const fechaVtoStr = `${anioVto}-${String(mesVto).padStart(2, "0")}-${String(diaVto).padStart(2, "0")}`;

    const diffTiempo = fechaVto.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));

    let estadoVencimiento: "al_dia" | "proximo" | "vencido" = "al_dia";
    if (diasRestantes < 0) {
      estadoVencimiento = "vencido";
    } else if (diasRestantes <= 5) {
      estadoVencimiento = "proximo";
    }

    return {
      codigo: ob.codigo,
      nombre: ob.nombre,
      descripcion: ob.descripcion,
      frecuencia: ob.frecuencia,
      diaLimite: ob.dia_limite,
      fechaVencimiento: fechaVtoStr,
      diasRestantes,
      estadoVencimiento,
      presentada: presentadasSet.has(ob.codigo),
    };
  });
}

export async function listarDeclaraciones(opciones?: {
  tipo?: string;
  periodo?: string;
}): Promise<DeclaracionItem[]> {
  const params: unknown[] = [];
  let condiciones = "WHERE 1=1";

  if (opciones?.tipo) {
    params.push(opciones.tipo);
    condiciones += ` AND d.tipo = $${params.length}`;
  }
  if (opciones?.periodo) {
    params.push(opciones.periodo);
    condiciones += ` AND d.periodo = $${params.length}`;
  }

  const sql = `
    SELECT
      d.id,
      d.tipo,
      d.ejercicio,
      d.periodo,
      d.version,
      d.es_rectificativa AS "esRectificativa",
      d.estado,
      d.total_operaciones AS "totalOperaciones",
      d.monto_total::float AS "montoTotal",
      d.impuesto_determinado::float AS "impuestoDeterminado",
      d.fecha_presentacion::text AS "fechaPresentacion",
      d.numero_autorizacion_dgii AS "numeroAutorizacionDgii",
      d.hash_sha256 AS "hashSha256",
      d.creado_en AS "creadoEn"
    FROM contabilidad.declaracion d
    ${condiciones}
    ORDER BY d.periodo DESC, d.creado_en DESC
  `;

  return consultar<DeclaracionItem>(sql, params);
}
