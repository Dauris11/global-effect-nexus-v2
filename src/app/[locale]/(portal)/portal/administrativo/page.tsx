import { redirigir } from "@/i18n/navigation";
import { requerirUsuario } from "@/lib/auth";
import { PORTAL_POR_ROL } from "@/lib/rbac";

/**
 * `/portal/administrativo` ya no es una pantalla: la bandeja la sustituyó. La ruta se queda
 * como redirección para no romper marcadores ni enlaces guardados. El
 * `requerirRol` lo aplica la bandeja al llegar.
 */
export default async function PortalAdministrativoAntiguo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Cada rol a su inicio: super_admin al tablero ejecutivo, admin a la bandeja.
  const usuario = await requerirUsuario();

  redirigir(usuario.rol === "super_admin" ? PORTAL_POR_ROL.super_admin : "/bandeja", locale);
}
