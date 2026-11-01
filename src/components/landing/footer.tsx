import Image from "next/image";
import { Mail, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { parametros } from "@/server/parametros/consultas";

import { CONTENEDOR } from "@/components/landing/piezas";
import { Link } from "@/i18n/navigation";

/**
 * Pie institucional en columnas sobre `bg-muted`, como el de Airbnb: el único
 * fondo gris de la landing, porque marca que la página terminó.
 *
 * Sin redes sociales: el inventario las pedía, pero no hay ninguna cuenta
 * registrada en el proyecto y unos iconos que no llevan a ningún sitio son
 * peor que su ausencia. Cuando existan, van aquí.
 */
export async function Footer({ secciones }: { secciones: readonly { ancla: string; texto: string }[] }) {
  const t = await getTranslations("landing");
  const tComun = await getTranslations("common");
  const correo = (await parametros())["contacto.correo"];
  const anio = new Date().getFullYear();

  return (
    <footer className="border-t border-linea bg-muted">
      <div className={`${CONTENEDOR} py-12`}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <Image
              src="/logo-white.webp"
              alt={tComun("foundation")}
              width={140}
              height={38}
              // El logo es blanco: sobre el gris claro se pasa a negro.
              className="h-9 w-auto brightness-0 dark:brightness-100"
            />
            <p className="mt-4 text-sm text-tinta-2">{t("footerTagline")}</p>
            <p className="texto-meta mt-1">{t("footerTagline2")}</p>
          </div>

          <Columna titulo={t("footerThisPage")}>
            {secciones.map((seccion) => (
              <li key={seccion.ancla}>
                <a href={`#${seccion.ancla}`} className={CLASE_ENLACE}>
                  {seccion.texto}
                </a>
              </li>
            ))}
          </Columna>

          <Columna titulo={t("footerAccess")}>
            <li>
              <Link href="/login" className={CLASE_ENLACE}>
                {t("access_portal_title")}
              </Link>
            </li>
            <li>
              <Link href="/comida" className={CLASE_ENLACE}>
                {t("access_meals_title")}
              </Link>
            </li>
            <li>
              <Link href="/transporte" className={CLASE_ENLACE}>
                {t("access_transport_title")}
              </Link>
            </li>
            <li>
              <Link href="/portal/estudiante/solicitudes" className={CLASE_ENLACE}>
                {t("access_requests_title")}
              </Link>
            </li>
            <li className="texto-meta pt-1">{t("footerAccessNote")}</li>
          </Columna>

          <Columna titulo={t("footerContact")}>
            <li className="flex items-center gap-2 py-2 text-sm text-tinta-2">
              <MapPin className="size-4 shrink-0" />
              {t("footerAddress")}
            </li>
            <li>
              <a href={`mailto:${correo}`} className={`${CLASE_ENLACE} gap-2`}>
                <Mail className="size-4 shrink-0" />
                {correo}
              </a>
            </li>
          </Columna>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-linea-fuerte pt-6">
          <p className="texto-meta">
            © {anio} {tComun("foundation")}. {t("footerRights")}
          </p>
          <p className="texto-meta">{t("footerVersion")}</p>
        </div>
      </div>
    </footer>
  );
}

/** Enlace del pie: 44 px de alto para el dedo, aunque el texto sea pequeño. */
const CLASE_ENLACE =
  "inline-flex min-h-11 items-center text-sm text-tinta-2 underline-offset-4 transition-colors hover:text-tinta hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-control";

function Columna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-tinta">{titulo}</p>
      <ul className="mt-2">{children}</ul>
    </div>
  );
}
