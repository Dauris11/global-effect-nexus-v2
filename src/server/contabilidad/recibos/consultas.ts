import { consultar, consultarUna } from "@/lib/db";
import {
  esEstadoRecibo,
  esFechaIso,
  esFormaPago,
  esMoneda,
  esTipoRecibo,
  esUuid,
  montoValido,
  type EstadoRecibo,
  type FormaPago,
  type Moneda,
  type TipoRecibo,
} from "@/lib/contabilidad/formato";

/**
 * Consulta de recibos (§4.3): ingresos y egresos en una sola lista, con
 * todos los filtros que pidió el departamento.
 *
 * Los filtros llegan de la URL y se validan aquí, uno por uno: lo que no
 * sea un valor admitido se descarta en vez de llegar al SQL. El WHERE es
 * uno solo y parametrizado; cada filtro vacío se anula con `$n IS NULL`.
 *
 * Los montos salen como TEXTO (`::text`), igual que en todo el módulo. Las
 * sumas de cabecera las hace la base.
 */

const TOPE = 200;

export type FiltroRecibos = {
  desde: string | null;
  hasta: string | null;
  tipo: TipoRecibo | null;
  numero: string | null;
  cuenta: string | null;
  proyecto: string | null;
  categoria: string | null;
  /** Patrocinador o beneficiario, por nombre. */
  tercero: string | null;
  montoMin: string | null;
  montoMax: string | null;
  moneda: Moneda | null;
  estado: EstadoRecibo | null;
  creadoPor: string | null;
  aprobadoPor: string | null;
  texto: string | null;
};

type Crudo = Record<string, string | string[] | undefined>;

function uno(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor ?? "").trim();
}

/** De `searchParams` a un filtro limpio. */
export function leerFiltroRecibos(crudo: Crudo): FiltroRecibos {
  const fecha = (v: string) => (esFechaIso(v) ? v : null);
  const id = (v: string) => (esUuid(v) ? v : null);
  const tipo = uno(crudo.tipo);
  const moneda = uno(crudo.moneda);
  const estado = uno(crudo.estado);
  const numero = uno(crudo.numero).replace(/\D/g, "");

  return {
    desde: fecha(uno(crudo.desde)),
    hasta: fecha(uno(crudo.hasta)),
    tipo: esTipoRecibo(tipo) ? tipo : null,
    numero: numero ? numero.slice(0, 12) : null,
    cuenta: id(uno(crudo.cuenta)),
    proyecto: id(uno(crudo.proyecto)),
    categoria: id(uno(crudo.categoria)),
    tercero: uno(crudo.tercero).slice(0, 80) || null,
    montoMin: montoValido(uno(crudo.min)),
    montoMax: montoValido(uno(crudo.max)),
    moneda: esMoneda(moneda) ? moneda : null,
    estado: esEstadoRecibo(estado) ? estado : null,
    creadoPor: id(uno(crudo.creado)),
    aprobadoPor: id(uno(crudo.aprobado)),
    texto: uno(crudo.q).slice(0, 80) || null,
  };
}

export function hayFiltroRecibos(filtro: FiltroRecibos): boolean {
  return Object.values(filtro).some((v) => v !== null);
}

const CONDICION = `($1::date IS NULL OR r.fecha >= $1)
  AND ($2::date IS NULL OR r.fecha <= $2)
  AND ($3::text IS NULL OR r.tipo = $3)
  AND ($4::bigint IS NULL OR r.numero = $4)
  AND ($5::uuid IS NULL OR r.cuenta_bancaria_id = $5)
  AND ($6::uuid IS NULL OR r.proyecto_id = $6)
  AND ($7::uuid IS NULL OR r.categoria_id = $7)
  AND ($8::text IS NULL OR pa.nombre ILIKE '%' || $8 || '%' OR r.beneficiario ILIKE '%' || $8 || '%')
  AND ($9::numeric IS NULL OR r.monto >= $9)
  AND ($10::numeric IS NULL OR r.monto <= $10)
  AND ($11::text IS NULL OR r.moneda = $11)
  AND ($12::text IS NULL OR r.estado = $12)
  AND ($13::uuid IS NULL OR r.creado_por = $13)
  AND ($14::uuid IS NULL OR r.contabilizado_por = $14)
  AND ($15::text IS NULL OR r.concepto ILIKE '%' || $15 || '%' OR r.referencia ILIKE '%' || $15 || '%')`;

