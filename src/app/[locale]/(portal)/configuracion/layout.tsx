import { getTranslations } from "next-intl/server";

import { BarraAjustes } from "@/components/configuracion/barra-ajustes";
import { requerirUsuario } from "@/lib/auth";
import { ajustesDeUsuario } from "@/lib/configuracion";

/**
 * Todas las pantallas de configuración llevan a la izquierda el mismo menú de
 * ajustes. El layout solo filtra qué entradas ve cada rol; cada página sigue
 * exigiendo su propio rol o permiso, que es lo que de verdad cierra la puerta.
 */
export default async function LayoutConfiguracion({
  children,
}: {
  children: React.ReactNode;
}) {
  const [usuario, t] = await Promise.all([requerirUsuario(), getTranslations("settings.nav")]);
  const ajustes = ajustesDeUsuario(usuario).map(({ clave, href }) => ({
    clave,
    href,
    etiqueta: t(clave),
  }));

  if (ajustes.length <= 1) return children;

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <div className="md:w-52 md:shrink-0">
        <BarraAjustes titulo={t("label")} ajustes={ajustes} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
