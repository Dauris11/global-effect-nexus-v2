"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, HelpCircle, Lock, Mic, MicOff, RotateCcw, Send, Sparkles, X, Zap } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import {
  estadoEnVivo,
  MensajeIA,
  PasosYTarjetas,
  type MensajeLocal,
  type PasoVisible,
} from "@/components/ia/mensaje-ia";
import { MedidorConsumo, type ConsumoVisible } from "@/components/ia/medidor-consumo";
import type { TarjetaAccion } from "@/components/ia/tarjeta-accion";
import { AiOrb, type EstadoOrbe } from "@/components/ui/ai-orb";
import { useRouter } from "@/i18n/navigation";
import { leerFlujo } from "@/lib/ia-eventos";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  enviarMensajeWidget,
  limpiarHistorialWidget,
  obtenerHistorialWidget,
  sugerirNavegacion,
  type AccionSugerida,
  type MensajeWidget,
  type ModoAgente,
} from "@/server/ia/asistente-global";
import { miConsumoIA } from "@/server/ia/aprobaciones";

/** Estado del orbe → clave de `widgetIA.orbe` (next-intl no admite guiones raros en claves). */
const CLAVE_ORBE: Record<EstadoOrbe, string> = {
  idle: "listo",
  listening: "escuchando",
  thinking: "pensando",
  reasoning: "razonando",
  "tool-call": "usandoHerramienta",
  "tool-result": "leyendoResultado",
  streaming: "escribiendo",
  "waiting-approval": "esperandoAprobacion",
  error: "error",
  done: "hecho",
};

/** Error del servidor → clave de `widgetIA`. Lo que no esté, es genérico. */
const ERRORES: Record<string, string> = {
  cuota: "errorCuota",
  limite: "errorLimite",
  inactivo: "errorInactivo",
  mensajeLargo: "errorLargo",
};

