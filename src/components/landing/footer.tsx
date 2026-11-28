import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { ENTIDAD } from "@content/entidad";

import { CONTENEDOR } from "@/components/landing/piezas";
import { Link } from "@/i18n/navigation";

/**
 * Pie de la landing: una sola fila de enlaces legales y de contacto sobre
 * `bg-muted`, el único fondo gris de la página porque marca que terminó.
 *
 * Privacidad, Términos y Cookies son páginas reales (`(legal)`): la Ley 172-13
 * exige poder consultar cómo se tratan los datos antes de entregarlos.
 *
 * `secciones` es opcional y solo se conserva para quien ya lo pasa: el pie
 * actual no lista anclas, pero quitarlo del tipo rompería esas llamadas.
 */
export async function Footer(_props: { secciones?: readonly { ancla: string; texto: string }[] } = {}) {
  void _props;
  const t = await getTranslations("landingPie");
  const tComun = await getTranslations("common");
  const anio = new Date().getFullYear();

  return (
    <footer className="border-t border-linea bg-muted">
      <div className={`${CONTENEDOR} flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-col gap-3">
          <Image
            src="/logo-white.webp"
            alt={tComun("foundation")}
            width={140}
            height={38}
            // El logo es blanco: sobre el gris claro se pasa a negro.
            className="h-9 w-auto self-start brightness-0 dark:brightness-100"
          />
          <p className="texto-meta">
            © {anio} {tComun("foundation")} · {t("ubicacion")}
          </p>
        </div>

        <nav aria-label={tComun("foundation")}>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li>
              <Link href="/privacidad" className={CLASE_ENLACE}>
                {t("privacidad")}
              </Link>
            </li>
            <li>
              <Link href="/terminos" className={CLASE_ENLACE}>
                {t("terminos")}
              </Link>
            </li>
            <li>
              <Link href="/cookies" className={CLASE_ENLACE}>
                {t("cookies")}
              </Link>
            </li>
            <li>
              <a href={`mailto:${ENTIDAD.correo}`} className={CLASE_ENLACE}>
                {t("contacto")}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/** Enlace del pie: 44 px de alto para el dedo, aunque el texto sea pequeño. */
const CLASE_ENLACE =
  "inline-flex min-h-11 items-center rounded-control text-sm text-tinta-2 underline-offset-4 transition-colors hover:text-tinta hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
