"use client";

import { useRef, useState } from "react";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Pide el enlace para crear una contraseña nueva.
 *
 * Responde SIEMPRE lo mismo, exista o no el correo y falle o no el envío (Supabase puede dar
 * 429 o un error de SMTP): cualquier diferencia le diría a un desconocido qué correos están
 * registrados. La única excepción es no tener red, que no depende del correo.
 *
 * Va por el cliente del navegador y no por una Server Action porque con PKCE el verificador
 * del código se guarda en una cookie de ESTE navegador, y `/recuperar/nueva` lo necesita para
 * canjear el enlace.
 */
export function RecuperarForm() {
  const t = useTranslations("auth");
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [sinRed, setSinRed] = useState(false);
  const refCorreo = useRef<HTMLInputElement>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSinRed(false);

    if (!correo.trim()) {
      refCorreo.current?.focus();

      return;
    }

    if (!navigator.onLine) {
      setSinRed(true);
      refCorreo.current?.focus();

      return;
    }

    setEnviando(true);

    try {
      await crearClienteNavegador().auth.resetPasswordForEmail(correo.trim(), {
        redirectTo: `${window.location.origin}/recuperar/nueva`,
      });
    } catch {
      // Se ignora a propósito: ver el comentario del componente.
    }

    setEnviando(false);
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="space-y-5">
        <Alert variant="info">
          <p>{t("recover.sent")}</p>
        </Alert>
        <Button asChild variant="secondary" className="h-12 w-full">
          <Link href="/login">{t("recover.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="space-y-4" noValidate>
      {sinRed && (
        <Alert variant="danger" className="auth-sacudida">
          <p>{t("offline")}</p>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="correo-recuperar">{t("emailLabel")}</Label>
        <Input
          ref={refCorreo}
          id="correo-recuperar"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </div>

      <Button type="submit" cargando={enviando} className="h-12 w-full">
        <Mail className="size-4" aria-hidden />
        {t("recover.send")}
      </Button>

      <p className="text-center text-body">
        <Link
          href="/login"
          className="rounded-sm font-semibold text-marca-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("recover.backToLogin")}
        </Link>
      </p>
    </form>
  );
}
