"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, FileUp, FileText, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { TareaVista } from "@/lib/clases";
import { cn } from "@/lib/utils";
import { entregarTareaMoodleAction } from "@/server/moodle/acciones";

/**
 * Panel de una tarea: leerla y entregarla (arrastrar archivo → «Entregar tarea»).
 *
 * Reusa `entregarTareaMoodleAction`, que es quien de verdad protege la entrega
 * (sesión, matrícula en la clase, formato, tamaño y plazo). Lo de aquí solo
 * evita ofrecer lo que el servidor va a rechazar:
 *   · calificada → solo lectura: volver a subir borraría la revisión del docente;
 *   · vencida y sin entregas tardías → solo lectura con el motivo.
 */
export function PanelEntrega({
  tarea,
  abierto,
  onCerrar,
}: {
  tarea: TareaVista | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <SheetContent>
        {/* `key`: cada tarea arranca con su propio formulario limpio. */}
        {tarea && <Contenido key={tarea.id} tarea={tarea} onCerrar={onCerrar} />}
      </SheetContent>
    </Sheet>
  );
}

function Contenido({ tarea, onCerrar }: { tarea: TareaVista; onCerrar: () => void }) {
  const t = useTranslations("studentClasses");
  const tMoodle = useTranslations("moodle");
  const router = useRouter();
  const avisar = useToast();
  const entrada = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [texto, setTexto] = useState(tarea.entrega?.texto ?? "");
  const [comentario, setComentario] = useState(tarea.entrega?.comentario ?? "");
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const calificada = tarea.estado === "calificado";
  const entregada = tarea.estado !== "pendiente";
  const cerradaPorPlazo = tarea.vencida && !tarea.tardiasPermitidas;
  const soloLectura = calificada || cerradaPorPlazo;
  const evaluable = tarea.tipo === "tarea" || tarea.tipo === "examen";

  const elegir = (nuevo: File | undefined) => {
    setError(null);
    if (!nuevo) return;
    const mb = nuevo.size / (1024 * 1024);

    if (mb > tarea.limiteMb) {
      setError(t("panel.errSize", { actual: mb.toFixed(1), max: tarea.limiteMb }));
      return;
    }
    const ext = nuevo.name.split(".").pop()?.toLowerCase() ?? "";

    if (tarea.formatos.length > 0 && !tarea.formatos.includes(ext)) {
      setError(t("panel.errFormat", { allowed: tarea.formatos.map((f) => `.${f}`).join(", ") }));
      return;
    }
    setArchivo(nuevo);
  };

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!archivo && !texto.trim() && !tarea.entrega) {
      setError(tMoodle("deliveryResult.sin_contenido"));
      return;
    }

    const datos = new FormData();
    datos.set("asignacion_id", tarea.id);
    if (archivo) datos.set("archivo", archivo);
    datos.set("texto_respuesta", texto);
    datos.set("comentario_estudiante", comentario);

    iniciar(async () => {
      const res = await entregarTareaMoodleAction(datos);
      const mensaje = tMoodle(`deliveryResult.${res.mensaje ?? "error"}` as never);

      if (res.ok) {
        avisar({ titulo: mensaje });
        router.refresh();
        onCerrar();
      } else {
        setError(mensaje);
      }
    });
  };

  const estadoVisible = tarea.vencida ? "vencida" : tarea.estado === "pendiente" ? "pendiente" : tarea.estado;
  const etiqueta = estadoVisible === "pendiente" ? t("state.pending") : undefined;

  return (
    <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-2 border-b border-linea px-6 pt-6 pb-4 pr-16">
        <SheetTitle className="text-section">{tarea.titulo}</SheetTitle>
        <SheetDescription className="text-meta">
          {[tarea.materia, tarea.venceTexto ? t("panel.dueOn", { fecha: tarea.venceTexto }) : t("panel.noDue")].join(" · ")}
        </SheetDescription>
        {evaluable && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge status={estadoVisible} label={etiqueta} />
            {calificada && tarea.calificacion !== null && (
              <span className="text-label tabular-nums">
                {tarea.calificacion} / {tarea.puntaje}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {tarea.descripcion && <p className="text-body whitespace-pre-line">{tarea.descripcion}</p>}
        {tarea.instrucciones && (
          <p className="text-meta whitespace-pre-line rounded-control bg-muted p-3">{tarea.instrucciones}</p>
        )}
        {tarea.archivoUrl && (
          <a
            href={tarea.archivoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-label inline-flex min-h-11 items-center gap-2 text-marca-600 hover:underline"
          >
            <Paperclip aria-hidden className="size-4" />
            {t("panel.openFile")}
          </a>
        )}

        {calificada && (
          <section className="space-y-2 rounded-card border border-linea p-4">
            <p className="text-label flex items-center gap-2">
              <MessageSquare aria-hidden className="size-4" />
              {t("panel.feedback")}
            </p>
            <p className="text-body whitespace-pre-line">
              {tarea.comentarioProfesor ?? t("panel.noFeedback")}
            </p>
          </section>
        )}

        {entregada && tarea.entrega && (
          <section className="space-y-1">
            <p className="text-label">{t("panel.yourSubmission")}</p>
            {tarea.entrega.url ? (
              <a
                href={tarea.entrega.url}
                target="_blank"
                rel="noreferrer"
                className="text-body inline-flex min-h-11 items-center gap-2 text-marca-600 hover:underline"
              >
                <FileText aria-hidden className="size-4" />
                {tarea.entrega.nombre ?? t("panel.openSubmission")}
              </a>
            ) : (
              !tarea.entrega.texto && <p className="text-meta">{t("panel.textOnly")}</p>
            )}
            {tarea.entrega.texto && <p className="text-body whitespace-pre-line">{tarea.entrega.texto}</p>}
          </section>
        )}

        {evaluable && cerradaPorPlazo && !calificada && (
          <p role="status" className="text-body flex items-start gap-2 rounded-control bg-muted p-3">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("panel.closedLate")}
          </p>
        )}

        {evaluable && !soloLectura && (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                elegir(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors",
                arrastrando ? "border-marca-500 bg-marca-50" : "border-linea-fuerte",
              )}
            >
              <FileUp aria-hidden className="size-7 text-tinta-2" />
              {archivo ? (
                <div className="flex items-center gap-2">
                  <span className="text-label break-all">{archivo.name}</span>
                  <button
                    type="button"
                    onClick={() => setArchivo(null)}
                    aria-label={t("panel.removeFile")}
                    className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-label">{t("panel.dropHere")}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={() => entrada.current?.click()}>
                    {t("panel.chooseFile")}
                  </Button>
                </>
              )}
              <p className="text-meta">
                {t("panel.limits", { max: tarea.limiteMb, formats: tarea.formatos.map((f) => `.${f}`).join(" ") })}
              </p>
              <input
                ref={entrada}
                type="file"
                className="sr-only"
                tabIndex={-1}
                accept={tarea.formatos.map((f) => `.${f}`).join(",")}
                onChange={(e) => {
                  elegir(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="texto-entrega">{t("panel.written")}</Label>
              <Textarea id="texto-entrega" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comentario-entrega">{t("panel.note")}</Label>
              <Textarea
                id="comentario-entrega"
                rows={2}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-body flex items-start gap-2 rounded-control bg-tinta p-3 text-background">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-linea bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetClose asChild>
          <Button type="button" variant="ghost">
            {soloLectura || !evaluable ? t("panel.close") : t("panel.cancel")}
          </Button>
        </SheetClose>
        {evaluable && !soloLectura && (
          <Button type="submit" cargando={pendiente}>
            <Send aria-hidden />
            {entregada ? t("panel.resubmit") : t("panel.submit")}
          </Button>
        )}
      </footer>
    </form>
  );
}
