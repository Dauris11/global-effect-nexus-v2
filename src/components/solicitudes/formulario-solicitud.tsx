"use client";

import {
  AlertCircle,
  CalendarClock,
  CalendarOff,
  ChevronLeft,
  CircleHelp,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  Receipt,
  Send,
  ShoppingCart,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { CampoFormulario } from "@/components/app/campo-formulario";
import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { HORAS_CITA, MAXIMO_TEXTO, MAXIMO_TITULO, REGLAS, type TipoSolicitud } from "@/lib/solicitudes";
import { crearSolicitudInterna, crearTramite } from "@/server/solicitudes/acciones";
import type { EstudianteOpcion } from "@/server/solicitudes/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-linea-fuerte focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-control border bg-card px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm text-tinta";

/** Estados de expediente que todavía están en el embudo. */
const EMBUDO = ["reclutado", "postulado", "academia_liderazgo"];

/**
 * Un icono por tipo: los componentes se eligen aquí, en el cliente, y no llegan por props
 * (un componente no puede cruzar de servidor a cliente).
 */
const ICONO: Record<TipoSolicitud, LucideIcon> = {
  constancia: FileText,
  carta: Mail,
  cita_administracion: CalendarClock,
  permiso: CalendarOff,
  otro: CircleHelp,
  alta_expediente: UserPlus,
  beca: GraduationCap,
  gasto: Receipt,
  compra: ShoppingCart,
};

/**
 * Formulario de una solicitud nueva (docs/ux-rules.md): PRIMERO se elige el tipo en
 * tarjetas grandes con icono y DESPUÉS se ven solo los campos de ese tipo, con el asunto ya
 * escrito. Solo lo obligatorio está a la vista; lo opcional va en «Más detalles». Un solo
 * formulario, sin modos.
 *
 * `origen` decide a qué acción va: el estudiante pide un trámite y su ficha sale de la
 * sesión; el personal pide una aprobación y nombra al estudiante. Los campos salen de
 * `REGLAS`, la misma tabla con la que el servidor valida. Al guardar no se recarga la
 * página: aviso «Solicitud creada» con «Ver» y, en la bandeja, la fila nueva resaltada.
 */
export function FormularioSolicitud({
  origen,
  tipos,
  estudiantes = [],
  minimoFecha,
  tipoInicial,
  hrefLista,
  alCrear,
}: {
  origen: "estudiante" | "personal";
  /** Los tipos que esta persona puede pedir, ya filtrados en el servidor. */
  tipos: readonly TipoSolicitud[];
  estudiantes?: readonly EstudianteOpcion[];
  /** Hoy, `YYYY-MM-DD`, calculado en el servidor. */
  minimoFecha: string;
  /** El que viene en `?tipo=` (atajos de Habitudes y del chofer), si se puede pedir. */
  tipoInicial?: TipoSolicitud;
  /** Lista a la que lleva «Ver» y donde se resalta la nueva; sin ella solo se refresca la página. */
  hrefLista?: string;
  /** Para que el panel que lo contiene se cierre al guardar. */
  alCrear?: () => void;
}) {
  const t = useTranslations("requests");
  const tn = useTranslations("listas.nuevaSolicitud");
  const avisar = useToast();
  const router = useRouter();
  const inicial = tipoInicial && tipos.includes(tipoInicial) ? tipoInicial : undefined;
  const [tipo, setTipo] = useState<TipoSolicitud | undefined>(inicial);
  const [titulo, setTitulo] = useState(inicial ? t(`type.${inicial}` as never) : "");
  // Nombre de un candidato que aún no tiene ficha: con él el alta no exige elegir a nadie.
  const [candidato, setCandidato] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, enviar] = useTransition();

  function elegir(nuevo: TipoSolicitud) {
    setTipo(nuevo);
    // El asunto se pre-llena con el nombre del tipo; la persona lo afina si quiere.
    setTitulo(t(`type.${nuevo}` as never));
    setError(null);
  }

  if (!tipo) {
    return (
      <div className="space-y-4">
        <p className="text-label text-tinta">{tn("eligeTipo")}</p>
        <div className="grid grid-cols-2 gap-3">
          {tipos.map((opcion) => {
            const Icono = ICONO[opcion];

            return (
              <button
                key={opcion}
                type="button"
                onClick={() => elegir(opcion)}
                className="flex flex-col items-start gap-3 rounded-card border border-linea bg-card p-4 text-left shadow-card transition-[box-shadow,border-color] duration-(--duracion-rapida) hover:border-tinta hover:shadow-elevada focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex size-11 items-center justify-center rounded-control bg-muted text-tinta">
                  <Icono aria-hidden className="size-6" />
                </span>
                <span className="text-sm font-semibold text-tinta">{t(`type.${opcion}` as never)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const regla = REGLAS[tipo];

  // El alta es de candidatos del embudo; la beca, de quien ya estudia o va a estudiar.
  const opciones = tipo === "alta_expediente" ? estudiantes.filter((e) => EMBUDO.includes(e.estado)) : estudiantes;
  const pideEstudiante = origen === "personal" && regla.estudiante !== "no";
  const estudianteObligatorio = regla.estudiante === "obligatorio" && !(tipo === "alta_expediente" && candidato.trim());

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const datos = new FormData(e.currentTarget);

    setError(null);
    enviar(async () => {
      const r = await (origen === "estudiante" ? crearTramite : crearSolicitudInterna)({ estado: "inicial" }, datos);

      if (r.estado !== "ok") {
        setError(t(`form.error.${r.estado}` as never));

        return;
      }

      avisar({ titulo: tn("creada"), accion: hrefLista && r.id ? { etiqueta: tn("ver"), href: `${hrefLista}?nuevo=${r.id}` } : undefined });
      setTipo(undefined);
      setTitulo("");
      setCandidato("");
      alCrear?.();
      if (hrefLista && r.id) router.replace(`${hrefLista}?nuevo=${r.id}`);
      else router.refresh();
    });
  }

  const Icono = ICONO[tipo];

  return (
    <form onSubmit={guardar} className="space-y-5">
      <input type="hidden" name="tipo" value={tipo} />

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-tinta">
          <Icono aria-hidden className="size-5" />
          {t(`type.${tipo}` as never)}
        </p>
        {tipos.length > 1 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setTipo(undefined)}>
            <ChevronLeft />
            {tn("cambiarTipo")}
          </Button>
        )}
      </div>

      <CampoFormulario
        etiqueta={t("form.title")}
        name="titulo"
        requerido
        value={titulo}
        onChange={setTitulo}
        placeholder={t(`titlePlaceholder.${tipo}` as never)}
        validar={(v) => (v ? null : tn("validacion.asunto"))}
        maxLength={MAXIMO_TITULO}
      />

      {pideEstudiante && (
        <div className="space-y-1.5">
          <Label htmlFor="estudiante" className="text-label text-tinta">{t("form.student")}</Label>
          <select id="estudiante" name="estudiante" required={estudianteObligatorio} defaultValue="" className={SELECT}>
            <option value="" disabled={tipo !== "alta_expediente"}>{t("form.studentPlaceholder")}</option>
            {opciones.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {origen === "personal" && tipo === "alta_expediente" && (
        <div className="space-y-1.5">
          <Label htmlFor="candidato" className="text-label text-tinta">{t("form.newCandidate")}</Label>
          <Input
            id="candidato"
            name="candidato"
            value={candidato}
            onChange={(e) => setCandidato(e.target.value)}
            maxLength={MAXIMO_TITULO}
            placeholder={t("form.newCandidatePlaceholder")}
            className="h-10 text-sm"
          />
        </div>
      )}

      {regla.monto === "obligatorio" && (
        <div className="space-y-1.5">
          <Label htmlFor="monto" className="text-label text-tinta">{t("form.amount")}</Label>
          <Input id="monto" name="monto" type="number" min="0.01" step="0.01" inputMode="decimal" required className="h-10 text-sm" />
        </div>
      )}

      {regla.fecha === "obligatorio" && (
        <div className="space-y-1.5">
          <Label htmlFor="fecha" className="text-label text-tinta">{t(`dateLabel.${tipo}` as never)}</Label>
          <Input id="fecha" name="fecha" type="date" min={minimoFecha} defaultValue={minimoFecha} required className="h-10 text-sm" />
        </div>
      )}

      {/* Lo opcional, plegado: la solicitud se completa con lo mínimo y se afina si hace falta. */}
      <details className="group rounded-card border border-linea">
        <summary className="text-label cursor-pointer list-none px-4 py-3 text-tinta-2 hover:text-tinta">{tn("masDetalles")}</summary>
        <div className="space-y-4 border-t border-linea p-4">
          {regla.monto === "opcional" && (
            <div className="space-y-1.5">
              <Label htmlFor="monto" className="text-label text-tinta">{t("form.amount")}</Label>
              <Input id="monto" name="monto" type="number" min="0.01" step="0.01" inputMode="decimal" className="h-10 text-sm" />
            </div>
          )}
          {regla.fecha === "opcional" && (
            <div className="space-y-1.5">
              <Label htmlFor="fecha" className="text-label text-tinta">{t(`dateLabel.${tipo}` as never)}</Label>
              <Input id="fecha" name="fecha" type="date" min={minimoFecha} className="h-10 text-sm" />
            </div>
          )}
          {tipo === "cita_administracion" && (
            <div className="space-y-1.5">
              <Label htmlFor="hora" className="text-label text-tinta">{t("form.time")}</Label>
              <select id="hora" name="hora" defaultValue="" className={SELECT}>
                <option value="">{t("form.timeAny")}</option>
                {HORAS_CITA.map((hora) => (
                  <option key={hora} value={hora}>{hora}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="detalle" className="text-label text-tinta">{t("form.detail")}</Label>
            <Textarea id="detalle" name="detalle" rows={3} maxLength={MAXIMO_TEXTO} />
          </div>
        </div>
      </details>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-control bg-tinta px-3 py-2 text-xs text-background">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" cargando={enviando}>
        {enviando ? <Loader2 className="animate-spin" /> : <Send />}
        {enviando ? t("form.sending") : t("form.submit")}
      </Button>
    </form>
  );
}
