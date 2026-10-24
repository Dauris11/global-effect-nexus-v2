import { CheckCircle2, Clock, Scale } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { DialogoVigencia } from "@/components/contabilidad/configuracion/dialogo-vigencia";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { TARJETA } from "@/lib/paleta";
import type {
  FormaParametro,
  Parametro,
  TramoIsr,
  VigenciaParametro,
} from "@/server/contabilidad/configuracion/consultas";

const GRUPOS = ["itbis", "retencion", "tss", "isr"] as const;

type Traductor = Awaited<ReturnType<typeof getTranslations>>;
type Fecha = (iso: string) => string;

function cifraLegible(forma: FormaParametro, cifra: string | null, t: Traductor): string {
  if (cifra === null) return t("pendiente");
  return forma === "tasa" ? `${cifra} %` : formatearMonto(cifra, "DOP");
}

/** Nombre legible de una clave; si no hay traducción, la clave misma, que el contador reconoce. */
function nombreDe(clave: string, t: Traductor): string {
  const llave = `claves.${clave.replace(/\./g, "_")}`;
  return t.has(llave as never) ? t(llave as never) : clave;
}

function TablaTramos({ tramos, t }: { tramos: TramoIsr[]; t: Traductor }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="texto-meta text-left">
          <tr className="border-b border-linea">
            <th className="py-2 pr-3 font-medium">{t("tramoDesde")}</th>
            <th className="py-2 pr-3 font-medium">{t("tramoHasta")}</th>
            <th className="py-2 pr-3 text-right font-medium">{t("tramoTasa")}</th>
            <th className="py-2 text-right font-medium">{t("tramoCuota")}</th>
          </tr>
        </thead>
        <tbody>
          {tramos.map((tramo) => (
            <tr key={tramo.desde} className="border-b border-linea last:border-0 tabular-nums">
              <td className="py-2 pr-3">{formatearMonto(tramo.desde, "DOP")}</td>
              <td className="py-2 pr-3">{tramo.hasta ? formatearMonto(tramo.hasta, "DOP") : t("enAdelante")}</td>
              <td className="py-2 pr-3 text-right">{tramo.tasa} %</td>
              <td className="py-2 text-right">{formatearMonto(tramo.cuota, "DOP")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Historial({
  parametro,
  t,
  fecha,
}: {
  parametro: Parametro;
  t: Traductor;
  fecha: Fecha;
}) {
  const rango = (v: VigenciaParametro) =>
    v.hasta ? t("rango", { desde: fecha(v.desde), hasta: fecha(v.hasta) }) : t("rangoAbierto", { desde: fecha(v.desde) });

  if (parametro.forma === "escala") {
    return (
      <div className="space-y-5">
        {parametro.historial.map((v) => (
          <div key={v.id} className="space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-tinta">
              {rango(v)}
              {v.vigenteHoy && <Badge variant="marca">{t("vigenteHoy")}</Badge>}
            </p>
            {v.tramos && <TablaTramos tramos={v.tramos} t={t} />}
            {(v.fuente || v.nota) && <p className="texto-meta">{[v.fuente, v.nota].filter(Boolean).join(" · ")}</p>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead className="texto-meta text-left">
          <tr className="border-b border-linea">
            <th className="py-2 pr-3 font-medium">{t("valor")}</th>
            <th className="py-2 pr-3 font-medium">{t("desde")}</th>
            <th className="py-2 pr-3 font-medium">{t("hasta")}</th>
            <th className="py-2 font-medium">{t("fuente")}</th>
          </tr>
        </thead>
        <tbody>
          {parametro.historial.map((v) => (
            <tr key={v.id} className="border-b border-linea align-top last:border-0">
              <td className="py-2.5 pr-3 font-medium tabular-nums text-tinta">
                {cifraLegible(parametro.forma, v.cifra, t)}
              </td>
              <td className="py-2.5 pr-3 tabular-nums">{fecha(v.desde)}</td>
              <td className="py-2.5 pr-3 tabular-nums">{v.hasta ? fecha(v.hasta) : t("sinFin")}</td>
              <td className="py-2.5 text-tinta-2">
                {v.fuente}
                {v.nota && <span className="texto-meta block">{v.nota}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-3 md:hidden">
        {parametro.historial.map((v) => (
          <li key={v.id} className="space-y-0.5 border-b border-linea pb-3 last:border-0 last:pb-0">
            <p className="font-medium tabular-nums text-tinta">{cifraLegible(parametro.forma, v.cifra, t)}</p>
            <p className="texto-meta">{rango(v)}</p>
            {v.fuente && <p className="text-sm text-tinta-2">{v.fuente}</p>}
            {v.nota && <p className="texto-meta">{v.nota}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Parámetros legales agrupados por su prefijo (itbis, retencion, tss, isr).
 * Arriba, lo que rige HOY según `parametro_en`; debajo, su historia
 * completa, porque un mes pasado se recalcula con la fila de entonces.
 */
export async function SeccionParametros({
  parametros,
  puedeEditar,
}: {
  parametros: Parametro[];
  puedeEditar: boolean;
}) {
  const t = await getTranslations("contab.config.parametros");
  const formato = await getFormatter();
  const fecha: Fecha = (iso) =>
    formato.dateTime(new Date(`${iso}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" });

  if (parametros.length === 0) {
    return <EstadoVacio icono={Scale} titulo={t("vacioTitulo")} texto={t("vacioTexto")} />;
  }

  const grupos = [...GRUPOS, "otros"].map((grupo) => ({
    grupo,
    lista: parametros.filter((p) =>
      grupo === "otros" ? !(GRUPOS as readonly string[]).includes(p.grupo) : p.grupo === grupo,
    ),
  }));

  return (
    <div className="space-y-10">
      <p className="max-w-3xl text-[15px] text-tinta-2">{t("explicacion")}</p>
      {grupos
        .filter(({ lista }) => lista.length > 0)
        .map(({ grupo, lista }) => (
          <section key={grupo} className="space-y-4" aria-labelledby={`grupo-${grupo}`}>
            <h2 id={`grupo-${grupo}`} className="texto-titulo-seccion">
              {t(`grupos.${grupo}` as never)}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {lista.map((parametro) => {
                const editable = parametro.forma === "tasa" || parametro.forma === "monto";
                const ultima = parametro.historial[0];
                return (
                  <article key={parametro.clave} className={`${TARJETA.contenido} space-y-4 p-5`}>
                    <header className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="texto-titulo-tarjeta">{nombreDe(parametro.clave, t)}</h3>
                        <p className="texto-meta break-all font-mono">{parametro.clave}</p>
                      </div>
                      {puedeEditar && editable && (
                        <DialogoVigencia
                          clave={parametro.clave}
                          nombre={nombreDe(parametro.clave, t)}
                          forma={parametro.forma}
                          minimo={ultima.desde}
                        />
                      )}
                    </header>

                    {parametro.forma !== "escala" && (
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-2xl font-semibold tabular-nums text-tinta">
                          {parametro.hoy ? cifraLegible(parametro.forma, parametro.hoy.cifra, t) : t("sinVigente")}
                        </span>
                        {parametro.hoy ? (
                          <Badge variant="marca">
                            <CheckCircle2 />
                            {t("vigenteHoy")}
                          </Badge>
                        ) : (
                          <Badge variant="neutra">
                            <Clock />
                            {t("sinVigenteHoy")}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="border-t border-linea pt-3">
                      <p className="texto-meta mb-2 font-medium">{t("historial")}</p>
                      <Historial parametro={parametro} t={t} fecha={fecha} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