const DESDE = `FROM contabilidad.recibo r
  JOIN contabilidad.cuenta_bancaria cb ON cb.id = r.cuenta_bancaria_id
  JOIN contabilidad.categoria ca ON ca.id = r.categoria_id
  JOIN contabilidad.fondo f ON f.id = r.fondo_id
  JOIN usuario uc ON uc.id = r.creado_por
  LEFT JOIN usuario ua ON ua.id = r.contabilizado_por
  LEFT JOIN proyecto pr ON pr.id = r.proyecto_id
  LEFT JOIN patrocinador pa ON pa.id = r.patrocinador_id`;

function parametros(f: FiltroRecibos): unknown[] {
  return [
    f.desde, f.hasta, f.tipo, f.numero, f.cuenta, f.proyecto, f.categoria, f.tercero,
    f.montoMin, f.montoMax, f.moneda, f.estado, f.creadoPor, f.aprobadoPor, f.texto,
  ];
}

export type FilaRecibo = {
  id: string;
  tipo: TipoRecibo;
  numero: string;
  fecha: string;
  cuenta: string;
  moneda: Moneda;
  monto: string;
  monto_dop: string | null;
  concepto: string;
  categoria: string;
  fondo: string;
  proyecto: string | null;
  tercero: string | null;
  forma_pago: FormaPago;
  referencia: string | null;
  estado: EstadoRecibo;
  creado_por: string;
  aprobado_por: string | null;
};

const COLUMNAS = `r.id, r.tipo, r.numero::text AS numero, r.fecha::text AS fecha,
  cb.nombre AS cuenta, r.moneda, r.monto::text AS monto, r.monto_dop::text AS monto_dop,
  r.concepto, ca.nombre AS categoria, f.nombre AS fondo, pr.nombre AS proyecto,
  coalesce(pa.nombre, r.beneficiario) AS tercero, r.forma_pago, r.referencia, r.estado,
  uc.nombre AS creado_por, ua.nombre AS aprobado_por`;

/** Hasta 200 recibos del filtro; trae uno de más para saber si hay más. */
export async function recibos(filtro: FiltroRecibos, tope = TOPE): Promise<FilaRecibo[]> {
  return consultar<FilaRecibo>(
    `SELECT ${COLUMNAS} ${DESDE}
      WHERE ${CONDICION}
      ORDER BY r.fecha DESC, r.numero DESC
      LIMIT $16`,
    [...parametros(filtro), tope + 1],
  );
}

/** Para la exportación: el filtro entero, sin el tope de la pantalla. */
export async function recibosParaExportar(filtro: FiltroRecibos): Promise<FilaRecibo[]> {
  return recibos(filtro, 50_000);
}

export const TOPE_RECIBOS = TOPE;

export type TotalRecibos = { tipo: TipoRecibo; moneda: Moneda; total: string; cantidad: number };

/**
 * Totales del filtro por tipo y moneda, sin los anulados. No se suman
 * pesos con dólares: cada par sale aparte.
 */
export async function totalesRecibos(filtro: FiltroRecibos): Promise<TotalRecibos[]> {
  return consultar<TotalRecibos>(
    `SELECT r.tipo, r.moneda, sum(r.monto)::text AS total, count(*)::int AS cantidad
       ${DESDE}
      WHERE ${CONDICION} AND r.estado <> 'anulado'
      GROUP BY r.tipo, r.moneda
      ORDER BY r.tipo, r.moneda`,
    parametros(filtro),
  );
}

export type DetalleRecibo = FilaRecibo & {
  serie: string;
  cuenta_id: string;
  categoria_id: string;
  fondo_id: string;
  proyecto_id: string | null;
  patrocinador_id: string | null;
  beneficiario: string | null;
  tasa: string | null;
  notas: string | null;
  creado_por_id: string;
  creado_en: string;
  contabilizado_en: string | null;
  anulado_por: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  cheque_numero: string | null;
  asiento_numero: string | null;
  migrado: boolean;
};

