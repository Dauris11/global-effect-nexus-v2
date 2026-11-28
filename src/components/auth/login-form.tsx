"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { GoogleLogo } from "@/components/auth/google-logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { mailtoSoporte } from "@/lib/contacto-soporte";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { iniciarSesion, type EstadoLogin, type ErrorLogin } from "@/server/auth/acciones";

/** Errores que además de los del servidor puede mostrar este formulario (Google, enlace de vuelta, sin red). */
export type ErrorFormulario = ErrorLogin | "oauth";

type ErrorMostrado = { clave: ErrorFormulario; intento: number; esperaS?: number };

const CLAVE_CORREO_RECORDADO = "ge_ultimo_correo";

/** localStorage puede faltar o lanzar (ventana privada, datos bloqueados): el formulario funciona igual sin él. */
function leerCorreoRecordado(): string {
  try {
    return window.localStorage.getItem(CLAVE_CORREO_RECORDADO) ?? "";
  } catch {
    return "";
  }
}

function recordarCorreo(correo: string) {
  try {
    if (correo) window.localStorage.setItem(CLAVE_CORREO_RECORDADO, correo);
  } catch {
    /* sin almacenamiento: no pasa nada, solo no se recuerda */
  }
}

/** Dominio del Workspace de la Fundación: opcional a propósito, no se inventa uno (ver `.env.example`). */
const DOMINIO_GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_HD;

/**
 * Formulario de acceso: Google primero, luego correo y contraseña.
 *
 * Google no puede ir por Server Action porque OAuth necesita una redirección del navegador
 * con su propio `state`; se lanza desde el cliente y vuelve por `/auth/callback`, que canjea
 * el código por sesión y respeta `next`.
 *
 * Los dos formatos de error se funden en uno solo (`mostrado`): el del servidor
 * (`estado.error`) y el local (Google, sin red, el aviso que trae la URL desde el callback).
 * Gana el local mientras exista, y se borra al volver a enviar. Cada aparición sacude el aviso
 * y manda el foco al campo culpable; el atributo `key` por intento reinicia la animación aunque
 * el error se repita.
 *
 * Los inputs son controlados: React 19 reinicia los campos no controlados al terminar la acción
 * de un `<form action>`, y el correo desaparecería justo cuando hay que corregir la contraseña.
 */
