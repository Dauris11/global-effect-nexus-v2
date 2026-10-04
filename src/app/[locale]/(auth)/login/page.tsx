import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/login-form";
import { Link, redirigir } from "@/i18n/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";
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

/**
 * Acceso general: una sola puerta para los seis portales.
 *
 * Quien ya tiene sesión no ve el formulario, se le lleva a su portal. Sin esto,
 * volver a `/login` con la sesión abierta mostraría un login que al enviarse
 * acabaría en el mismo sitio.
 *
 * La tarjeta es la de login de la norma (docs/09 §2.5–2.6): `rounded-hoja` y
 * `shadow-elevada`, con el logo arriba y un solo titular. Aquí llegó a haber un
 * rótulo, un titular, una explicación de los seis portales, la lista de roles y
 * un aviso de invitación: cinco textos para un formulario de dos campos. Queda
 * el único que resuelve algo: a quién pedirle el acceso si no lo tienes.
 */
export default async function PaginaLogin({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await obtenerUsuarioActual();

  if (usuario) redirigir(PORTAL_POR_ROL[usuario.rol], locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const tComun = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="rounded-hoja border border-linea bg-card p-6 shadow-elevada sm:p-10">
      <Link
        href="/"
        aria-label={tComun("foundation")}
        className="block w-fit rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Image
          src="/logo.webp"
          alt={tComun("foundation")}
          width={720}
          height={157}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <h1 className="mt-8 text-[26px] leading-tight font-semibold tracking-tight text-tinta">
        {t("signInHeading")}
      </h1>

      <div className="mt-6">
        <LoginForm />
      </div>

      <p className="texto-meta mt-8 border-t border-linea pt-5 text-center">
        {t("needAccess")}
      </p>
    </div>
  );
}
