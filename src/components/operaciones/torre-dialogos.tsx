"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Loader2, MessageSquare, Plus, Save, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { crearTarea } from "@/server/operaciones/acciones";
import type { OpcionOperaciones } from "@/server/operaciones/consultas";
import {
  comentarTarea,
  comentariosDeTarea,
  editarTareaTorre,
} from "@/server/operaciones/torre-acciones";
import {
  ESTADOS_TAREA_COLABORADOR,
  PRIORIDADES_TAREA,
  type ComentarioTarea,
  type TareaTorre,
} from "@/lib/torre-control";
import { ALERTA_RIESGO } from "@/lib/paleta";

export const CLASE_SELECT =
  "h-11 w-full rounded-control border border-linea-fuerte bg-card px-3 text-sm text-tinta outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ClaveError =
  | "error"
  | "no_permitido"
  | "no_encontrado"
  | "titulo_vacio"
  | "fin_antes_de_inicio"
  | "invalido"
  | "vacio";

function claveError(valor: string): ClaveError {
  const conocidas: ClaveError[] = [
    "no_permitido",
    "no_encontrado",
    "titulo_vacio",
    "fin_antes_de_inicio",
    "invalido",
    "vacio",
  ];
  return (conocidas as string[]).includes(valor) ? (valor as ClaveError) : "error";
}

export function AvisoError({ clave }: { clave: string }) {
  const t = useTranslations("torre");
  return (
    <p role="alert" className={ALERTA_RIESGO.contenedor}>
      <AlertCircle className={ALERTA_RIESGO.icono} />
      <span className={ALERTA_RIESGO.texto}>{t(`errors.${claveError(clave)}`)}</span>
    </p>
  );
}

/** Casillas nativas: mandan varios valores con el mismo nombre y el servidor usa `getAll`. */
function CasillasPersonas({
  nombre,
  personas,
  marcadas,
}: {
  nombre: string;
  personas: readonly OpcionOperaciones[];
  marcadas: readonly string[];
}) {
  return (
    <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
      {personas.map((p) => (
        <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={nombre}
            value={p.id}
            defaultChecked={marcadas.includes(p.id)}
            className="size-4 accent-marca-500"
          />
          <span className="truncate">{p.nombre}</span>
        </label>
      ))}
    </div>
  );
}