export function LoginForm({ destino, errorInicial }: { destino?: string; errorInicial?: ErrorFormulario }) {
  const t = useTranslations("auth");
  const [estado, enviar, enviando] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [mayusActivadas, setMayusActivadas] = useState(false);
  const [yendoAGoogle, setYendoAGoogle] = useState(false);
  const [errorLocal, setErrorLocal] = useState<ErrorMostrado | null>(
    errorInicial ? { clave: errorInicial, intento: 0 } : null,
  );
  const [descartado, setDescartado] = useState<number | null>(null);

  const refCorreo = useRef<HTMLInputElement>(null);
  const refClave = useRef<HTMLInputElement>(null);

  const mostrado: ErrorMostrado | null =
    errorLocal ??
    (estado.error && estado.intento !== descartado
      ? { clave: estado.error, intento: estado.intento ?? 0, esperaS: estado.esperaS }
      : null);

  // Correo recordado y foco inicial: en la contraseña si el correo ya viene puesto. Se lee en el
  // cliente porque en el servidor no hay localStorage; el relleno va en una microtarea para no
  // encadenar un render síncrono dentro del efecto.
  useEffect(() => {
    const recordado = leerCorreoRecordado();

    if (recordado) void Promise.resolve().then(() => setCorreo(recordado));
    (recordado ? refClave : refCorreo).current?.focus();
  }, []);

  // Foco en el campo culpable. Credenciales: la contraseña (se selecciona para reescribir);
  // cuenta/confirmación/conexión: el correo.
  const claveMostrada = mostrado?.clave;
  const intentoMostrado = mostrado?.intento;
  useEffect(() => {
    if (!claveMostrada) return;

    if (claveMostrada === "invalidCredentials") {
      refClave.current?.focus();
      refClave.current?.select();
    } else if (claveMostrada === "required") {
      (correo ? refClave : refCorreo).current?.focus();
    } else {
      refCorreo.current?.focus();
    }
    // Solo cuando aparece un error nuevo: teclear no debe robar el foco otra vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveMostrada, intentoMostrado]);

  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    recordarCorreo(correo.trim());
    setErrorLocal(null);

    // Sin red el envío fallaría con una excepción de la Server Action, no con un mensaje: se atrapa antes.
    if (!navigator.onLine) {
      evento.preventDefault();
      setErrorLocal({ clave: "offline", intento: Date.now() });
    }
  }

  async function entrarConGoogle() {
    setErrorLocal(null);

    if (!navigator.onLine) {
      setErrorLocal({ clave: "offline", intento: Date.now() });

      return;
    }

    setYendoAGoogle(true);

    const supabase = crearClienteNavegador();
    const siguiente = destino ? `?next=${encodeURIComponent(destino)}` : "";
    const consulta: Record<string, string> = {};

    // `hd` solo orienta el selector de cuentas de Google; el acceso lo manda la tabla `usuario`.
    if (DOMINIO_GOOGLE) consulta.hd = DOMINIO_GOOGLE;
    if (correo.includes("@")) consulta.login_hint = correo.trim();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${siguiente}`, queryParams: consulta },
    });

    if (error) {
      setErrorLocal({ clave: "oauth", intento: Date.now() });
      setYendoAGoogle(false);
    }
  }

  const invalidaClave = mostrado?.clave === "invalidCredentials";
  const invalidaCorreo = mostrado ? ["notRegistered", "inactive", "unconfirmed"].includes(mostrado.clave) : false;

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full"
        onClick={entrarConGoogle}
        cargando={yendoAGoogle}
        disabled={enviando}
      >
        <GoogleLogo className="size-[18px]" />
        {t("continueWithGoogle")}
      </Button>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-linea" />
        <span className="text-meta text-tinta-3">{t("orEmail")}</span>
        <span className="h-px flex-1 bg-linea" />
      </div>

      <form action={enviar} onSubmit={alEnviar} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={destino ?? ""} />

        {mostrado && (
          <Alert key={mostrado.intento} id="error-login" variant="danger" className="auth-sacudida">
            <p>{t(mostrado.clave)}</p>
            {mostrado.clave === "tooManyAttempts" && mostrado.esperaS ? (
              <CuentaAtras
                key={mostrado.intento}
                inicio={mostrado.esperaS}
                alTerminar={() => (errorLocal ? setErrorLocal(null) : setDescartado(estado.intento ?? null))}
              />
            ) : null}
            {(mostrado.clave === "notRegistered" || mostrado.clave === "unconfirmed") && (
              <Button asChild variant="secondary" size="sm" className="mt-2.5">
                {/* Sin acción de servidor segura para reenviar invitaciones: el botón lleva al correo de soporte. */}
                <a href={mailtoSoporte(t("supportSubject"))}>
                  {mostrado.clave === "notRegistered" ? t("writeSupport") : t("resendInvite")}
                </a>
              </Button>
            )}
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            ref={refCorreo}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            aria-invalid={invalidaCorreo || undefined}
            aria-describedby={invalidaCorreo ? "error-login" : undefined}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">{t("password")}</Label>
            <Link
              href="/recuperar"
              className="rounded-sm text-label font-semibold text-marca-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("forgot")}
            </Link>
          </div>
          <div className="relative">
            <Input
              ref={refClave}
              id="password"
              name="password"
              type={verClave ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-12"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => setMayusActivadas(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setMayusActivadas(e.getModifierState("CapsLock"))}
              onBlur={() => setMayusActivadas(false)}
              aria-invalid={invalidaClave || undefined}
              aria-describedby={invalidaClave ? "error-login" : undefined}
            />
            <button
              type="button"
              onClick={() => setVerClave((valor) => !valor)}
              aria-pressed={verClave}
              aria-label={t("showPassword")}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-tinta-2 transition-colors hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {verClave ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {mayusActivadas && (
            <p role="status" className="text-meta font-medium text-tinta-2">
              {t("capsLock")}
            </p>
          )}
        </div>

        <Button type="submit" cargando={enviando} disabled={yendoAGoogle} className="h-12 w-full">
          {t("signIn")}
        </Button>
      </form>

      <p className="pt-1 text-center text-body text-tinta-2">
        {t("noAccess")}{" "}
        <a
          href={mailtoSoporte(t("accessSubject"))}
          className="rounded-sm font-semibold text-marca-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("requestAccess")}
        </a>
      </p>
    </div>
  );
}

/**
 * Cuenta atrás visible del bloqueo por exceso de intentos. Es solo apoyo visual (`aria-hidden`):
 * el texto del aviso ya dice «espera 1 minuto», y un lector de pantalla no debe leer un cambio por segundo.
 */
function CuentaAtras({ inicio, alTerminar }: { inicio: number; alTerminar: () => void }) {
  const t = useTranslations("auth");
  const [resta, setResta] = useState(inicio);

  useEffect(() => {
    if (resta <= 0) {
      alTerminar();

      return;
    }

    const id = window.setTimeout(() => setResta((r) => r - 1), 1000);

    return () => window.clearTimeout(id);
    // `alTerminar` cambia en cada render del padre; solo importa el segundo que corre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resta]);

  return (
    <p aria-hidden className="mt-1 text-meta tabular-nums">
      {t("retryIn", { segundos: resta })}
    </p>
  );
}
