import type { Metadata } from "next";
import { Bot, Lock, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ChatIA } from "@/components/ia/chat";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { requerirUsuario } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { MAXIMO_CARACTERES_PREGUNTA } from "@/lib/ia";
import { tienePermiso } from "@/lib/rbac";
import { preguntarAlAsistenteInterno } from "@/server/ia/acciones-interno";
import {
  conversacionInterna,
  mensajesInternos,
} from "@/server/ia/interno";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aiChat" });

  return { title: t("title") };
}

/**
 * Chat interno del equipo con el asistente.
 *
 * `ia.usar` se comprueba aquí además de en la Server Action. En el menú la
 * entrada ya se filtra por ese permiso, pero la URL se escribe a mano, y una
 * pantalla que se abre para luego rechazar cada pregunta es peor que una que
 * explica de entrada que no está disponible.
 *
 * El aviso de la pantalla no es decorativo, y dice las dos cosas que hay que
 * saber:
 *
 *   · **Qué ve el asistente**: cifras agregadas de la Fundación, recortadas por
 *     los permisos de quien pregunta. Ni un nombre, ni un expediente.
 *   · **Qué no ve, nunca**: personas. Ni nombres, ni expedientes, ni notas
 *     concretas; para eso están las pantallas, que registran quién consultó.
 *
 * Es la misma pantalla que el chat del estudiante (`@/components/ia/chat`), con
 * otra acción y otro contexto: dos asistentes, una conversación.
 */
export default async function PaginaChatIA({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirUsuario();
  const t = await getTranslations({ locale, namespace: "aiChat" });

  if (!tienePermiso(usuario.rol, "ia.usar")) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#2096BA]/10 text-[#187a99]">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{t("forbidden")}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("forbiddenHint")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const conversacion = await conversacionInterna(usuario.id);
  const mensajes = conversacion
    ? await mensajesInternos(conversacion, 30)
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-[#2096BA] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Bot className="size-5 text-[#2096BA]" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("description")}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Lock className="mt-0.5 size-4 shrink-0 text-slate-500" />
        <p className="text-xs text-slate-600">{t("privacy")}</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <ChatIA
            accion={preguntarAlAsistenteInterno}
            maximo={MAXIMO_CARACTERES_PREGUNTA}
            sugerencias={[
              t("prompt.balance"),
              t("prompt.projects"),
              t("prompt.academic"),
              t("prompt.tasks"),
              t("prompt.summary"),
            ]}
            mensajes={mensajes.map((mensaje) => ({
              id: mensaje.id,
              rol: mensaje.rol,
              contenido: mensaje.contenido,
              hora: fechaConHora(mensaje.created_at, null, idioma),
            }))}
            textos={{
              placeholder: t("placeholder"),
              enviar: t("send"),
              pensando: t("thinking"),
              vacio: t("empty"),
              vacioPista: t("emptyHint"),
              errorVacia: t("errorEmpty"),
              errorLarga: t("errorTooLong"),
              errorLimite: t("errorLimit"),
              // No hay caso de "sin ficha" en el chat interno —quien pregunta
              // es una cuenta del equipo, no un expediente—, pero el
              // componente es el mismo y su tipo lo pide. Se le da el error
              // genérico en vez de un texto que no puede aparecer.
              errorSinFicha: t("error"),
              errorSinPermiso: t("forbidden"),
              errorSinClave: t("errorNoKey"),
              errorRechazada: t("errorRefused"),
              error: t("error"),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
