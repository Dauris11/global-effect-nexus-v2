"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { crearClienteNavegador } from "@/lib/supabase/client";

/**
 * Elegir la contraseña la primera vez. El enlace del correo trae la sesión temporal en
 * la dirección (`#access_token=…`); se activa aquí y la contraseña se guarda con ella.
 */
export function EstablecerClave() {
  const t = useTranslations("auth.setPassword");
  const router = useRouter();
  const [listo, setListo] = useState<"cargando" | "si" | "no">("cargando");
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.hash.slice(1));
    const acceso = parametros.get("access_token");
    const refresco = parametros.get("refresh_token");

    if (!acceso || !refresco) {
      void Promise.resolve().then(() => setListo("no"));

      return;
    }

    void crearClienteNavegador()
      .auth.setSession({ access_token: acceso, refresh_token: refresco })
      .then(({ error: e }) => {
        // Se borra la dirección: la sesión no debe quedar a la vista ni en el historial.
        window.history.replaceState(null, "", window.location.pathname);
        setListo(e ? "no" : "si");
      });
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (clave.length < 8) return setError(t("tooShort"));
    if (clave !== repetida) return setError(t("mismatch"));

    setGuardando(true);

    const supabase = crearClienteNavegador();
    const { error: fallo } = await supabase.auth.updateUser({ password: clave });

    if (fallo) {
      setGuardando(false);

      return setError(t("error"));
    }

    // Se cierra la sesión temporal: entra con su contraseña nueva, como siempre.
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (listo === "cargando") return <Loader2 className="size-5 animate-spin" aria-label={t("loading")} />;

  if (listo === "no") {
    return (
      <p role="alert" className={ALERTA_RIESGO.contenedor}>
        <AlertCircle className={ALERTA_RIESGO.icono} />
        <span className={ALERTA_RIESGO.texto}>{t("expired")}</span>
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void guardar(e)} className="space-y-4">
      <p className="texto-meta">{t("intro")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="clave-nueva">{t("password")}</Label>
        <Input id="clave-nueva" type="password" autoComplete="new-password" required minLength={8} value={clave} onChange={(e) => setClave(e.target.value)} />
        <p className="texto-meta">{t("hint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="clave-repetida">{t("repeat")}</Label>
        <Input id="clave-repetida" type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>{error}</span>
        </p>
      )}
      <Button type="submit" cargando={guardando} className="w-full">
        {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("save")}
      </Button>
    </form>
  );
}
