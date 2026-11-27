import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Cabecera } from "@/components/estudiante/cabecera";
import { ChatIA } from "@/components/ia/chat";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { Locale } from "@/i18n/routing";
import { requerirRol } from "@/lib/auth";
import { fechaConHora } from "@/lib/fechas";
import { MAXIMO_CARACTERES_PREGUNTA } from "@/lib/ia";
import {
  usuarioTienePermiso,
} from "@/lib/rbac";
import { preguntarAlAsistente } from "@/server/ia/acciones";
import {
  conversacionDelEstudiante,
  mensajesDeConversacion,
} from "@/server/ia/estudiante";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "studentPortal" });

  return { title: t("chat.title") };
}

/**
 * Chat del estudiante con el asistente de IA.
 *
 * El permiso `ia.usar` se comprueba aquí además de en la Server Action. En el
 * menú la entrada ya se filtra por ese permiso, pero la URL se puede escribir a
 * mano, y una pantalla que se abre para luego rechazar cada pregunta es peor que
 * una que explica de entrada que no está disponible.
 *
 * Sobre la privacidad: el aviso de la pantalla no es decorativo. El asistente
 * recibe las materias, las notas y los pendientes del estudiante para poder
 * responder, y él tiene derecho a saberlo. Lo que NO recibe es el expediente, y eso
 * también se dice.
 */
export default async function PaginaChatEstudiante({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma: Locale = locale === "en" ? "en" : "es";

  const usuario = await requerirRol(["estudiante"]);
  const t = await getTranslations({ locale, namespace: "studentPortal" });
  const tv = await getTranslations({ locale, namespace: "voice" });

  if (!usuarioTienePermiso(usuario, "ia.usar")) {
    return (
      <EstadoVacio
        icono={ShieldAlert}
        titulo={t("chat.forbidden")}
        className="mx-auto max-w-xl"
      />
    );
  }

  const conversacion = await conversacionDelEstudiante(usuario.id);
  const mensajes = conversacion
    ? await mensajesDeConversacion(conversacion, 30)
    : [];

  return (
    <div className="animate-entrada space-y-6">
      <Cabecera
        titulo={t("chat.title")}
      />

      <ChatIA
        idioma={idioma}
        voz={{
          iniciar: tv("start"),
          detener: tv("stop"),
          noSoportada: tv("notSupported"),
          modoActivar: tv("modeOn"),
          modoDesactivar: tv("modeOff"),
          leer: tv("read"),
          detenerLectura: tv("stopReading"),
          escuchando: tv("listening"),
          hablando: tv("speaking"),
          permiso: tv("permission"),
          sinVoz: tv("noSpeech"),
        }}
        accion={preguntarAlAsistente}
        maximo={MAXIMO_CARACTERES_PREGUNTA}
        mensajes={mensajes.map((mensaje) => ({
          id: mensaje.id,
          rol: mensaje.rol,
          contenido: mensaje.contenido,
          hora: fechaConHora(mensaje.created_at, null, idioma),
        }))}
        textos={{
          placeholder: t("chat.placeholder"),
          enviar: t("chat.send"),
          pensando: t("chat.thinking"),
          vacio: t("chat.empty"),
          errorVacia: t("chat.errorEmpty"),
          errorLarga: t("chat.errorTooLong"),
          errorLimite: t("chat.errorLimit"),
          errorSinFicha: t("noRecordHint"),
          errorSinPermiso: t("chat.forbidden"),
          errorSinClave: t("chat.errorNoKey"),
          errorRechazada: t("chat.errorRefused"),
          errorEntrada: t("chat.errorInput"),
          error: t("chat.error"),
        }}
      />
    </div>
  );
}