/** Edición completa de una tarea (solo coordinación). */
export function DialogoEditarTarea({
  tarea,
  personas,
  abierto,
  alCambiar,
}: {
  tarea: TareaTorre;
  personas: readonly OpcionOperaciones[];
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
}) {
  const t = useTranslations("torre");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(datos: FormData) {
    iniciar(async () => {
      const r = await editarTareaTorre(datos);
      if (r.ok) {
        setError(null);
        alCambiar(false);
      } else setError(r.error);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={alCambiar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="id" value={tarea.id} />
          <div className="space-y-1.5">
            <Label htmlFor="e-titulo">{t("form.title")}</Label>
            <Input id="e-titulo" name="titulo" defaultValue={tarea.titulo} maxLength={160} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-estado">{t("form.status")}</Label>
              <select id="e-estado" name="estado" defaultValue={tarea.estado} className={CLASE_SELECT}>
                {ESTADOS_TAREA_COLABORADOR.map((e) => (
                  <option key={e} value={e}>
                    {t(`status.${e}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-prioridad">{t("form.priority")}</Label>
              <select id="e-prioridad" name="prioridad" defaultValue={tarea.prioridad} className={CLASE_SELECT}>
                {PRIORIDADES_TAREA.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-progreso">{t("form.progress")}</Label>
              <Input id="e-progreso" name="progreso" type="number" min={0} max={100} step={5} defaultValue={tarea.progreso} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-inicio">{t("form.start")}</Label>
              <Input id="e-inicio" name="inicio" type="date" defaultValue={tarea.fecha_inicio ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-limite">{t("form.due")}</Label>
              <Input id="e-limite" name="limite" type="date" defaultValue={tarea.fecha_limite ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-horas">{t("form.hours")}</Label>
              <Input id="e-horas" name="horas" type="number" min={0} step={0.5} defaultValue={tarea.horas_estimadas} />
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("form.assignees")}</legend>
            <CasillasPersonas nombre="asignado" personas={personas} marcadas={tarea.asignados_ids} />
          </fieldset>
          {error && <AvisoError clave={error} />}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => alCambiar(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Asignar una tarea nueva a la persona cuya torre se mira. Reutiliza
 * `crearTarea` del tablero: la misma transacción (tarea, asignado, evento y
 * aviso), con la persona ya marcada.
 */
export function BotonAsignarTarea({
  persona,
  proyectos,
}: {
  persona: { id: string; nombre: string };
  proyectos: readonly OpcionOperaciones[];
}) {
  const t = useTranslations("torre");
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(datos: FormData) {
    iniciar(async () => {
      const r = await crearTarea({ estado: "inicial" }, datos);
      if (r.estado === "ok") {
        setError(null);
        setAbierto(false);
      } else setError(r.estado);
    });
  }

  return (
    <>
      <Button onClick={() => setAbierto(true)}>
        <Plus className="size-4" />
        {t("assign")}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("assignTitle", { nombre: persona.nombre })}</DialogTitle>
          </DialogHeader>
          <form action={enviar} className="space-y-4">
            <input type="hidden" name="asignado" value={persona.id} />
            <input type="hidden" name="visibilidad" value="asignados" />
            <div className="space-y-1.5">
              <Label htmlFor="a-titulo">{t("form.title")}</Label>
              <Input id="a-titulo" name="titulo" maxLength={160} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="a-proyecto">{t("form.project")}</Label>
                <select id="a-proyecto" name="proyecto" className={CLASE_SELECT}>
                  <option value="">{t("noProject")}</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-prioridad">{t("form.priority")}</Label>
                <select id="a-prioridad" name="prioridad" defaultValue="media" className={CLASE_SELECT}>
                  {PRIORIDADES_TAREA.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="a-limite">{t("form.due")}</Label>
                <Input id="a-limite" name="limite" type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-desc">{t("form.description")}</Label>
              <Textarea id="a-desc" name="descripcion" rows={2} maxLength={900} />
            </div>
            {error && <AvisoError clave={error} />}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Hilo de comentarios de una tarea. Se carga al abrir, no con la página. */
export function DialogoComentarios({
  tarea,
  abierto,
  alCambiar,
}: {
  tarea: TareaTorre;
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
}) {
  const t = useTranslations("torre");
  const [comentarios, setComentarios] = useState<ComentarioTarea[] | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    comentariosDeTarea(tarea.id).then((lista) => {
      if (vigente) setComentarios(lista ?? []);
    });
    return () => {
      vigente = false;
    };
  }, [abierto, tarea.id]);

  function enviar() {
    iniciar(async () => {
      const r = await comentarTarea({ id: tarea.id, texto });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setTexto("");
      setComentarios((await comentariosDeTarea(tarea.id)) ?? []);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={alCambiar}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-tinta-2" />
            {tarea.titulo}
          </DialogTitle>
        </DialogHeader>
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {comentarios === null ? (
            <li className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-tinta-3" />
            </li>
          ) : comentarios.length === 0 ? (
            <li className="texto-meta py-4 text-center">{t("noComments")}</li>
          ) : (
            comentarios.map((c) => (
              <li key={c.id} className="rounded-control bg-muted px-3 py-2">
                <p className="texto-meta">
                  <span className="font-medium text-tinta">{c.autor}</span> ·{" "}
                  {new Date(c.creado_en).toLocaleString()}
                </p>
                <p className="mt-1 text-sm whitespace-pre-line text-tinta">{c.texto}</p>
              </li>
            ))
          )}
        </ul>
        <div className="space-y-2">
          <Textarea
            aria-label={t("commentPlaceholder")}
            placeholder={t("commentPlaceholder")}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            maxLength={2000}
          />
          {error && <AvisoError clave={error} />}
          <div className="flex justify-end">
            <Button onClick={enviar} disabled={enviando || !texto.trim()}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t("send")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
