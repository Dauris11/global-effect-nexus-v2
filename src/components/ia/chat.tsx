"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, Info, Send, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AiOrb } from "@/components/ui/ai-orb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoChat } from "@/lib/ia";
import { cn } from "@/lib/utils";

export type MensajeVisible = {
  id: string;
  /** `user` o `assistant`; el ámbito `system` no llega hasta aquí. */
  rol: string;
  contenido: string;
  /** Ya formateada en el servidor, para no cargar date-fns en el navegador. */
  hora: string;
};

/**
 * Chat con el asistente. El mismo para el estudiante y para el equipo.
 *
 * Empezó siendo solo el del estudiante y ahora recibe su Server Action por
 * `accion`: son dos asistentes con dos contextos y dos permisos, pero una sola
 * conversación en pantalla. Duplicar este archivo habría sido duplicar el
 * desplazamiento al último mensaje, el indicador de "pensando" y los once
 * mensajes de error —y el segundo se habría quedado atrás en el primer arreglo—.
 *
 * La lista de mensajes se renderiza aquí y no en la página porque el indicador
 * de "pensando" tiene que aparecer al final de la conversación, y el estado de
 * envío solo existe en el cliente.
 *
 * El historial que se ve es el que devolvió el servidor: al responder, la
 * Server Action revalida la ruta y la lista llega actualizada. No se pinta la
 * pregunta de forma optimista a propósito — si la llamada al modelo falla, la
 * pregunta no se guarda, y haberla mostrado ya como enviada dejaría la pantalla
 * mintiendo.
 */
export function ChatIA({
  mensajes,
  maximo,
  accion,
  sugerencias = [],
  textos,
}: {
  mensajes: readonly MensajeVisible[];
  /** Tope de caracteres, calculado en el servidor. */
  maximo: number;
  /**
   * La Server Action que hace la pregunta.
   *
   * Llega como prop desde el servidor y no se importa aquí: es lo que permite
   * que el chat del estudiante y el del equipo compartan pantalla sin que este
   * archivo sepa de ninguno de los dos.
   */
  accion: (previo: EstadoChat, datos: FormData) => Promise<EstadoChat>;
  /**
   * Preguntas de ejemplo. Rellenan el campo, no envían.
   *
   * Enviar al pulsar habría sido un clic menos y una pregunta a la API por cada
   * roce accidental. Además, casi ninguna sugerencia se manda tal cual: se usa
   * de arranque y se remata a mano.
   */
  sugerencias?: readonly string[];
  textos: {
    placeholder: string;
    enviar: string;
    pensando: string;
    vacio: string;
    vacioPista: string;
    errorVacia: string;
    errorLarga: string;
    errorLimite: string;
    errorSinFicha: string;
    errorSinPermiso: string;
    errorSinClave: string;
    errorRechazada: string;
    error: string;
  };
}) {
  const [estado, enviar, enviando] = useActionState<EstadoChat, FormData>(
    accion,
    { estado: "inicial" },
  );

  const reducido = useReducedMotion() ?? false;
  const formulario = useRef<HTMLFormElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const finalDeLista = useRef<HTMLDivElement>(null);

  // Al recibir respuesta se limpia el campo. `useActionState` devuelve un objeto
  // nuevo en cada envío, así que el efecto vuelve a dispararse aunque el estado
  // sea "ok" dos veces seguidas.
  useEffect(() => {
    if (estado.estado === "ok") formulario.current?.reset();
  }, [estado]);

  // La conversación crece hacia abajo: tras cada cambio se baja al último
  // mensaje, que es lo que el estudiante acaba de pedir leer.
  useEffect(() => {
    finalDeLista.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length, enviando]);

  const mensaje = {
    inicial: null,
    ok: null,
    vacia: textos.errorVacia,
    larga: textos.errorLarga,
    limite: textos.errorLimite,
    sin_expediente: textos.errorSinFicha,
    sin_permiso: textos.errorSinPermiso,
    sin_clave: textos.errorSinClave,
    rechazada: textos.errorRechazada,
    error: textos.error,
  }[estado.estado];

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-70 space-y-3">
        {mensajes.length === 0 && !enviando && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AiOrb estado="idle" tamano="lg" />
            <p className="texto-titulo-tarjeta text-tinta mt-4">{textos.vacio}</p>
          </div>
        )}

        {mensajes.map((item) => {
          const mio = item.rol === "user";

          return (
            <motion.div
              key={item.id}
              initial={reducido ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn("flex", mio ? "justify-end" : "justify-start")}
            >
              {/* Lo mío en tinta y lo del asistente en gris, como en
                  cualquier mensajería: el acento se queda para el botón. */}
              <div
                className={cn(
                  "max-w-[80%] min-w-0 rounded-card px-4 py-2.5",
                  mio ? "bg-tinta text-background" : "bg-muted text-tinta",
                )}
              >
                {/* `whitespace-pre-wrap` conserva los saltos de línea que
                    escribe el modelo sin interpretar Markdown: pintar HTML a
                    partir de su salida sería otra decisión, y más riesgo. */}
                <p className="text-[15px] break-words whitespace-pre-wrap">
                  {item.contenido}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    mio ? "text-background/70" : "text-tinta-3",
                  )}
                >
                  {item.hora}
                </p>
              </div>
            </motion.div>
          );
        })}

        <AnimatePresence>
          {enviando && (
            <motion.div
              key="pensando"
              initial={reducido ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <AiOrb estado="thinking" tamano="md" />
              <p role="status" className="text-tinta-2 text-sm">
                {textos.pensando}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={finalDeLista} />
      </div>

      {/* El límite por hora es un aviso, no un fallo: azul claro con `Info`.
          Lo demás es un error y va en tinta con `AlertCircle` — nunca rojo
          (docs/09-sistema-visual.md §5). */}
      {mensaje && (
        <p
          role="alert"
          className={cn(
            "flex items-start gap-2 rounded-control px-4 py-3 text-sm font-medium",
            estado.estado === "limite"
              ? "bg-marca-50 text-marca-700"
              : "bg-tinta text-background",
          )}
        >
          {estado.estado === "limite" ? (
            <Info className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          {mensaje}
        </p>
      )}

      <form ref={formulario} action={enviar} className="space-y-2">
        {sugerencias.length > 0 && mensajes.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                onClick={() => {
                  if (!campo.current) return;

                  campo.current.value = sugerencia;
                  campo.current.focus();
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-linea-fuerte px-4 text-left text-sm text-tinta-2 outline-none transition-all duration-150 hover:border-tinta hover:text-tinta focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
              >
                <Sparkles className="size-4 shrink-0" />
                {sugerencia}
              </button>
            ))}
          </div>
        )}

        <Textarea
          ref={campo}
          name="pregunta"
          rows={3}
          maxLength={maximo}
          required
          placeholder={textos.placeholder}
          aria-label={textos.placeholder}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            cargando={enviando}
            className="w-full sm:w-auto"
          >
            {!enviando && <Send />}
            {enviando ? textos.pensando : textos.enviar}
          </Button>
        </div>
      </form>
    </div>
  );
}
