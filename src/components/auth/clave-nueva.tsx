"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { fortalezaDeClave, LARGO_MINIMO_CLAVE, requisitosDeClave } from "@/lib/fortaleza-clave";
import { crearClienteNavegador } from "@/lib/supabase/client";

type EstadoEnlace = "comprobando" | "valido" | "invalido";

/**
 * Contraseña nueva tras el correo «Reset password».
 *
 * El enlace llega con `?code=` (PKCE, el flujo del cliente del navegador) o, en las invitaciones
 * antiguas, con `#access_token` en el hash. Se prueban los dos y al final lo que decide es si
 * hay sesión: el cliente de Supabase puede haber canjeado el código él solo al iniciarse
 * (`detectSessionInUrl`), y entonces el canje manual falla pero la sesión ya existe.
 *
 * Solo el largo mínimo bloquea el guardado; mayúsculas, número y símbolo alimentan el medidor
 * y la lista de requisitos, que son una guía (los requisitos NIST priorizan el largo).
 */
export function ClaveNueva() {
  const t = useTranslations("auth.newPassword");
  const router = useRouter();
  const avisar = useToast();
  const [enlace, setEnlace] = useState<EstadoEnlace>("comprobando");
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<"tooShort" | "mismatch" | "error" | null>(null);
  const [guardando, setGuardando] = useState(false);
  const refClave = useRef<HTMLInputElement>(null);
  const refRepetida = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;

    async function activar() {
      const supabase = crearClienteNavegador();
      const parametros = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const codigo = parametros.get("code");
      const acceso = hash.get("access_token");
      const refresco = hash.get("refresh_token");

      if (codigo) await supabase.auth.exchangeCodeForSession(codigo).catch(() => null);
      else if (acceso && refresco) await supabase.auth.setSession({ access_token: acceso, refresh_token: refresco }).catch(() => null);

      // La sesión no debe quedar a la vista ni en el historial.
      if (codigo || acceso) window.history.replaceState(null, "", window.location.pathname);

      const { data } = await supabase.auth.getSession();

      if (vivo) setEnlace(data.session ? "valido" : "invalido");
    }

    void activar();

    return () => {
      vivo = false;
    };
  }, []);

  const requisitos = requisitosDeClave(clave);
  const fortaleza = fortalezaDeClave(clave);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    if (clave.length < LARGO_MINIMO_CLAVE) {
      setError("tooShort");
      refClave.current?.focus();

      return;
    }

    if (clave !== repetida) {
      setError("mismatch");
      refRepetida.current?.focus();

      return;
    }

    setGuardando(true);

    const { error: fallo } = await crearClienteNavegador().auth.updateUser({ password: clave });

    if (fallo) {
      setGuardando(false);
      setError("error");

      return;
    }

    avisar({ titulo: t("saved") });
    // La sesión del enlace ya vale como acceso: va directo a `/inicio`, que vuelve a comprobar el rol.
    router.push("/inicio");
    router.refresh();
  }

  if (enlace === "comprobando") {
    return (
      <div role="status" className="flex items-center gap-2 text-body text-tinta-2">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("loading")}
      </div>
    );
  }

  if (enlace === "invalido") {
    return (
      <div className="space-y-4">
        <Alert variant="danger">
          <p>{t("expired")}</p>
        </Alert>
        <Button asChild variant="secondary" className="h-12 w-full">
          <Link href="/recuperar">{t("requestNew")}</Link>
        </Button>
      </div>
    );
  }

  const lista: { cumplido: boolean; texto: string }[] = [
    { cumplido: requisitos.largo, texto: t("reqLength") },
    { cumplido: requisitos.mayusMinus, texto: t("reqCase") },
    { cumplido: requisitos.numero, texto: t("reqNumber") },
    { cumplido: requisitos.simbolo, texto: t("reqSymbol") },
  ];
  const tipo = ver ? "text" : "password";

  return (
    <form onSubmit={(e) => void guardar(e)} className="space-y-4" noValidate>
      {error && (
        <Alert variant="danger" className="auth-sacudida">
          <p>{t(error)}</p>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="clave-nueva">{t("password")}</Label>
        <div className="relative">
          <Input
            ref={refClave}
            id="clave-nueva"
            type={tipo}
            autoComplete="new-password"
            required
            autoFocus
            className="pr-12"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            aria-invalid={error === "tooShort" || undefined}
            aria-describedby="requisitos-clave"
          />
          <button
            type="button"
            onClick={() => setVer((valor) => !valor)}
            aria-pressed={ver}
            aria-label={t("show")}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-control text-tinta-2 transition-colors hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {ver ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <div
            role="meter"
            aria-label={t("strength")}
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={fortaleza}
            aria-valuetext={t(`strength${fortaleza}`)}
            className="flex flex-1 gap-1"
          >
            {[1, 2, 3, 4].map((tramo) => (
              <span key={tramo} className={`h-1.5 flex-1 rounded-full ${fortaleza >= tramo ? "bg-marca-500" : "bg-linea"}`} />
            ))}
          </div>
          <span className="w-20 shrink-0 text-right text-meta font-medium text-tinta-2">{clave ? t(`strength${fortaleza}`) : ""}</span>
        </div>

        <ul id="requisitos-clave" aria-label={t("requirements")} className="space-y-1 pt-1">
          {lista.map((r) => (
            <li key={r.texto} className="flex items-center gap-2 text-meta text-tinta-2">
              {r.cumplido ? <Check className="size-3.5 text-marca-700" aria-hidden /> : <Circle className="size-3.5 text-tinta-3" aria-hidden />}
              <span className={r.cumplido ? "text-tinta" : undefined}>{r.texto}</span>
              <span className="sr-only">{r.cumplido ? t("met") : t("pending")}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clave-repetida">{t("confirm")}</Label>
        <Input
          ref={refRepetida}
          id="clave-repetida"
          type={tipo}
          autoComplete="new-password"
          required
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          aria-invalid={error === "mismatch" || undefined}
        />
      </div>

      <Button type="submit" cargando={guardando} className="h-12 w-full">
        <Save className="size-4" aria-hidden />
        {t("save")}
      </Button>
    </form>
  );
}
