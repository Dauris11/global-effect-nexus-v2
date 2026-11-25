"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Monto } from "@/components/contabilidad/comun";
import { TARJETA } from "@/lib/paleta";
import { previsualizarAsientoNominaAccion } from "@/server/contabilidad/nomina/acciones";

type Previa = Awaited<ReturnType<typeof previsualizarAsientoNominaAccion>>;

/**
 * El asiento que generará el pago, calculado con el mismo motor de códigos de
 * transacción pero sin escribir nada: así, antes de pagar, se ve cada cuenta
 * en el lado (débito o crédito) que se configuró para su proceso.
 */
export function AsientoPrevio({
  nominaId,
  cuentaBancoId,
  version,
}: {
  nominaId: string;
  cuentaBancoId: string | null;
  /** Cambia cuando la nómina cambia de estado, para recalcular. */
  version: string;
}) {
  const t = useTranslations("contab.nomina");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    previsualizarAsientoNominaAccion(nominaId, cuentaBancoId)
      .then((r) => {
        if (vigente) {
          setPrevia(r);
          setFallo(false);
        }
      })
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
    };
  }, [nominaId, cuentaBancoId, version]);

  const aviso = (texto: string) => (
    <p className="flex items-start gap-2 rounded-control bg-marca-50 p-3 text-sm text-marca-700">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {texto}
    </p>
  );

  return (
    <section className="space-y-3" aria-labelledby="asiento-previo">
      <h3 id="asiento-previo" className="texto-titulo-tarjeta">{t("asientoTitulo")}</h3>
      {fallo && aviso(t("asientoError"))}
      {!previa && !fallo && (
        <p className="texto-meta inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          {t("asientoCargando")}
        </p>
      )}
      {previa && (
        <>
          {previa.sinCuenta.length > 0 && aviso(t("asientoSinCuenta", { codigos: previa.sinCuenta.join(", ") }))}
          {previa.cuentaInactiva.length > 0 && aviso(t("asientoCuentaInactiva", { codigos: previa.cuentaInactiva.join(", ") }))}
          {previa.sinCuenta.length === 0 && !previa.cuadra && aviso(t("asientoDescuadre"))}
          <div className={`${TARJETA.contenido} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="texto-meta border-b border-linea text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("asientoCuenta")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("asientoDebe")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("asientoHaber")}</th>
                </tr>
              </thead>
              <tbody>
                {previa.lineas.map((l, i) => (
                  <tr key={`${l.cuenta_id ?? "banco"}-${i}`} className="border-b border-linea last:border-0">
                    <td className="px-4 py-2">
                      {l.cuenta ? (
                        <>
                          <span className="font-mono text-xs text-tinta-2">{l.cuenta.codigo}</span>{" "}
                          <span className="text-tinta">{l.cuenta.nombre}</span>
                        </>
                      ) : (
                        <span className="text-tinta-2">{t("asientoBancoPendiente")}</span>
                      )}
                      <p className="texto-meta">{l.descripcion}</p>
                    </td>
                    <td className="px-4 py-2 text-right">{l.debe > 0 && <Monto valor={l.debe.toFixed(2)} moneda="DOP" />}</td>
                    <td className="px-4 py-2 text-right">{l.haber > 0 && <Monto valor={l.haber.toFixed(2)} moneda="DOP" />}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-linea font-semibold">
                <tr>
                  <td className="px-4 py-2.5">{t("asientoTotal")}</td>
                  <td className="px-4 py-2.5 text-right"><Monto valor={previa.totalDebe.toFixed(2)} moneda="DOP" /></td>
                  <td className="px-4 py-2.5 text-right"><Monto valor={previa.totalHaber.toFixed(2)} moneda="DOP" /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