export async function reciboPorId(id: string): Promise<DetalleRecibo | null> {
  if (!esUuid(id)) return null;
  return consultarUna<DetalleRecibo>(
    `SELECT ${COLUMNAS},
            CASE r.tipo WHEN 'ingreso' THEN 'RI' ELSE 'CE' END AS serie,
            r.cuenta_bancaria_id AS cuenta_id, r.categoria_id, r.fondo_id, r.proyecto_id,
            r.patrocinador_id, r.beneficiario, r.tasa::text AS tasa, r.notas,
            r.creado_por AS creado_por_id, to_char(r.creado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS creado_en,
            to_char(r.contabilizado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS contabilizado_en,
            un.nombre AS anulado_por, to_char(r.anulado_en AT TIME ZONE 'America/Santo_Domingo', 'YYYY-MM-DD HH24:MI') AS anulado_en, r.motivo_anulacion,
            m.cheque_numero::text AS cheque_numero, a.numero::text AS asiento_numero,
            r.migrado_de IS NOT NULL AS migrado
       ${DESDE}
       LEFT JOIN usuario un ON un.id = r.anulado_por
       LEFT JOIN contabilidad.movimiento_bancario m ON m.id = r.movimiento_id
       LEFT JOIN contabilidad.asiento a ON a.id = r.asiento_id
      WHERE r.id = $1`,
    [id],
  );
}

export type Adjunto = {
  id: string;
  nombre: string;
  tipo_mime: string;
  tamano: number;
  subido_por: string;
  creado_en: string;
};

export async function adjuntosDeRecibo(reciboId: string): Promise<Adjunto[]> {
  return consultar<Adjunto>(
    `SELECT a.id, a.nombre, a.tipo_mime, a.tamano, u.nombre AS subido_por,
            a.creado_en::text AS creado_en
       FROM contabilidad.recibo_adjunto a
       JOIN usuario u ON u.id = a.subido_por
      WHERE a.recibo_id = $1 AND a.activo
      ORDER BY a.creado_en`,
    [reciboId],
  );
}

export async function adjuntoPorId(
  id: string,
): Promise<{ id: string; ruta: string; nombre: string; recibo_id: string } | null> {
  if (!esUuid(id)) return null;
  return consultarUna(
    `SELECT id, ruta, nombre, recibo_id FROM contabilidad.recibo_adjunto
      WHERE id = $1 AND activo`,
    [id],
  );
}

export type Opcion = { id: string; nombre: string };
export type OpcionCategoria = Opcion & { tipo: "ingreso" | "egreso" | "ambos" };
export type OpcionCuenta = Opcion & { moneda: Moneda };

export type OpcionesRecibo = {
  cuentas: OpcionCuenta[];
  categorias: OpcionCategoria[];
  fondos: Opcion[];
  proyectos: Opcion[];
  patrocinadores: Opcion[];
  personas: Opcion[];
};

/**
 * Lo que alimenta los desplegables del alta y de los filtros. Las
 * categorías sin cuenta contable no se ofrecen para registrar: el recibo
 * no se podría contabilizar.
 */
export async function opcionesRecibo(): Promise<OpcionesRecibo> {
  const [cuentas, categorias, fondos, proyectos, patrocinadores, personas] = await Promise.all([
    consultar<OpcionCuenta>(
      `SELECT id, nombre, moneda FROM contabilidad.cuenta_bancaria
        WHERE estado = 'activa' ORDER BY nombre`,
    ),
    consultar<OpcionCategoria>(
      `SELECT id, nombre, tipo FROM contabilidad.categoria
        WHERE activa AND cuenta_id IS NOT NULL ORDER BY tipo, nombre`,
    ),
    consultar<Opcion>(`SELECT id, nombre FROM contabilidad.fondo WHERE activo ORDER BY nombre`),
    consultar<Opcion>(`SELECT id, nombre FROM proyecto ORDER BY nombre`),
    consultar<Opcion>(`SELECT id, nombre FROM patrocinador ORDER BY nombre`),
    // Solo quien ha creado o aprobado algún recibo: el filtro "creado por"
    // con todos los usuarios del sistema sería una lista de estudiantes.
    consultar<Opcion>(
      `SELECT DISTINCT u.id, u.nombre
         FROM usuario u
         JOIN contabilidad.recibo r ON u.id IN (r.creado_por, r.contabilizado_por)
        ORDER BY u.nombre`,
    ),
  ]);
  return { cuentas, categorias, fondos, proyectos, patrocinadores, personas };
}

/** Los borradores que esperan a que alguien los contabilice. */
export async function borradoresPendientes(): Promise<FilaRecibo[]> {
  return consultar<FilaRecibo>(
    `SELECT ${COLUMNAS} ${DESDE}
      WHERE r.estado = 'borrador'
      ORDER BY r.fecha, r.numero
      LIMIT 20`,
  );
}
