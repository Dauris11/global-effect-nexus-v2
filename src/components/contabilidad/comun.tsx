import { AlertCircle, Ban, CheckCircle2, FilePen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatearMonto, type EstadoRecibo, type Moneda } from "@/lib/contabilidad/formato";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { cn } from "@/lib/utils";

/**
 * Piezas que comparten todas las pantallas de contabilidad.
 *
 * Sin "use client": son puras y se usan tanto en páginas de servidor como
 * dentro de los formularios.
 */

/** Desplegable nativo con los tokens de la marca (Radix Select no envía en un `<form>` GET). */
export const SELECT =
  "h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 text-[15px] text-tinta outline-none focus-visible:border-marca-500 focus-visible:ring-[3px] focus-visible:ring-marca-500/30 disabled:opacity-60";

/**
 * Un monto con su moneda. Las entradas llevan el `+` y el azul de la marca;
 * las salidas, el `−` y la tinta (`MOVIMIENTO` de paleta.ts). El signo va
 * escrito siempre: es lo único que sobrevive en una impresión en grises.
 */
export function Monto({
  valor,
  moneda,
  conSigno = false,
  className,
}: {
  valor: string;
  moneda: Moneda;
  conSigno?: boolean;
  className?: string;
}) {
  const negativo = valor.trim().startsWith("-");
  const texto = formatearMonto(valor, moneda);

  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        conSigno && (negativo ? "text-tinta" : "text-marca-600"),
        className,
      )}
    >
      {conSigno && !negativo ? `+${texto}` : texto}
    </span>
  );
}

/**
 * Estado de un recibo. Es el estado de una entidad, así que contabilizado y
 * anulado usan el `SEMAFORO`, cada uno con su icono; el borrador va en gris
 * porque todavía no afirma nada.
 */
export function InsigniaEstadoRecibo({
  estado,
  etiqueta,
}: {
  estado: EstadoRecibo;
  etiqueta: string;
}) {
  if (estado === "contabilizado") {
    return (
      <Badge className={INSIGNIA_SEMAFORO.dentro}>
        <CheckCircle2 />
        {etiqueta}
      </Badge>
    );
  }
  if (estado === "anulado") {
    return (
      <Badge className={INSIGNIA_SEMAFORO.alerta}>
        <Ban />
        {etiqueta}
      </Badge>
    );
  }
  return (
    <Badge variant="neutra">
      <FilePen />
      {etiqueta}
    </Badge>
  );
}

/** Aviso de error: tinta con icono, nunca rojo (docs/09 §2). */
export function AvisoError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-control bg-tinta px-3 py-2.5 text-sm text-background"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Confirmación: azul suave con icono. */
export function AvisoOk({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-control bg-marca-50 px-3 py-2.5 text-sm text-marca-700"
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Pareja etiqueta–valor de una ficha de detalle. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="texto-meta">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-[15px] text-tinta">{children}</dd>
    </div>
  );
}
