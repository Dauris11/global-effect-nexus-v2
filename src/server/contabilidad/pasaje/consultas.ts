import { requerirPermiso } from "@/lib/auth";
import { consultar, consultarUna } from "@/lib/db";
import { esUuid } from "@/lib/contabilidad/formato";
import {
  calcularPasajePorPeriodo,
  type DiaSemanaPasaje,
  type PeriodoPasaje,
} from "@/lib/solicitudes";

export type EstadoPasajeModulo = "pendiente" | "entregado";

export type FilaSolicitudPasaje = {
  id: string;
  folio: number;
  solicitante_id: string | null;
  solicitante: string | null;
  lugar_pasaje_id: string | null;
  lugar_pasaje: string | null;
  lugar_pasaje_otro: boolean;
  /** Etiqueta final de lugar («Otro» o nombre del catálogo). */
  lugar_visible: string;
  motivo_pasaje: string | null;
  /** Si el lugar no es «Otro», se muestra «Pasaje»; si es «Otro», el motivo ingresado. */
  motivo_visible: string;
  periodo_pasaje: PeriodoPasaje | null;
  dias_pasaje: DiaSemanaPasaje[] | null;
  multiplicar_por_dias: boolean;
  monto_base: number;
  factor_periodo: number;
  monto_a_entregar: number;
  monto_entregado: number | null;
  moneda: "DOP" | "USD";
  detalle: string | null;
  estado_solicitud: string;
  estado_pasaje: EstadoPasajeModulo;
  entregado_por_nombre: string | null;
  entregado_en: string | null;
  en_historial_pasaje: boolean;
  creada: string;
};

type FilaPasajeCruda = {
  id: string;
  folio: number;
  solicitante_id: string | null;
  solicitante: string | null;
  lugar_pasaje_id: string | null;
  lugar_pasaje: string | null;
  lugar_pasaje_otro: boolean;
  motivo_pasaje: string | null;
  periodo_pasaje: PeriodoPasaje | null;
  dias_pasaje: DiaSemanaPasaje[] | null;
  multiplicar_por_dias: boolean;
  monto_base: number | null;
  monto_entregado: number | null;
  moneda: "DOP" | "USD";
  detalle: string | null;
  estado_solicitud: string;
  entregado_por_nombre: string | null;
  entregado_en: string | null;
  en_historial_pasaje: boolean;
  creada: string;
};

const SELECT_PASAJE = `
  SELECT s.id,
         s.folio::int AS folio,
         s.solicitante_id,
         so.nombre AS solicitante,
         s.lugar_pasaje_id,
         lp.nombre AS lugar_pasaje,
         COALESCE(s.lugar_pasaje_otro, FALSE) AS lugar_pasaje_otro,
         s.motivo_pasaje,
         s.periodo_pasaje,
         s.dias_pasaje,
         COALESCE(lp.multiplicar_por_dias, TRUE) AS multiplicar_por_dias,
         s.monto::float8 AS monto_base,
         s.monto_entregado::float8 AS monto_entregado,
         COALESCE(s.moneda, 'DOP') AS moneda,
         s.detalle,
         s.estado AS estado_solicitud,
         ue.nombre AS entregado_por_nombre,
         s.entregado_en::text AS entregado_en,
         COALESCE(s.en_historial_pasaje, FALSE) AS en_historial_pasaje,
         s.created_at::text AS creada
    FROM public.solicitud s
    LEFT JOIN public.usuario so       ON so.id = s.solicitante_id
    LEFT JOIN public.lugar_pasaje lp  ON lp.id = s.lugar_pasaje_id
    LEFT JOIN public.usuario ue       ON ue.id = s.entregado_por
`;

function mapearFilaPasaje(fila: FilaPasajeCruda): FilaSolicitudPasaje {
  const dias = Array.isArray(fila.dias_pasaje) ? fila.dias_pasaje : null;
  const base = Number(fila.monto_base ?? 0);
  const { factor, total } = calcularPasajePorPeriodo(
    base,
    fila.periodo_pasaje,
    dias,
    fila.multiplicar_por_dias,
  );
  const lugarVisible = fila.lugar_pasaje_otro
    ? "Otro"
    : (fila.lugar_pasaje ?? "-");
  const motivoVisible = fila.lugar_pasaje_otro
    ? (fila.motivo_pasaje?.trim() || "Otro")
    : "Pasaje";

  return {
    id: fila.id,
    folio: fila.folio,
    solicitante_id: fila.solicitante_id,
    solicitante: fila.solicitante,
    lugar_pasaje_id: fila.lugar_pasaje_id,
    lugar_pasaje: fila.lugar_pasaje,
    lugar_pasaje_otro: fila.lugar_pasaje_otro,
    lugar_visible: lugarVisible,
    motivo_pasaje: fila.motivo_pasaje,
    motivo_visible: motivoVisible,
    periodo_pasaje: fila.periodo_pasaje,
    dias_pasaje: dias,
    multiplicar_por_dias: fila.multiplicar_por_dias,
    monto_base: base,
    factor_periodo: factor,
    monto_a_entregar: total,
    monto_entregado: fila.monto_entregado,
    moneda: fila.moneda,
    detalle: fila.detalle,
    estado_solicitud: fila.estado_solicitud,
    estado_pasaje: fila.estado_solicitud === "entregado" ? "entregado" : "pendiente",
    entregado_por_nombre: fila.entregado_por_nombre,
    entregado_en: fila.entregado_en,
    en_historial_pasaje: fila.en_historial_pasaje,
    creada: fila.creada,
  };
}

/**
 * Solicitudes activas e historial del módulo Contabilidad > Pasaje (Etapa 3).
 *
 * Al entregarse, el registro permanece en `solicitudes` con estado `entregado`
 * (`en_historial_pasaje = FALSE`); solo pasan a `historial` cuando se archivan.
 */
export async function listarSolicitudesPasaje(): Promise<{
  solicitudes: FilaSolicitudPasaje[];
  historial: FilaSolicitudPasaje[];
}> {
  const [activas, archivadas] = await Promise.all([
    consultar<FilaPasajeCruda>(
      `${SELECT_PASAJE}
        WHERE s.tipo = 'PASAJE'
          AND s.estado NOT IN ('cancelada', 'rechazada')
          AND COALESCE(s.en_historial_pasaje, FALSE) = FALSE
        ORDER BY s.created_at DESC
        LIMIT 200`,
    ),
    consultar<FilaPasajeCruda>(
      `${SELECT_PASAJE}
        WHERE s.tipo = 'PASAJE'
          AND COALESCE(s.en_historial_pasaje, FALSE) = TRUE
        ORDER BY COALESCE(s.entregado_en, s.updated_at) DESC
        LIMIT 200`,
    ),
  ]);

  return {
    solicitudes: activas.map(mapearFilaPasaje),
    historial: archivadas.map(mapearFilaPasaje),
  };
}

/** Datos completos de una entrega de pasaje para generar su comprobante PDF imprimible. */
export async function obtenerPasajeParaPdf(
  id: string,
): Promise<FilaSolicitudPasaje | null> {
  await requerirPermiso("contabilidad.leer");
  if (!esUuid(id)) return null;

  const fila = await consultarUna<FilaPasajeCruda>(
    `${SELECT_PASAJE}
      WHERE s.id = $1
        AND s.tipo = 'PASAJE'`,
    [id],
  );
  return fila ? mapearFilaPasaje(fila) : null;
}