// Definición de tipos para Web Speech API
interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function WidgetFlotanteIA({
  usuario,
}: {
  usuario: {
    id: string;
    nombre: string;
    rol: Rol;
    idioma: "es" | "en";
  };
}) {
  const t = useTranslations("widgetIA");
  const router = useRouter();
  const reducido = useReducedMotion() ?? false;

  const esEstudiante = usuario.rol === "estudiante";

  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<ModoAgente>("consultas");
  const [mensajes, setMensajes] = useState<MensajeLocal[]>([]);
  const [enVivo, setEnVivo] = useState<MensajeLocal | null>(null);
  const [consumo, setConsumo] = useState<ConsumoVisible | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [textoEntrada, setTextoEntrada] = useState("");
  const [errorAlerta, setErrorAlerta] = useState<string | null>(null);

  // Estados del comando de voz
  const [grabandoVoz, setGrabandoVoz] = useState(false);
  const [soportaVoz] = useState(() => {
    if (typeof window === "undefined") return true;
    return Boolean(
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ||
        (
          window as unknown as {
            webkitSpeechRecognition?: SpeechRecognitionConstructor;
          }
        ).webkitSpeechRecognition,
    );
  });
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const historialCargadoRef = useRef(false);

  const finalMensajesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleAbierto = () => {
    setAbierto((prev) => {
      const nuevo = !prev;
      if (nuevo) void miConsumoIA().then(setConsumo).catch(() => {});

      if (nuevo && !historialCargadoRef.current) {
        historialCargadoRef.current = true;
        setCargandoHistorial(true);
        obtenerHistorialWidget()
          .then((datos) => {
            setMensajes(datos);
          })
          .catch(() => {})
          .finally(() => {
            setCargandoHistorial(false);
          });
      }
      return nuevo;
    });
  };

  // Desplazar al último mensaje automáticamente
  useEffect(() => {
    if (abierto) {
      finalMensajesRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes.length, enviando, abierto]);

  // Listener para invocar el widget desde acciones rápidas o atajos
  useEffect(() => {
    const handleAbrir = () => {
      setAbierto(true);
      void miConsumoIA().then(setConsumo).catch(() => {});
      if (!historialCargadoRef.current) {
        historialCargadoRef.current = true;
        setCargandoHistorial(true);
        obtenerHistorialWidget()
          .then((datos) => setMensajes(datos))
          .catch(() => {})
          .finally(() => setCargandoHistorial(false));
      }
    };
    window.addEventListener("abrir-widget-ia", handleAbrir);
    return () => window.removeEventListener("abrir-widget-ia", handleAbrir);
  }, []);

  // Inicializar Web Speech API para comandos de voz
  useEffect(() => {
    if (typeof window === "undefined" || !soportaVoz) return;

    const SpeechClass =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition;

    if (!SpeechClass) return;

    try {
      const recognition = new SpeechClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = usuario.idioma === "en" ? "en-US" : "es-DO";

      recognition.onresult = (evento: SpeechRecognitionEventLike) => {
        const transcripcion = Array.from({ length: 1 }, (_, i) => evento.results[i])
          .map((r) => r[0].transcript)
          .join("");

        setTextoEntrada(transcripcion);
      };

      recognition.onerror = () => {
        setGrabandoVoz(false);
      };

      recognition.onend = () => {
        setGrabandoVoz(false);
      };

      recognitionRef.current = recognition;
    } catch {
      // Ignorar fallo de inicio de audio
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, [soportaVoz, usuario.idioma]);

  const toggleGrabacionVoz = () => {
    if (!recognitionRef.current) {
      setErrorAlerta(t("vozNoSoportada"));
      return;
    }

    setErrorAlerta(null);

    if (grabandoVoz) {
      recognitionRef.current.stop();
      setGrabandoVoz(false);
    } else {
      try {
        recognitionRef.current.start();
        setGrabandoVoz(true);
      } catch {
        setGrabandoVoz(false);
      }
    }
  };

  const handleEnviar = async (e?: React.FormEvent, textoManual?: string) => {
    if (e) e.preventDefault();

    const contenidoAEnviar = (textoManual ?? textoEntrada).trim();
    if (!contenidoAEnviar || enviando) return;

    if (grabandoVoz) {
      recognitionRef.current?.stop();
      setGrabandoVoz(false);
    }

    setErrorAlerta(null);
    setTextoEntrada("");

    // Agregar mensaje optimista del usuario
    const mensajeOptimista: MensajeWidget = {
      id: crypto.randomUUID(),
      rol: "user",
      contenido: contenidoAEnviar,
      hora: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMensajes((prev) => [...prev, mensajeOptimista]);
    setEnviando(true);

    try {
      // Una orden de navegación se resuelve al instante, sin modelo.
      if (modo === "acciones" && (await sugerirNavegacion(contenidoAEnviar))) {
        const res = await enviarMensajeWidget({ contenido: contenidoAEnviar, modo });

        if (res.ok && res.mensaje) setMensajes((prev) => [...prev, res.mensaje!]);

        return;
      }

      const respuesta = await fetch("/api/ia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: contenidoAEnviar }),
      });

      if (!respuesta.ok) {
        const { error } = (await respuesta.json().catch(() => ({ error: "fallo" }))) as {
          error?: string;
        };

        // Sin clave de IA (desarrollo local) se usan las respuestas de respaldo.
        if (error === "sin_clave") {
          const res = await enviarMensajeWidget({ contenido: contenidoAEnviar, modo });

          if (res.ok && res.mensaje) setMensajes((prev) => [...prev, res.mensaje!]);
          else setErrorAlerta(t("errorGenerico"));

          return;
        }

        setErrorAlerta(t(ERRORES[error ?? ""] ?? "errorGenerico"));

        return;
      }

      let texto = "";
      const pasos: PasoVisible[] = [];
      const tarjetas: TarjetaAccion[] = [];
      const pintar = () => setEnVivo({ id: "vivo", rol: "assistant", contenido: texto, hora: "", pasos: [...pasos], tarjetas: [...tarjetas] });

      pintar();

      await leerFlujo(respuesta, (evento) => {
        if (evento.t === "delta") {
          texto += evento.texto;
        } else if (evento.t === "paso") {
          const i = pasos.findIndex((p) => p.id === evento.id);
          const paso = { id: evento.id, herramienta: evento.herramienta, estado: evento.estado, resumen: evento.resumen };

          if (i >= 0) pasos[i] = paso;
          else pasos.push(paso);
        } else if (evento.t === "aprobacion") {
          tarjetas.push({ accionId: evento.accionId, resumen: evento.resumen });
        } else if (evento.t === "consumo") {
          setConsumo({ usados: evento.usados, tope: evento.tope, aviso: evento.aviso });
        } else if (evento.t === "error") {
          setErrorAlerta(t("errorGenerico"));
        }

        pintar();
      });

      if (texto.trim() || tarjetas.length > 0 || pasos.length > 0) {
        setMensajes((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            rol: "assistant",
            contenido: texto.trim(),
            hora: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            pasos,
            tarjetas,
          },
        ]);
      }
    } catch {
      setErrorAlerta(t("errorGenerico"));
    } finally {
      setEnVivo(null);
      setEnviando(false);
    }
  };

  const handleLimpiar = async () => {
    if (!window.confirm(t("confirmarLimpiar"))) return;
    setMensajes([]);
    await limpiarHistorialWidget();
  };

  const ejecutarNavegacion = (accion: AccionSugerida) => {
    router.push(accion.ruta);
  };

  // Sugerencias según rol y modo. Solo se ofrece lo que el rol puede hacer:
  // una sugerencia que acaba en «no tienes permiso» es otro botón que no sirve.
  const obtenerSugerencias = (): string[] => {
    if (esEstudiante) {
      return [
        t("sugerencias.estudianteReglas"),
        t("sugerencias.estudianteServicio"),
        t("sugerencias.estudianteReprobar"),
        t("sugerencias.estudianteSolicitud"),
      ];
    }

    if (usuario.rol === "contabilidad") {
      return modo === "acciones"
        ? [
            t("sugerencias.contabilidadMiDia"),
            t("sugerencias.contabilidadCxp"),
            t("sugerencias.contabilidadBancos"),
          ]
        : [
            t("sugerencias.contabilidadPendientes"),
            t("sugerencias.contabilidadSenales"),
            t("sugerencias.contabilidadGasto"),
            t("sugerencias.contabilidadRetenciones"),
          ];
    }

    if (usuario.rol === "chofer") {
      return modo === "acciones"
        ? [t("sugerencias.generalSolicitudes"), t("sugerencias.generalCalendario")]
        : [t("sugerencias.generalTareas"), t("sugerencias.generalAgenda")];
    }

    if (usuario.rol === "habitudes" || usuario.rol === "dir_habitudes") {
      return modo === "acciones"
        ? [t("sugerencias.generalCrearTarea"), t("sugerencias.generalSolicitudes")]
        : [t("sugerencias.generalTareas"), t("sugerencias.generalAgenda")];
    }

    if (usuario.rol === "docente") {
      return modo === "acciones"
        ? [t("sugerencias.docenteCalificaciones"), t("sugerencias.docenteMaterias")]
        : [t("sugerencias.docenteEscala"), t("sugerencias.docenteCalificaciones")];
    }

    return modo === "acciones"
      ? [
          t("sugerencias.generalCrearTarea"),
          t("sugerencias.adminDashboard"),
          t("sugerencias.adminTareas"),
          ...(usuario.rol === "super_admin" ? [t("sugerencias.adminAuditoria")] : []),
        ]
      : [
          t("sugerencias.generalTareas"),
          t("sugerencias.generalAgenda"),
          t("sugerencias.adminProyectos"),
        ];
  };

  const sugerencias = obtenerSugerencias();

  const etiquetaRol = {
    estudiante: t("rolEstudiante"),
    contabilidad: t("rolContabilidad"),
    docente: t("rolDocente"),
    admin: t("rolAdmin"),
    super_admin: t("rolSuperAdmin"),
    habitudes: t("rolHabitudes"),
    dir_habitudes: t("rolDirHabitudes"),
    chofer: t("rolChofer"),
  }[usuario.rol];

  // Un solo estado para el orbe: lo que el agente hace AHORA. Es lo que ve
  // quien espera, y lo que anuncia el lector de pantalla (aria-live).
  const estadoOrbe: EstadoOrbe = errorAlerta
    ? "error"
    : grabandoVoz
      ? "listening"
      : enviando
        ? estadoEnVivo(enVivo)
        : textoEntrada.trim()
          ? "listening"
          : mensajes.length > 0
            ? "done"
            : "idle";
  const textoOrbe = t(`orbe.${CLAVE_ORBE[estadoOrbe]}`);

  const transicionPanel = reducido
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 30 };

  return (
    <>
      <motion.button
        type="button"
        onClick={toggleAbierto}
        aria-label={t("botonFlotante")}
        aria-expanded={abierto}
        whileHover={reducido ? undefined : { scale: 1.06 }}
        whileTap={reducido ? undefined : { scale: 0.94 }}
        className="border-linea bg-card shadow-elevada focus-visible:ring-ring fixed right-4 bottom-20 z-50 flex size-14 items-center justify-center rounded-full border outline-none focus-visible:ring-2 md:right-6 md:bottom-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          {abierto ? (
            <motion.span
              key="cerrar"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: reducido ? 0 : 0.15 }}
            >
              <X className="text-tinta size-6" />
            </motion.span>
          ) : (
            <motion.span
              key="orbe"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: reducido ? 0 : 0.15 }}
              className="flex"
            >
              <AiOrb estado={enviando ? estadoOrbe : "idle"} tamano="md" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label={t("titulo")}
            initial={reducido ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducido ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={transicionPanel}
            style={{ transformOrigin: "bottom right" }}
            className="border-linea bg-background shadow-elevada fixed right-4 bottom-36 z-50 flex h-[600px] max-h-[calc(100dvh-10rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-hoja border sm:w-[420px] md:right-6 md:bottom-24 md:max-h-[calc(100dvh-8rem)]"
          >
            <div className="border-linea flex items-center gap-3 border-b px-4 py-3">
              <AiOrb estado={estadoOrbe} tamano="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-tinta text-sm font-semibold">{t("titulo")}</h2>
                  <span className="bg-muted text-tinta-2 rounded-full px-2 py-0.5 text-[11px] font-medium">
                    {etiquetaRol}
                  </span>
                </div>
                <p aria-live="polite" className="texto-meta truncate">
                  {textoOrbe}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLimpiar}
                aria-label={t("limpiar")}
                title={t("limpiar")}
                className="text-tinta-3 hover:bg-muted hover:text-tinta focus-visible:ring-ring flex size-11 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label={t("cerrar")}
                title={t("cerrar")}
                className="text-tinta-3 hover:bg-muted hover:text-tinta focus-visible:ring-ring flex size-11 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2"
              >
                <X className="size-4" />
              </button>
            </div>

            {consumo && <MedidorConsumo consumo={consumo} />}

            <div className="border-linea border-b px-3 py-2">
              <div role="tablist" aria-label={t("modo")} className="bg-muted grid grid-cols-2 gap-1 rounded-full p-1 text-sm">
                {(["consultas", "acciones"] as const).map((opcion) => {
                  const bloqueado = opcion === "acciones" && esEstudiante;
                  const activo = modo === opcion;
                  const Icono = opcion === "consultas" ? HelpCircle : bloqueado ? Lock : Zap;

                  return (
                    <button
                      key={opcion}
                      type="button"
                      role="tab"
                      aria-selected={activo}
                      disabled={bloqueado}
                      onClick={() => setModo(opcion)}
                      title={
                        opcion === "consultas"
                          ? t("modoConsultasDesc")
                          : bloqueado
                            ? t("modoAccionesRestringidoDesc")
                            : t("modoAccionesDesc")
                      }
                      className={cn(
                        "focus-visible:ring-ring relative flex min-h-9 items-center justify-center gap-1.5 rounded-full font-medium outline-none focus-visible:ring-2",
                        activo ? "text-tinta" : "text-tinta-3 hover:text-tinta",
                        bloqueado && "cursor-not-allowed opacity-60",
                      )}
                    >
                      {activo && (
                        <motion.span
                          layoutId="pildora-modo-ia"
                          transition={transicionPanel}
                          className="bg-card shadow-card absolute inset-0 rounded-full"
                        />
                      )}
                      <Icono className={cn("relative size-4", activo && opcion === "acciones" && "text-marca-600")} />
                      <span className="relative">
                        {opcion === "consultas" ? t("modoConsultas") : t("modoAcciones")}
                      </span>
                    </button>
                  );
                })}
              </div>

              {esEstudiante && (
                <p className="texto-meta mt-1.5 text-center">{t("modoAccionesRestringido")}</p>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {cargandoHistorial ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <AiOrb estado="thinking" tamano="lg" />
                </div>
              ) : mensajes.length === 0 && !enviando ? (
                <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                  <AiOrb estado={estadoOrbe} tamano="lg" etiqueta={textoOrbe} />
                  <h3 className="texto-titulo-tarjeta text-tinta mt-4">{t("sinMensajes")}</h3>

                  <ul className="mt-5 flex w-full flex-col gap-2">
                    {sugerencias.map((sugerencia, indice) => (
                      <motion.li
                        key={`${modo}-${sugerencia}`}
                        initial={reducido ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reducido ? 0 : 0.04 * indice }}
                      >
                        <button
                          type="button"
                          onClick={() => void handleEnviar(undefined, sugerencia)}
                          className="border-linea text-tinta-2 hover:border-tinta hover:text-tinta focus-visible:ring-ring flex min-h-11 w-full items-center gap-2 rounded-control border px-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 active:scale-[0.99]"
                        >
                          <Sparkles className="text-marca-600 size-4 shrink-0" />
                          <span className="line-clamp-1">{sugerencia}</span>
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              ) : (
                mensajes.map((m) => (
                  <MensajeIA key={m.id} mensaje={m} alNavegar={ejecutarNavegacion} />
                ))
              )}

              <AnimatePresence>
                {enviando && (
                  <motion.div
                    key="en-vivo"
                    initial={reducido ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5"
                  >
                    <AiOrb estado={estadoOrbe} tamano="md" className="mt-0.5" />
                    <div className="bg-muted text-tinta max-w-[86%] min-w-0 rounded-card px-3.5 py-2.5">
                      {enVivo?.contenido ? (
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                          {enVivo.contenido}
                        </p>
                      ) : (
                        <p className="text-tinta-2 text-sm">{textoOrbe}</p>
                      )}
                      <PasosYTarjetas pasos={enVivo?.pasos} tarjetas={enVivo?.tarjetas} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={finalMensajesRef} />
            </div>

            <AnimatePresence>
              {errorAlerta && (
                <motion.div
                  role="alert"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-tinta text-background flex items-center gap-2 overflow-hidden px-4 py-2 text-sm"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="flex-1">{errorAlerta}</span>
                  <button
                    type="button"
                    onClick={() => setErrorAlerta(null)}
                    aria-label={t("cerrar")}
                    className="text-background/70 hover:text-background flex size-9 items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={(e) => void handleEnviar(e)} className="border-linea border-t p-3">
              <div className="border-linea-fuerte focus-within:border-marca-500 focus-within:ring-marca-500 flex items-end gap-1 rounded-card border p-1 focus-within:ring-1">
                <button
                  type="button"
                  onClick={toggleGrabacionVoz}
                  aria-pressed={grabandoVoz}
                  aria-label={grabandoVoz ? t("detenerVoz") : t("iniciarVoz")}
                  title={soportaVoz ? (grabandoVoz ? t("detenerVoz") : t("iniciarVoz")) : t("vozNoSoportada")}
                  className={cn(
                    "focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2",
                    grabandoVoz ? "bg-marca-50 text-marca-700" : "text-tinta-3 hover:bg-muted hover:text-tinta",
                  )}
                >
                  {grabandoVoz ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </button>

                <textarea
                  ref={textareaRef}
                  value={textoEntrada}
                  onChange={(e) => setTextoEntrada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleEnviar();
                    }
                  }}
                  rows={1}
                  aria-label={modo === "acciones" ? t("placeholderAcciones") : t("placeholderConsultas")}
                  placeholder={modo === "acciones" ? t("placeholderAcciones") : t("placeholderConsultas")}
                  className="text-tinta placeholder:text-tinta-3 max-h-28 min-h-11 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-sm focus:outline-none"
                />

                <motion.button
                  type="submit"
                  disabled={enviando || !textoEntrada.trim()}
                  aria-label={t("enviar")}
                  title={t("enviar")}
                  whileTap={reducido ? undefined : { scale: 0.9 }}
                  className="bg-marca-500 hover:bg-marca-600 focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-full text-white outline-none transition-colors focus-visible:ring-2 disabled:opacity-40"
                >
                  <Send className="size-4" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
