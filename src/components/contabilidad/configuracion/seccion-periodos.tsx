import { CalendarRange, Lock, LockOpen } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { DialogoPeriodo } from "@/components/contabilidad/configuracion/dialogo-periodo";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { TARJETA } from "@/lib/paleta";
import type { Periodo } from "@/server/contabilidad/configuracion/consultas";

type Traductor = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Abierto o cerrado no es "bien" o "mal": es si el mes admite registros.
 * Por eso no lleva el SEMAFORO sino gris y el candado, que se lee igual
 * impreso en grises.
 */
function InsigniaPeriodo({ estado, t }: { estado: Periodo["estado"]; t: Traductor }) {
  return estado === "cerrado" ? (
    <Badge variant="solida">
      <Lock />
      {t("estado.cerrado")}
    </Badge>
  ) : (
    <Badge variant="marca">
      <LockOpen />
      {t("estado.abierto")}
    </Badge>
  );
}

function Trazas({ periodo, t }: { periodo: Periodo; t: Traductor }) {
  return (
    <div className="space-y-1 text-sm text-tinta-2">
      {periodo.cerradoEn && <p>{t("cerradoPor", { quien: periodo.cerradoPor ?? t("sinNombre"), cuando: periodo.cerradoEn })}</p>}
      {periodo.reabiertoEn && (
        <p>{t("reabiertoPor", { quien: periodo.reabiertoPor ?? t("sinNombre"), cuando: periodo.reabiertoEn })}</p>
      )}
      {periodo.motivo && <p className="texto-meta">{t("motivoMostrado", { motivo: periodo.motivo })}</p>}
      {!periodo.cerradoEn && !periodo.reabiertoEn && <p className="texto-meta">{t("sinCierres")}</p>}
    </div>
  );
}

export async function SeccionPeriodos({
  periodos,
  puedeCerrar,
}: {
  periodos: Periodo[];
  puedeCerrar: boolean;
}) {
  const t = await getTranslations("contab.config.periodos");
  const formato = await getFormatter();
  const nombre = (p: Periodo) =>
    formato.dateTime(new Date(Date.UTC(p.anio, p.mes - 1, 1)), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  if (periodos.length === 0) {
    return <EstadoVacio icono={CalendarRange} titulo={t("vacioTitulo")} texto={t("vacioTexto")} />;
  }

  const accion = (p: Periodo) =>
    puedeCerrar ? (
      <DialogoPeriodo id={p.id} nombre={nombre(p)} modo={p.estado === "abierto" ? "cerrar" : "reabrir"} />
    ) : null;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[15px] text-tinta-2">{t("explicacion")}</p>

      <div className={`${TARJETA.contenido} hidden overflow-hidden md:block`}>
        <table className="w-full text-sm">
          <thead className="texto-meta border-b border-linea text-left">
            <tr>
              <th className="px-5 py-3 font-medium">{t("periodo")}</th>
              <th className="px-5 py-3 font-medium">{t("estadoColumna")}</th>
              <th className="px-5 py-3 font-medium">{t("historia")}</th>
              {puedeCerrar && <th className="px-5 py-3 text-right font-medium">{t("acciones")}</th>}
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id} className="border-b border-linea align-top last:border-0">
                <td className="px-5 py-4 font-medium capitalize text-tinta">{nombre(p)}</td>
                <td className="px-5 py-4">
                  <InsigniaPeriodo estado={p.estado} t={t} />
                </td>
                <td className="px-5 py-4">
                  <Trazas periodo={p} t={t} />
                </td>
                {puedeCerrar && <td className="px-5 py-4 text-right">{accion(p)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {periodos.map((p) => (
          <li key={p.id} className={`${TARJETA.contenido} space-y-3 p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="texto-titulo-tarjeta capitalize">{nombre(p)}</p>
              <InsigniaPeriodo estado={p.estado} t={t} />
            </div>
            <Trazas periodo={p} t={t} />
            {accion(p)}
          </li>
        ))}
      </ul>
    </div>
  );
}
