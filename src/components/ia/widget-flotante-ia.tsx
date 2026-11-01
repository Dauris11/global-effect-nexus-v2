"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Check,
  HelpCircle,
  Loader2,
  Lock,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { MedidorConsumo, type ConsumoVisible } from "@/components/ia/medidor-consumo";
import { TarjetaAccionIA, type TarjetaAccion } from "@/components/ia/tarjeta-accion";
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

/** Un paso de herramienta que el agente dio mientras respondía. */
type PasoVisible = {
  id: string;
  herramienta: string;
  estado: "ejecutando" | "ok" | "error";
  resumen: string;
};

type MensajeLocal = MensajeWidget & {
  pasos?: PasoVisible[];
  tarjetas?: TarjetaAccion[];
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

  // Sugerencias dinámicas según rol y modo
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

    // Personal operativo y Habitudes: lo que el asistente puede hacer por ellos.
    if (usuario.rol === "habitudes" || usuario.rol === "dir_habitudes") {
      return [
        t("sugerencias.generalTareas"),
        t("sugerencias.generalAgenda"),
        t("sugerencias.generalCrearTarea"),
      ];
    }

    if (usuario.rol === "docente") {
      return modo === "acciones"
        ? [
            t("sugerencias.docenteCalificaciones"),
            t("sugerencias.docenteMaterias"),
          ]
        : [
            t("sugerencias.docenteEscala"),
            t("sugerencias.docenteCalificaciones"),
          ];
    }

    // Admin / Super Admin
    return modo === "acciones"
      ? [
          t("sugerencias.generalCrearTarea"),
          t("sugerencias.adminDashboard"),
          t("sugerencias.adminTareas"),
          t("sugerencias.adminAuditoria"),
        ]
      : [
          t("sugerencias.generalTareas"),
          t("sugerencias.generalAgenda"),
          t("sugerencias.adminProyectos"),
        ];
  };

  const sugerencias = obtenerSugerencias();

  // Etiqueta del rol para el encabezado
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

  return (
    <>
      {/* Botón Flotante (Trigger) - siempre presente, no obstruye */}
      <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6">
        <button
          type="button"
          onClick={toggleAbierto}
          aria-label={t("botonFlotante")}
          aria-expanded={abierto}
          className={cn(
            "relative flex size-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-500",
            "bg-gradient-to-br from-marca-500 to-marca-700 hover:from-marca-600 hover:to-marca-800",
          )}
        >
          {abierto ? (
            <X className="size-6 transition-transform duration-200" />
          ) : (
            <>
              <Sparkles className="size-6 transition-transform duration-200" />
              {/* Indicador de pulso activo */}
              <span className="absolute top-0 right-0 flex size-3.5 -mt-0.5 -mr-0.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marca-300 opacity-75" />
                <span className="relative inline-flex size-3.5 rounded-full border-2 border-white bg-marca-400" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Ventana Pop-up Flotante */}
      {abierto && (
        <div
          role="dialog"
          aria-label={t("titulo")}
          className={cn(
            "fixed bottom-20 right-4 z-50 flex h-[580px] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-linea-fuerte bg-background/95 shadow-2xl backdrop-blur-md transition-all duration-200 sm:w-[430px] md:bottom-22 md:right-6",
          )}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between border-b border-linea px-4 py-3 bg-muted/40">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-tinta">
                    {t("titulo")}
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-marca-50 px-2 py-0.5 text-[11px] font-medium text-marca-700">
                    {etiquetaRol}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleLimpiar}
                title={t("limpiar")}
                aria-label={t("limpiar")}
                className="flex size-8 items-center justify-center rounded-lg text-tinta-3 hover:bg-muted hover:text-tinta transition-colors"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                title={t("cerrar")}
                aria-label={t("cerrar")}
                className="flex size-8 items-center justify-center rounded-lg text-tinta-3 hover:bg-muted hover:text-tinta transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {consumo && <MedidorConsumo consumo={consumo} />}

          {/* Selector de Modo: Consultas vs Acciones */}
          <div className="border-b border-linea bg-background px-3 py-2">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 text-xs">
              <button
                type="button"
                onClick={() => setModo("consultas")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-all duration-150",
                  modo === "consultas"
                    ? "bg-background text-tinta shadow-sm"
                    : "text-tinta-3 hover:text-tinta",
                )}
              >
                <HelpCircle className="size-3.5" />
                {t("modoConsultas")}
              </button>

              <button
                type="button"
                disabled={esEstudiante}
                onClick={() => {
                  if (!esEstudiante) setModo("acciones");
                }}
                title={
                  esEstudiante
                    ? t("modoAccionesRestringidoDesc")
                    : t("modoAccionesDesc")
                }
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-all duration-150",
                  modo === "acciones"
                    ? "bg-background text-tinta shadow-sm"
                    : "text-tinta-3 hover:text-tinta",
                  esEstudiante && "cursor-not-allowed opacity-60",
                )}
              >
                {esEstudiante ? (
                  <Lock className="size-3.5 text-tinta-3" />
                ) : (
                  <Zap className="size-3.5 text-marca-600" />
                )}
                {t("modoAcciones")}
              </button>
            </div>

            {/* Aviso para estudiantes */}
            {esEstudiante && (
              <p className="mt-1.5 text-center text-[11px] text-tinta-3">
                {t("modoAccionesRestringido")}
              </p>
            )}
          </div>

          {/* Área de Conversación */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {cargandoHistorial ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-tinta-3">{t("pensando")}</p>
              </div>
            ) : mensajes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4 py-6">
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                  <Bot className="size-6" />
                </div>
                <h3 className="text-sm font-semibold text-tinta">
                  {t("sinMensajes")}
                </h3>

                {/* Sugerencias en estado vacío */}
                <div className="mt-5 w-full space-y-1.5">
                  <p className="text-left text-[11px] font-medium text-tinta-3 uppercase tracking-wider">
                    {t("sugerenciasTitulo")}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {sugerencias.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleEnviar(undefined, sug)}
                        className="flex items-center gap-2 rounded-xl border border-linea bg-card/60 px-3 py-2 text-left text-xs text-tinta-2 hover:border-marca-400 hover:bg-marca-50/40 hover:text-tinta transition-all"
                      >
                        <Sparkles className="size-3.5 shrink-0 text-marca-600" />
                        <span className="line-clamp-1">{sug}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              mensajes.map((m) => {
                const esMio = m.rol === "user";

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-2.5",
                      esMio ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        esMio
                          ? "bg-tinta text-background"
                          : "bg-marca-50 text-marca-600",
                      )}
                    >
                      {esMio ? (
                        <User className="size-3.5" />
                      ) : (
                        <Bot className="size-3.5" />
                      )}
                    </span>

                    <div
                      className={cn(
                        "max-w-[82%] rounded-2xl px-3.5 py-2.5",
                        esMio
                          ? "bg-tinta text-background"
                          : "bg-muted/70 text-tinta border border-linea",
                      )}
                    >
                      {m.contenido && (
                        <p className="break-words whitespace-pre-wrap text-[13.5px] leading-relaxed">
                          {m.contenido}
                        </p>
                      )}

                      <PasosYTarjetas pasos={m.pasos} tarjetas={m.tarjetas} />

                      {/* Tarjeta interactiva de acción ejecutable */}
                      {m.accion && (
                        <div className="mt-3 rounded-xl border border-marca-300/40 bg-marca-50/60 p-2.5 text-tinta">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-marca-800">
                              {t("accionIdentificada")}
                            </span>
                            <span className="text-[11px] text-tinta-3">
                              {m.accion.etiqueta}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => ejecutarNavegacion(m.accion!)}
                            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-marca-600 py-1.5 text-xs font-medium text-white hover:bg-marca-700 active:scale-98 transition-all"
                          >
                            <span>{t("abrirPantalla")}</span>
                            <ArrowUpRight className="size-3.5" />
                          </button>
                        </div>
                      )}

                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          esMio ? "text-background/70" : "text-tinta-3",
                        )}
                      >
                        {m.hora}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            {/* Respuesta en curso: el texto aparece a medida que se escribe. */}
            {enviando && (
              <div className="flex gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-marca-600">
                  <Bot className="size-3.5" />
                </span>
                <div className="max-w-[82%] rounded-2xl border border-linea bg-muted/60 px-3.5 py-2.5 text-xs text-tinta-2">
                  {enVivo?.contenido ? (
                    <p className="break-words whitespace-pre-wrap text-[13.5px] leading-relaxed text-tinta">
                      {enVivo.contenido}
                    </p>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 animate-ping rounded-full bg-marca-600" />
                      <span>{t("pensando")}</span>
                    </div>
                  )}

                  <PasosYTarjetas pasos={enVivo?.pasos} tarjetas={enVivo?.tarjetas} />
                </div>
              </div>
            )}

            <div ref={finalMensajesRef} />
          </div>

          {/* Banner de alerta de error */}
          {errorAlerta && (
            <div className="flex items-center gap-2 border-t border-linea bg-tinta px-3 py-2 text-xs text-background">
              <AlertCircle className="size-4 shrink-0 text-marca-300" />
              <span className="flex-1">{errorAlerta}</span>
              <button
                type="button"
                onClick={() => setErrorAlerta(null)}
                className="text-background/70 hover:text-background"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* Banner de grabación de voz en tiempo real */}
          {grabandoVoz && (
            <div className="flex items-center justify-between border-t border-linea bg-marca-50 px-3 py-2 text-xs text-marca-800">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marca-500 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-marca-600" />
                </span>
                <span className="font-medium">{t("escuchando")}</span>
              </div>
              <button
                type="button"
                onClick={toggleGrabacionVoz}
                className="font-semibold text-marca-800 underline hover:text-marca-950"
              >
                {t("detenerVoz")}
              </button>
            </div>
          )}

          {/* Formulario de Entrada */}
          <form
            onSubmit={(e) => void handleEnviar(e)}
            className="border-t border-linea bg-background p-3"
          >
            <div className="relative flex items-center rounded-xl border border-linea-fuerte bg-muted/30 focus-within:border-marca-500 focus-within:ring-1 focus-within:ring-marca-500">
              {/* Botón de Micrófono / Comando de Voz */}
              <button
                type="button"
                onClick={toggleGrabacionVoz}
                title={
                  soportaVoz
                    ? grabandoVoz
                      ? t("detenerVoz")
                      : t("iniciarVoz")
                    : t("vozNoSoportada")
                }
                aria-label={t("iniciarVoz")}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ml-1",
                  grabandoVoz
                    ? "bg-marca-100 text-marca-700 animate-pulse"
                    : "text-tinta-3 hover:bg-muted hover:text-tinta",
                )}
              >
                {grabandoVoz ? (
                  <MicOff className="size-4" />
                ) : (
                  <Mic className="size-4" />
                )}
              </button>

              {/* Campo de texto */}
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
                placeholder={
                  modo === "acciones"
                    ? t("placeholderAcciones")
                    : t("placeholderConsultas")
                }
                className="max-h-24 min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 text-xs text-tinta placeholder:text-tinta-3 focus:outline-none"
              />

              {/* Botón de Enviar */}
              <button
                type="submit"
                disabled={enviando || !textoEntrada.trim()}
                title={t("enviar")}
                aria-label={t("enviar")}
                className={cn(
                  "mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg transition-all",
                  textoEntrada.trim() && !enviando
                    ? "bg-marca-600 text-white hover:bg-marca-700 active:scale-95"
                    : "text-tinta-3 cursor-not-allowed opacity-40",
                )}
              >
                <Send className="size-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/** Lo que hizo el agente (pasos) y lo que propone (tarjetas de aprobación). */
function PasosYTarjetas({
  pasos,
  tarjetas,
}: {
  pasos?: PasoVisible[];
  tarjetas?: TarjetaAccion[];
}) {
  return (
    <>
      {pasos && pasos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {pasos.map((paso) => (
            <li key={paso.id} className="text-tinta-2 flex items-center gap-1.5 text-[11px]">
              {paso.estado === "ejecutando" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : paso.estado === "ok" ? (
                <Check className="text-marca-600 size-3" />
              ) : (
                <AlertCircle className="size-3" />
              )}
              <span className="truncate">{paso.resumen}</span>
            </li>
          ))}
        </ul>
      )}

      {tarjetas?.map((tarjeta) => (
        <TarjetaAccionIA key={tarjeta.accionId} {...tarjeta} />
      ))}
    </>
  );
}
