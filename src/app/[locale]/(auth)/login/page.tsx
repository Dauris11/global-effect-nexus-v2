import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CabeceraAcceso } from "@/components/auth/cabecera-acceso";
import { LoginForm, type ErrorFormulario } from "@/components/auth/login-form";
import { redirigir } from "@/i18n/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
import { destinoSeguro } from "@/lib/destino-seguro";
import { PORTAL_POR_ROL } from "@/lib/rbac";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return { title: t("signInTitle") };
}

/** Avisos que `/auth/callback` deja en `?error=` tras un Google que no pudo entrar. */
const ERRORES_DE_VUELTA: ErrorFormulario[] = ["oauth", "notRegistered", "inactive"];

/**
 * Acceso general: una sola puerta para todos los roles.
 *
 * Quien ya tiene sesión no ve el formulario: se le lleva a `?next=` (si es una ruta interna) o a su
 * portal. Sin esto, volver a `/login` con la sesión abierta mostraría un login que al enviarse
 * acabaría en el mismo sitio.
 *
 * El marco (foto, «Volver al inicio») es del layout; aquí solo va lo que cambia por pantalla.
 */
export default async function PaginaLogin({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { next, error } = await searchParams;
  const usuario = await obtenerUsuarioActual();
  const destino = destinoSeguro(next);

  if (usuario) redirigir(destino === "/inicio" ? PORTAL_POR_ROL[usuario.rol] : destino, locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const errorInicial = ERRORES_DE_VUELTA.find((e) => e === error);

  return (
    <div>
      <CabeceraAcceso titulo={t("signInHeading")} subtitulo={t("signInSubtitle")} />

      <div className="mt-8">
        <LoginForm destino={destino === "/inicio" ? undefined : destino} errorInicial={errorInicial} />
      </div>
    </div>
  );
}
