import { ReceiptText, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { DialogoConfigurarCaja } from "@/components/contabilidad/cajas/dialogo-configurar-caja";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { redondear, UMBRAL_CAJA_BAJA } from "@/lib/contabilidad/cajas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { TARJETA } from "@/lib/paleta";
import type { CajaResumen } from "@/server/contabilidad/cajas/consultas";
import type { UsuarioSolicitante } from "@/server/contabilidad/proveedores/consultas";

/**
 * Tarjeta de una caja: Número de caja (con tuerca para configuración del
 * supervisor), Tipo de caja (Caja chica / Caja), Responsable, Fondo, barra de
 * Fondo − Utilizado y botón «Movimientos de caja» (habilitado solo cuando el
 * supervisor haya guardado el desglose de efectivo).
 */
export function TarjetaCaja({
  caja,
  usuarios = [],
  usuarioActualId,
}: {
  caja: CajaResumen;
  usuarios?: UsuarioSolicitante[];
  usuarioActualId?: string;
}) {
  const t = useTranslations("contab.cajas");
  const fondo = Number(caja.fondoFijo) || 0;
  const disponible = Number(caja.saldoActual) || 0;
  const utilizado = Math.max(0, redondear(fondo - disponible));
  const proporcion = fondo > 0 ? disponible / fondo : 0;
  const pct = Math.max(0, Math.min(100, Math.round(proporcion * 100)));
  const baja = proporcion < UMBRAL_CAJA_BAJA;
  const esSupervisor = Boolean(usuarioActualId && caja.supervisorId === usuarioActualId);

  return (
    <div className={`${TARJETA.contenido} flex flex-col justify-between gap-4 p-5`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="texto-titulo-tarjeta truncate font-mono">{caja.codigo}</h3>
              <DialogoConfigurarCaja
                caja={caja}
                usuarios={usuarios}
                esSupervisor={esSupervisor}
              />
            </div>
            <Badge variant="neutra">{t(`tiposCaja.${caja.tipo}`)}</Badge>
          </div>
          {caja.estado === "inactiva" && <Badge variant="neutra">{t("inactiva")}</Badge>}
        </div>

        <p className="texto-meta flex items-center gap-1.5 truncate">
          <User className="size-3.5 shrink-0" />
          <span className="truncate">{caja.responsableNombre}</span>
        </p>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="texto-meta">{t("fondo")}</span>
            <span className="text-lg font-semibold tabular-nums text-tinta">
              {formatearMonto(caja.fondoFijo, caja.moneda)}
            </span>
          </div>

          <Progress
            value={pct}
            tono={baja ? "tinta" : "acento"}
            aria-label={t("barraDisponible")}
            className="h-2"
          />

          <div className="flex items-center justify-between text-xs text-tinta-2 tabular-nums">
            <span>
              {t("disponible")}: {formatearMonto(disponible.toFixed(2), caja.moneda)}
            </span>
            <span>
              {t("utilizado")}: {formatearMonto(utilizado.toFixed(2), caja.moneda)}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-linea pt-3">
        {caja.desgloseConfigurado ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/contabilidad/cajas/${caja.id}`}>
              <ReceiptText className="size-4" />
              {t("movimientos")}
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title={t("requiereDesglose")}
            className="w-full"
          >
            <ReceiptText className="size-4" />
            {t("movimientos")}
          </Button>
        )}
      </div>
    </div>
  );
}
