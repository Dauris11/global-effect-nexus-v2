import type { Metadata } from "next";
import { Inbox, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ListaCartas } from "@/components/correos/lista-cartas";
import { ResumenPorPatrocinador } from "@/components/correos/resumen-por-patrocinador";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { requerirPermiso } from "@/lib/auth";
import { ultimosDoceMeses } from "@/server/bienestar/consultas";
import {
  cartasPorPatrocinador,
  cartasPorRevisar,
  estudiantesActivosParaVincular,
} from "@/server/correos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sponsorMail" });

  return { title: t("title") };
}

/**
 * Cartas de los becados a sus patrocinadores: las que esperan decisión de
 * administración y el estado del mes por patrocinador. El mes lo decide la base
 * (el más reciente de `ultimosDoceMeses`), no el reloj del servidor.
 */
export default async function PaginaCorreos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await requerirPermiso("patrocinadores.escribir");

  const meses = await ultimosDoceMeses();
  const mes = meses[0] ?? "";

  const [t, cartas, estudiantes, porPatrocinador] = await Promise.all([
    getTranslations({ locale, namespace: "sponsorMail" }),
    cartasPorRevisar(),
    estudiantesActivosParaVincular(),
    cartasPorPatrocinador(mes),
  ]);

  return (
    <div className="animate-entrada space-y-8 pb-10">
      <EncabezadoPagina titulo={t("title")} />

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("pending", { n: cartas.length })}</p>
        {cartas.length === 0 ? (
          <EstadoVacio icono={Inbox} titulo={t("emptyTitle")} />
        ) : (
          <ListaCartas cartas={cartas} estudiantes={estudiantes} />
        )}
      </section>

      <section className="space-y-3">
        <p className="texto-titulo-seccion">{t("bySponsor", { mes })}</p>
        {porPatrocinador.length === 0 ? (
          <EstadoVacio icono={Mail} titulo={t("noSponsors")} />
        ) : (
          <ResumenPorPatrocinador filas={porPatrocinador} />
        )}
      </section>
    </div>
  );
}
