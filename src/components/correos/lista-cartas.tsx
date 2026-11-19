import { Check, Link2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TARJETA } from "@/lib/paleta";
import {
  aprobarCarta,
  reprocesarCarta,
  rechazarCarta,
  vincularCarta,
} from "@/server/correos/acciones";
import type { CartaPorRevisar } from "@/server/correos/consultas";

/**
 * Cartas que esperan a una persona. Es un componente de servidor: cada botón es
 * un formulario con su Server Action, así que no hay estado en el navegador y la
 * decisión no depende de que el JavaScript haya cargado.
 *
 * El texto original y la traducción van en `<details>`: son largos y la lista
 * tiene que poder recorrerse de un vistazo. Todo se pinta como texto (React lo
 * escapa): es contenido de un estudiante y de un modelo.
 */
export async function ListaCartas({
  cartas,
  estudiantes,
}: {
  cartas: readonly CartaPorRevisar[];
  estudiantes: readonly { id: string; nombre: string; email: string | null }[];
}) {
  const t = await getTranslations("sponsorMail");

  return (
    <div className="space-y-3">
      {cartas.map((carta) => (
        <Card key={carta.id} className={TARJETA.contenido}>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold break-words">
                  {carta.asunto ?? t("noSubject")}
                </p>
                <p className="texto-meta break-all">
                  {carta.remitente} · {carta.mes}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="neutra">{t(`state.${carta.estado}`)}</Badge>
                <Badge variant={carta.a_tiempo ? "marca" : "solida"}>
                  {carta.a_tiempo ? t("onTime") : t("late")}
                </Badge>
                {carta.autenticacion !== "pass" && (
                  <Badge variant="solida" className="gap-1">
                    <ShieldAlert className="size-3" />
                    {t("unverified")}
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-sm">
              {carta.estudiante ?? t("unknownStudent")}
              {carta.patrocinador ? ` → ${carta.patrocinador}` : ""}
            </p>

            {carta.motivos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {carta.motivos.map((m) => (
                  <Badge key={m} variant="outline">
                    {t(`reasons.${m}`)}
                  </Badge>
                ))}
              </div>
            )}

            {carta.traduccion && (
              <details className="rounded-control border border-linea px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">{t("translation")}</summary>
                <p className="mt-2 text-sm whitespace-pre-wrap break-words">{carta.traduccion}</p>
              </details>
            )}

            <details className="rounded-control border border-linea px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{t("original")}</summary>
              <p className="mt-2 text-sm whitespace-pre-wrap break-words">{carta.original}</p>
            </details>

            <div className="flex flex-wrap items-center gap-2">
              {carta.estado === "retenido" && carta.traduccion && (
                <Accion accion={aprobarCarta} id={carta.id} icono={<Check className="size-4" />} texto={t("approve")} principal />
              )}
              {carta.estado !== "sin_identificar" && (
                <Accion accion={reprocesarCarta} id={carta.id} icono={<RefreshCw className="size-4" />} texto={t("reprocess")} />
              )}
              <Accion accion={rechazarCarta} id={carta.id} icono={<X className="size-4" />} texto={t("reject")} />
            </div>

            {carta.estado === "sin_identificar" && (
              <form action={vincularCarta} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="carta" value={carta.id} />
                <label htmlFor={`est-${carta.id}`} className="sr-only">
                  {t("linkStudent")}
                </label>
                <select
                  id={`est-${carta.id}`}
                  name="estudiante"
                  required
                  defaultValue=""
                  className="border-linea-fuerte bg-background h-11 min-w-56 rounded-control border px-3 text-[15px]"
                >
                  <option value="" disabled>
                    {t("linkStudent")}
                  </option>
                  {estudiantes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">
                  <Link2 className="size-4" />
                  {t("link")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Accion({
  accion,
  id,
  icono,
  texto,
  principal = false,
}: {
  accion: (datos: FormData) => Promise<void>;
  id: string;
  icono: React.ReactNode;
  texto: string;
  principal?: boolean;
}) {
  return (
    <form action={accion}>
      <input type="hidden" name="carta" value={id} />
      <Button type="submit" variant={principal ? "default" : "outline"} size="sm">
        {icono}
        {texto}
      </Button>
    </form>
  );
}
