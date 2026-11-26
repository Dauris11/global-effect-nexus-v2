"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePermisos } from "@/components/layout/proveedor-permisos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROLES } from "@/lib/rbac";
import { enviarAviso, type EstadoAviso } from "@/server/notificaciones/acciones";

/** El evento con el que el acceso rápido del móvil abre este diálogo. */
export const EVENTO_ENVIAR_AVISO = "abrir-enviar-aviso";

const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-control h-11 w-full border bg-card px-3 text-base shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * Enviar un aviso desde el acceso rápido del teléfono. Vive en el armazón para
 * que el cajón pueda cerrarse y el diálogo seguir abierto. Solo se monta para
 * quien tiene `operaciones.escribir`; la acción lo vuelve a comprobar.
 */
export function DialogoEnviarAviso() {
  const permisos = usePermisos();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const abrir = () => setAbierto(true);

    window.addEventListener(EVENTO_ENVIAR_AVISO, abrir);

    return () => window.removeEventListener(EVENTO_ENVIAR_AVISO, abrir);
  }, []);

  if (!permisos?.has("operaciones.escribir")) return null;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent>
        <DialogHeader>
          <TituloAviso />
        </DialogHeader>
        {abierto && <FormularioAviso alTerminar={() => setAbierto(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TituloAviso() {
  const t = useTranslations("notify");

  return <DialogTitle>{t("title")}</DialogTitle>;
}

function FormularioAviso({ alTerminar }: { alTerminar: () => void }) {
  const t = useTranslations("notify");
  const tr = useTranslations("roles");
  const [estado, enviar, enviando] = useActionState<EstadoAviso, FormData>(enviarAviso, {
    estado: "inicial",
  });

  if (estado.estado === "ok") {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-medium text-[#1E9E6A]">
          <CheckCircle2 className="size-5" aria-hidden />
          {t("sent", { count: estado.enviados })}
        </p>
        <Button type="button" onClick={alTerminar}>
          {t("close")}
        </Button>
      </div>
    );
  }

  const errores: Record<string, string> = {
    no_permitido: t("errPermission"),
    vacio: t("errEmpty"),
    sin_destinatarios: t("errNobody"),
    error: t("errGeneric"),
  };

  return (
    <form action={enviar} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="aviso-audiencia">{t("audience")}</Label>
        <select id="aviso-audiencia" name="audiencia" defaultValue="personal" className={SELECT}>
          <option value="personal">{t("staff")}</option>
          {ROLES.map((rol) => (
            <option key={rol} value={`rol:${rol}`}>
              {tr(rol)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aviso-titulo">{t("subject")}</Label>
        <Input id="aviso-titulo" name="titulo" maxLength={120} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aviso-mensaje">{t("message")}</Label>
        <Textarea id="aviso-mensaje" name="mensaje" maxLength={500} rows={4} required />
      </div>

      {estado.estado !== "inicial" && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-[#B4342B]">
          <AlertCircle className="size-4" aria-hidden />
          {errores[estado.estado]}
        </p>
      )}

      <Button type="submit" cargando={enviando}>
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {t("send")}
      </Button>
    </form>
  );
}
