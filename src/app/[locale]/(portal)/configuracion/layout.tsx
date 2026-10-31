import { BarraAjustes } from "@/components/configuracion/barra-ajustes";
import { requerirUsuario } from "@/lib/auth";
import { ajustesDeRol } from "@/lib/configuracion";

/**
 * Todas las pantallas de configuración llevan arriba la misma barra de iconos.
 * El layout solo filtra qué iconos ve cada rol; cada página sigue exigiendo su
 * propio rol o permiso, que es lo que de verdad cierra la puerta.
 */
export default async function LayoutConfiguracion({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirUsuario();
  const ajustes = ajustesDeRol(usuario.rol).map(({ clave, href }) => ({ clave, href }));

  return (
    <>
      {ajustes.length > 1 && <BarraAjustes ajustes={ajustes} />}
      {children}
    </>
  );
}
