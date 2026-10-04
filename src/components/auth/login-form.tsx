"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { iniciarSesion, type EstadoLogin } from "@/server/auth/acciones";

/**
 * Formulario de acceso: correo y contraseña, más Google.
 *
 * Google no puede ir por Server Action porque OAuth necesita una redirección
 * del navegador con su propio `state`; se lanza desde el cliente y vuelve por
 * `/auth/callback`, que canjea el código por sesión.
 *
 * El correo va primero y Google debajo del separador: el acceso es por
 * invitación y casi todas las cuentas entran con contraseña, así que el camino
 * común es el primario a ancho completo y Google queda como alternativa
 * (`secondary`), no como el botón que se pulsa sin pensar.
 *
 * La contraseña tiene botón de ver: se teclea a ciegas en un móvil y equivocarse
 * cuesta un intento fallido y un mensaje de error. El botón es `tabIndex={-1}`
 * para no meterse entre el campo y el botón de entrar al tabular.
 */
export function LoginForm({ destino }: { destino?: string }) {
  const t = useTranslations("auth");
  const [estado, enviar, enviando] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    {},
  );
  const [errorGoogle, setErrorGoogle] = useState(false);
  const [yendoAGoogle, setYendoAGoogle] = useState(false);
  const [verClave, setVerClave] = useState(false);

  async function entrarConGoogle() {
    setErrorGoogle(false);
    setYendoAGoogle(true);

    const supabase = crearClienteNavegador();
    const siguiente = destino ? `?next=${encodeURIComponent(destino)}` : "";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${siguiente}`,
      },
    });

    if (error) {
      setErrorGoogle(true);
      setYendoAGoogle(false);
    }
  }

  return (
    <div className="space-y-5">
      <form action={enviar} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            aria-invalid={estado.error === "invalidCredentials" || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t("password")}</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={verClave ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-12"
              aria-invalid={estado.error === "invalidCredentials" || undefined}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVerClave((valor) => !valor)}
              aria-label={verClave ? t("hidePassword") : t("showPassword")}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-tinta-2 transition-colors hover:text-tinta"
            >
              {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {estado.error && <AvisoError>{t(estado.error)}</AvisoError>}

        <Button
          type="submit"
          size="lg"
          cargando={enviando}
          disabled={yendoAGoogle}
          className="w-full"
        >
          {t("signIn")}
        </Button>
      </form>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-linea" />
        <span className="texto-meta">{t("or")}</span>
        <span className="h-px flex-1 bg-linea" />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={entrarConGoogle}
        cargando={yendoAGoogle}
        disabled={enviando}
      >
        {t("continueWithGoogle")}
      </Button>

      {errorGoogle && <AvisoError>{t("oauth")}</AvisoError>}
    </div>
  );
}

/**
 * Error del acceso: tinta sólida con su icono, nunca rojo (docs/09 §5). El
 * peso basta para que se vea, y el icono para que se entienda en gris.
 */
function AvisoError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-control bg-tinta px-4 py-3 text-sm text-background"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
