"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  MapPin,
  Search,
  Sparkles,
  Users,
  Video,
  X,
  CheckCircle2,
  AlertCircle,
  Ban,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  CandidatoParticipante,
  MetricasReuniones,
  ModalidadReunion,
  Reunion,
  TipoReunion,
} from "@/lib/reuniones";
import {
  agendarReunionAction,
  guardarMinutaReunionAction,
  cancelarReunionAction,
} from "@/server/reuniones/acciones";

export function HubReuniones({
  reunionesIniciales,
  candidatos,
  metricas,
  usuarioActualId,
  puedeGestionar,
  abrirAgendarAlCargar = false,
}: {
  reunionesIniciales: Reunion[];
  candidatos: CandidatoParticipante[];
  metricas: MetricasReuniones;
  usuarioActualId: string;
  puedeGestionar: boolean;
  abrirAgendarAlCargar?: boolean;
}) {
  const t = useTranslations("reuniones");
  const [reuniones, setReuniones] = useState<Reunion[]>(reunionesIniciales);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");

  // Modales
  const [dialogoAgendarAbierto, setDialogoAgendarAbierto] = useState(abrirAgendarAlCargar);
  const [reunionParaMinuta, setReunionParaMinuta] = useState<Reunion | null>(null);
  const [reunionParaCancelar, setReunionParaCancelar] = useState<Reunion | null>(null);

  // Formulario de agendar
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoReunion>("coordinacion");
  const [modalidad, setModalidad] = useState<ModalidadReunion>("presencial");
  const [lugarOEnlace, setLugarOEnlace] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [horaFin, setHoraFin] = useState("11:00");
  const [participantesSeleccionados, setParticipantesSeleccionados] = useState<
    CandidatoParticipante[]
  >([]);
  const [busquedaCandidato, setBusquedaCandidato] = useState("");

  // Formulario minuta
  const [textoMinuta, setTextoMinuta] = useState("");
  const [asistencias, setAsistencias] = useState<Record<string, string>>({});
  const [marcarRealizada, setMarcarRealizada] = useState(true);

  // Motivo de cancelación
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  const [isPending, startTransition] = useTransition();
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Filtrado de reuniones
  const reunionesFiltradas = reuniones.filter((r) => {
    if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todas") {
      if (filtroEstado === "programadas" && r.estado !== "programada") return false;
      if (filtroEstado === "realizadas" && r.estado !== "realizada") return false;
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const coincideTitulo = r.titulo.toLowerCase().includes(q);
      const coincideDesc = (r.descripcion ?? "").toLowerCase().includes(q);
      const coincideOrganizador = r.organizador_nombre.toLowerCase().includes(q);
      const coincideLugar = (r.lugar_o_enlace ?? "").toLowerCase().includes(q);
      if (!coincideTitulo && !coincideDesc && !coincideOrganizador && !coincideLugar) {
        return false;
      }
    }
    return true;
  });

  // Manejo de participantes en formulario
  function toggleParticipante(candidato: CandidatoParticipante) {
    if (participantesSeleccionados.some((p) => p.id === candidato.id)) {
      setParticipantesSeleccionados((prev) =>
        prev.filter((p) => p.id !== candidato.id)
      );
    } else {
      setParticipantesSeleccionados((prev) => [...prev, candidato]);
    }
  }

  const candidatosFiltrados = candidatos
    .filter(
      (c) =>
        c.id !== usuarioActualId &&
        (c.nombre.toLowerCase().includes(busquedaCandidato.toLowerCase()) ||
          c.email.toLowerCase().includes(busquedaCandidato.toLowerCase()))
    )
    .slice(0, 8);

  function abrirModalMinuta(reunion: Reunion) {
    setReunionParaMinuta(reunion);
    setTextoMinuta(reunion.conclusiones_o_minuta ?? "");
    const mapa: Record<string, string> = {};
    for (const p of reunion.participantes ?? []) {
      mapa[p.id] = p.asistencia === "asistio" ? "asistio" : "asistio";
    }
    setAsistencias(mapa);
  }

  function handleAgendar(e: React.FormEvent) {
    e.preventDefault();
    setMensajeError(null);

    const formData = new FormData();
    formData.set("titulo", titulo);
    formData.set("descripcion", descripcion);
    formData.set("tipo", tipo);
    formData.set("modalidad", modalidad);
    formData.set("lugar_o_enlace", lugarOEnlace);
    formData.set("fecha", fecha);
    formData.set("hora_inicio", horaInicio);
    formData.set("hora_fin", horaFin);

    // Identificar si hay algún estudiante seleccionado
    const primerEstudiante = participantesSeleccionados.find((p) => p.tipo === "estudiante");
    if (primerEstudiante) {
      formData.set("estudiante_id", primerEstudiante.id);
    }

    formData.set(
      "participantes",
      JSON.stringify(
        participantesSeleccionados.map((p) => ({ id: p.id, tipo: p.tipo }))
      )
    );

    startTransition(async () => {
      const res = await agendarReunionAction({}, formData);
      if (res.error) {
        setMensajeError(res.error);
      } else {
        setMensajeExito(res.mensaje ?? "Reunión agendada exitosamente.");
        setDialogoAgendarAbierto(false);
        // Reset campos
        setTitulo("");
        setDescripcion("");
        setLugarOEnlace("");
        setParticipantesSeleccionados([]);
        // Insertar visualmente la reunión programada
        const nueva: Reunion = {
          id: res.reunionId ?? crypto.randomUUID(),
          folio: reuniones.length + 1,
          titulo,
          descripcion,
          tipo,
          modalidad,
          lugar_o_enlace: lugarOEnlace,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          organizador_usuario_id: usuarioActualId,
          organizador_nombre: "Tú",
          organizador_email: "",
          estudiante_id: primerEstudiante?.id ?? null,
          estudiante_nombre: primerEstudiante?.nombre ?? null,
          estado: "programada",
          conclusiones_o_minuta: null,
          participantes: participantesSeleccionados.map((p) => ({
            id: p.id,
            reunion_id: res.reunionId ?? "",
            usuario_id: p.tipo === "personal" ? p.id : null,
            estudiante_id: p.tipo === "estudiante" ? p.id : null,
            rol_en_reunion: "participante",
            asistencia: "pendiente",
            nota: null,
            nombre: p.nombre,
            email: p.email,
            tipo_participante: p.tipo,
          })),
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
        };
        setReuniones((prev) => [nueva, ...prev]);
      }
    });
  }

  function handleGuardarMinuta(e: React.FormEvent) {
    e.preventDefault();
    if (!reunionParaMinuta) return;
    setMensajeError(null);

    const formData = new FormData();
    formData.set("reunion_id", reunionParaMinuta.id);
    formData.set("minuta", textoMinuta);
    formData.set("marcar_realizada", String(marcarRealizada));
    formData.set("asistencias", JSON.stringify(asistencias));

    startTransition(async () => {
      const res = await guardarMinutaReunionAction({}, formData);
      if (res.error) {
        setMensajeError(res.error);
      } else {
        setMensajeExito(res.mensaje ?? "Minuta guardada.");
        setReuniones((prev) =>
          prev.map((r) =>
            r.id === reunionParaMinuta.id
              ? {
                  ...r,
                  conclusiones_o_minuta: textoMinuta,
                  estado: marcarRealizada ? "realizada" : r.estado,
                }
              : r
          )
        );
        setReunionParaMinuta(null);
      }
    });
  }

  function handleCancelarReunion(e: React.FormEvent) {
    e.preventDefault();
    if (!reunionParaCancelar) return;
    setMensajeError(null);

    const formData = new FormData();
    formData.set("reunion_id", reunionParaCancelar.id);
    formData.set("motivo", motivoCancelacion);

    startTransition(async () => {
      const res = await cancelarReunionAction({}, formData);
      if (res.error) {
        setMensajeError(res.error);
      } else {
        setMensajeExito("Reunión cancelada.");
        setReuniones((prev) =>
          prev.map((r) =>
            r.id === reunionParaCancelar.id
              ? { ...r, estado: "cancelada" }
              : r
          )
        );
        setReunionParaCancelar(null);
        setMotivoCancelacion("");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Banner de mensajes de éxito o error */}
      {mensajeExito && (
        <div className="flex items-center justify-between rounded-xl border border-marca-600/30 bg-marca-50/50 p-4 text-sm text-marca-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-marca-600" />
            <span className="font-medium">{mensajeExito}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeExito(null)}
            className="text-marca-700 hover:text-marca-900"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {mensajeError && (
        <div className="flex items-center justify-between rounded-xl border border-linea bg-muted p-4 text-sm text-tinta animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 text-tinta" />
            <span className="font-medium">{mensajeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeError(null)}
            className="text-tinta-2 hover:text-tinta"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Métricas destacadas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-linea bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-marca-600 mb-1">
              <Calendar className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-tinta-2">
                {t("metrics.total")}
              </span>
            </div>
            <div className="text-2xl font-bold text-tinta">
              {metricas.total_reuniones}
            </div>
          </CardContent>
        </Card>

        <Card className="border-linea bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-marca-600 mb-1">
              <Clock className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-tinta-2">
                {t("metrics.scheduled")}
              </span>
            </div>
            <div className="text-2xl font-bold text-tinta">
              {metricas.programadas}
            </div>
          </CardContent>
        </Card>

        <Card className="border-linea bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-marca-600 mb-1">
              <CalendarCheck className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-tinta-2">
                {t("metrics.completedMonth")}
              </span>
            </div>
            <div className="text-2xl font-bold text-tinta">
              {metricas.realizadas_mes}
            </div>
          </CardContent>
        </Card>

        <Card className="border-linea bg-card shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-marca-600 mb-1">
              <Users className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-tinta-2">
                {t("metrics.attendees")}
              </span>
            </div>
            <div className="text-2xl font-bold text-tinta">
              {metricas.total_participantes}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de controles, filtros y acción de agendar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-tinta-2" />
            <Input
              type="text"
              placeholder={t("filters.searchPlaceholder")}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-10 border-linea"
            />
          </div>

          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[140px] h-10 border-linea">
              <SelectValue placeholder={t("filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">{t("filters.all")}</SelectItem>
              <SelectItem value="programadas">{t("status.programada")}</SelectItem>
              <SelectItem value="realizadas">{t("status.realizada")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[160px] h-10 border-linea">
              <SelectValue placeholder={t("filters.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("filters.allTypes")}</SelectItem>
              <SelectItem value="coordinacion">{t("types.coordinacion")}</SelectItem>
              <SelectItem value="tutoria">{t("types.tutoria")}</SelectItem>
              <SelectItem value="seguimiento_estudiante">{t("types.seguimiento_estudiante")}</SelectItem>
              <SelectItem value="departamental">{t("types.departamental")}</SelectItem>
              <SelectItem value="direccion">{t("types.direccion")}</SelectItem>
              <SelectItem value="general">{t("types.general")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={() => setDialogoAgendarAbierto(true)}
          className="h-11 min-h-[44px] gap-2 bg-marca-600 text-white hover:bg-marca-700 active:scale-95 transition-all shadow-xs shrink-0"
        >
          <CalendarPlus className="size-4.5" />
          <span>{t("actions.scheduleNew")}</span>
        </Button>
      </div>

      {/* Lista de tarjetas de reuniones */}
      {reunionesFiltradas.length === 0 ? (
        <Card className="border-dashed border-linea p-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-tinta-2 mb-3">
            <Calendar className="size-6" />
          </div>
          <h3 className="text-base font-semibold text-tinta">
            {t("empty.title")}
          </h3>
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogoAgendarAbierto(true)}
            className="mt-4 gap-2 border-linea min-h-[44px] active:scale-95"
          >
            <CalendarPlus className="size-4" />
            {t("actions.scheduleNew")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reunionesFiltradas.map((r) => {
            const esAnfitrionOAdmin =
              puedeGestionar || r.organizador_usuario_id === usuarioActualId;
            const tieneMinuta = Boolean(r.conclusiones_o_minuta);

            return (
              <Card
                key={r.id}
                className={cn(
                  "border-linea bg-card transition-all hover:border-marca-600/40 hover:shadow-sm flex flex-col justify-between",
                  r.estado === "cancelada" && "opacity-60 bg-muted/30"
                )}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-marca-700">
                          #{String(r.folio).padStart(3, "0")}
                        </span>
                        <Badge variant="outline" className="text-tinta-2 border-linea">
                          {t(`types.${r.tipo}` as never) || r.tipo}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "capitalize text-xs",
                            r.estado === "realizada" && "bg-marca-50 text-marca-700 border border-marca-600/20",
                            r.estado === "programada" && "bg-muted text-tinta font-semibold",
                            r.estado === "cancelada" && "bg-muted text-tinta-2 line-through"
                          )}
                        >
                          {t(`status.${r.estado}` as never) || r.estado}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-base text-tinta leading-snug truncate">
                        {r.titulo}
                      </h3>
                    </div>

                    <div className="shrink-0">
                      {r.modalidad === "virtual" ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-marca-700 bg-marca-50 px-2.5 py-1 rounded-md border border-marca-600/20">
                          <Video className="size-3.5" />
                          <span>{t("modality.virtual")}</span>
                        </div>
                      ) : r.modalidad === "hibrida" ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-marca-700 bg-marca-50 px-2.5 py-1 rounded-md border border-marca-600/20">
                          <Sparkles className="size-3.5" />
                          <span>{t("modality.hibrida")}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs font-medium text-tinta-2 bg-muted px-2.5 py-1 rounded-md">
                          <MapPin className="size-3.5" />
                          <span>{t("modality.presencial")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {r.descripcion && (
                    <p className="text-xs text-tinta-2 line-clamp-2 mt-2">
                      {r.descripcion}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {/* Fecha y Horario */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-tinta-2 border-y border-linea py-2.5 my-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-marca-600" />
                      <span className="font-medium text-tinta">{r.fecha}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-marca-600" />
                      <span className="font-mono text-tinta">
                        {r.hora_inicio} - {r.hora_fin}
                      </span>
                    </div>
                    {r.lugar_o_enlace && (
                      <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                        {r.lugar_o_enlace.startsWith("http") ? (
                          <a
                            href={r.lugar_o_enlace}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-marca-600 hover:underline flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="size-3 shrink-0" />
                            <span className="truncate">{r.lugar_o_enlace}</span>
                          </a>
                        ) : (
                          <span className="truncate text-tinta">{r.lugar_o_enlace}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Participantes y anfitrión */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-tinta-2">
                      <span className="font-semibold text-tinta">
                        {t("cards.attendees")}:
                      </span>
                      <span className="text-tinta-2">
                        {t("cards.host")}: {r.organizador_nombre}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(r.participantes ?? []).map((p) => (
                        <span
                          key={p.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs border border-linea bg-muted/60",
                            p.rol_en_reunion === "anfitrion" &&
                              "border-marca-600/30 bg-marca-50 text-marca-800 font-medium"
                          )}
                        >
                          {p.tipo_participante === "estudiante" && (
                            <GraduationCap className="size-3 text-marca-600" />
                          )}
                          <span className="truncate max-w-[120px]">{p.nombre}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Minuta si existe */}
                  {tieneMinuta && (
                    <div className="rounded-lg border border-linea bg-muted/40 p-3 space-y-1 text-xs">
                      <div className="flex items-center gap-1 font-semibold text-tinta">
                        <FileText className="size-3.5 text-marca-600" />
                        <span>{t("minuta.title")}:</span>
                      </div>
                      <p className="text-tinta-2 whitespace-pre-line line-clamp-3">
                        {r.conclusiones_o_minuta}
                      </p>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-linea/60">
                    {esAnfitrionOAdmin && r.estado !== "cancelada" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => abrirModalMinuta(r)}
                        className="h-9 min-h-[36px] gap-1.5 text-xs border-linea active:scale-95"
                      >
                        <FileText className="size-3.5 text-marca-600" />
                        <span>
                          {tieneMinuta ? t("actions.editMinuta") : t("actions.writeMinuta")}
                        </span>
                      </Button>
                    )}

                    {esAnfitrionOAdmin && r.estado === "programada" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setReunionParaCancelar(r)}
                        className="h-9 min-h-[36px] gap-1.5 text-xs text-tinta-2 hover:text-tinta active:scale-95"
                      >
                        <Ban className="size-3.5" />
                        <span>{t("actions.cancel")}</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Agendar Nueva Reunión */}
      <Dialog
        open={dialogoAgendarAbierto}
        onOpenChange={setDialogoAgendarAbierto}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-w-xl max-h-[90vh] overflow-y-auto"
        >
          <form onSubmit={handleAgendar} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-tinta">
                <CalendarPlus className="size-5 text-marca-600" />
                {t("dialogSchedule.title")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="reu-titulo" className="text-xs font-semibold">
                  {t("dialogSchedule.subject")} *
                </Label>
                <Input
                  id="reu-titulo"
                  required
                  placeholder={t("dialogSchedule.subjectPlaceholder")}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="h-10 border-linea"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {t("dialogSchedule.type")}
                  </Label>
                  <Select
                    value={tipo}
                    onValueChange={(v) => setTipo(v as TipoReunion)}
                  >
                    <SelectTrigger className="h-10 border-linea">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coordinacion">{t("types.coordinacion")}</SelectItem>
                      <SelectItem value="tutoria">{t("types.tutoria")}</SelectItem>
                      <SelectItem value="seguimiento_estudiante">{t("types.seguimiento_estudiante")}</SelectItem>
                      <SelectItem value="departamental">{t("types.departamental")}</SelectItem>
                      <SelectItem value="direccion">{t("types.direccion")}</SelectItem>
                      <SelectItem value="general">{t("types.general")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {t("dialogSchedule.modality")}
                  </Label>
                  <Select
                    value={modalidad}
                    onValueChange={(v) => setModalidad(v as ModalidadReunion)}
                  >
                    <SelectTrigger className="h-10 border-linea">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">{t("modality.presencial")}</SelectItem>
                      <SelectItem value="virtual">{t("modality.virtual")}</SelectItem>
                      <SelectItem value="hibrida">{t("modality.hibrida")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="reu-fecha" className="text-xs font-semibold">
                    {t("dialogSchedule.date")} *
                  </Label>
                  <Input
                    id="reu-fecha"
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="h-10 border-linea text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reu-hora-inicio" className="text-xs font-semibold">
                    {t("dialogSchedule.startTime")} *
                  </Label>
                  <Input
                    id="reu-hora-inicio"
                    type="time"
                    required
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="h-10 border-linea text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reu-hora-fin" className="text-xs font-semibold">
                    {t("dialogSchedule.endTime")} *
                  </Label>
                  <Input
                    id="reu-hora-fin"
                    type="time"
                    required
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className="h-10 border-linea text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reu-lugar" className="text-xs font-semibold">
                  {modalidad === "virtual"
                    ? t("dialogSchedule.linkVirtual")
                    : t("dialogSchedule.roomOrLink")}
                </Label>
                <Input
                  id="reu-lugar"
                  placeholder={
                    modalidad === "virtual"
                      ? "https://meet.google.com/..."
                      : t("dialogSchedule.roomPlaceholder")
                  }
                  value={lugarOEnlace}
                  onChange={(e) => setLugarOEnlace(e.target.value)}
                  className="h-10 border-linea"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="reu-desc" className="text-xs font-semibold">
                  {t("dialogSchedule.descriptionLabel")}
                </Label>
                <Textarea
                  id="reu-desc"
                  rows={2}
                  placeholder={t("dialogSchedule.descPlaceholder")}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="border-linea text-xs resize-none"
                />
              </div>

              {/* Selector de Participantes */}
              <div className="space-y-2 border-t border-linea pt-2">
                <Label className="text-xs font-semibold">
                  {t("dialogSchedule.inviteParticipants")}
                </Label>

                {/* Seleccionados */}
                {participantesSeleccionados.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-muted/40 border border-linea">
                    {participantesSeleccionados.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 rounded-md bg-marca-50 text-marca-800 border border-marca-600/30 px-2 py-0.5 text-xs font-medium"
                      >
                        {p.tipo === "estudiante" && (
                          <GraduationCap className="size-3 text-marca-600" />
                        )}
                        <span>{p.nombre}</span>
                        <button
                          type="button"
                          onClick={() => toggleParticipante(p)}
                          className="hover:text-marca-900"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Buscador de candidatos */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-tinta-2" />
                  <Input
                    type="text"
                    placeholder={t("dialogSchedule.searchAttendeesPlaceholder")}
                    value={busquedaCandidato}
                    onChange={(e) => setBusquedaCandidato(e.target.value)}
                    className="pl-8 h-9 text-xs border-linea"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto rounded-md border border-linea divide-y divide-linea">
                  {candidatosFiltrados.map((c) => {
                    const seleccionado = participantesSeleccionados.some(
                      (p) => p.id === c.id
                    );
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleParticipante(c)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 text-left text-xs transition-colors hover:bg-muted/60",
                          seleccionado && "bg-marca-50/70 text-marca-900 font-medium"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {c.tipo === "estudiante" ? (
                            <GraduationCap className="size-3.5 text-marca-600 shrink-0" />
                          ) : (
                            <Users className="size-3.5 text-tinta-2 shrink-0" />
                          )}
                          <span className="truncate">{c.nombre}</span>
                          <span className="text-tinta-2 text-[10px]">({c.detalle_rol})</span>
                        </div>
                        {seleccionado && (
                          <CheckCircle2 className="size-3.5 text-marca-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-linea">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogoAgendarAbierto(false)}
                className="h-10 min-h-[44px] active:scale-95"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 min-h-[44px] bg-marca-600 text-white hover:bg-marca-700 active:scale-95 transition-all"
              >
                {isPending ? t("actions.saving") : t("actions.confirmSchedule")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Redactar Minuta y Acuerdos */}
      <Dialog
        open={Boolean(reunionParaMinuta)}
        onOpenChange={(abierto) => !abierto && setReunionParaMinuta(null)}
      >
        <DialogContent className="max-w-xl">
          <form onSubmit={handleGuardarMinuta} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-tinta">
                <FileText className="size-5 text-marca-600" />
                {t("dialogMinuta.title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-tinta-2">
                {reunionParaMinuta?.titulo} (#{reunionParaMinuta?.folio}) —{" "}
                {reunionParaMinuta?.fecha}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="reu-minuta-texto" className="text-xs font-semibold">
                  {t("dialogMinuta.conclusionsAndAgreements")} *
                </Label>
                <Textarea
                  id="reu-minuta-texto"
                  required
                  rows={6}
                  placeholder={t("dialogMinuta.placeholder")}
                  value={textoMinuta}
                  onChange={(e) => setTextoMinuta(e.target.value)}
                  className="border-linea text-xs font-sans"
                />
              </div>

              {/* Registro de Asistencia */}
              {reunionParaMinuta?.participantes &&
                reunionParaMinuta.participantes.length > 0 && (
                  <div className="space-y-2 border-t border-linea pt-2">
                    <Label className="text-xs font-semibold">
                      {t("dialogMinuta.attendanceCheck")}
                    </Label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {reunionParaMinuta.participantes.map((p) => {
                        const estado = asistencias[p.id] ?? "asistio";
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-linea text-xs"
                          >
                            <span className="font-medium text-tinta truncate max-w-[200px]">
                              {p.nombre}
                            </span>
                            <div className="flex items-center gap-1">
                              {(["asistio", "ausente", "justificada"] as const).map(
                                (opcion) => (
                                  <button
                                    key={opcion}
                                    type="button"
                                    onClick={() =>
                                      setAsistencias((prev) => ({
                                        ...prev,
                                        [p.id]: opcion,
                                      }))
                                    }
                                    className={cn(
                                      "px-2 py-0.5 rounded text-[11px] capitalize border transition-all",
                                      estado === opcion
                                        ? "bg-marca-600 text-white border-marca-600 font-semibold"
                                        : "border-linea text-tinta-2 hover:bg-muted"
                                    )}
                                  >
                                    {opcion}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-realizada"
                  checked={marcarRealizada}
                  onChange={(e) => setMarcarRealizada(e.target.checked)}
                  className="rounded border-linea size-4 text-marca-600"
                />
                <Label htmlFor="chk-realizada" className="text-xs font-medium cursor-pointer">
                  {t("dialogMinuta.markCompleted")}
                </Label>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-linea">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReunionParaMinuta(null)}
                className="h-10 min-h-[44px] active:scale-95"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 min-h-[44px] bg-marca-600 text-white hover:bg-marca-700 active:scale-95 transition-all"
              >
                {isPending ? t("actions.saving") : t("actions.saveMinuta")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Cancelar Reunión */}
      <Dialog
        open={Boolean(reunionParaCancelar)}
        onOpenChange={(abierto) => !abierto && setReunionParaCancelar(null)}
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleCancelarReunion} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-tinta">
                <Ban className="size-5 text-tinta" />
                {t("dialogCancel.title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-tinta-2">
                {t("dialogCancel.description", {
                  folio: reunionParaCancelar?.folio ?? 0,
                  titulo: reunionParaCancelar?.titulo ?? "",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <Label htmlFor="reu-motivo-cancel" className="text-xs font-semibold">
                {t("dialogCancel.reason")} *
              </Label>
              <Textarea
                id="reu-motivo-cancel"
                required
                rows={3}
                placeholder={t("dialogCancel.reasonPlaceholder")}
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                className="border-linea text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-linea">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReunionParaCancelar(null)}
                className="h-10 min-h-[44px] active:scale-95"
              >
                {t("actions.back")}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 min-h-[44px] bg-tinta text-white hover:bg-tinta-2 active:scale-95 transition-all"
              >
                {isPending ? t("actions.cancelling") : t("actions.confirmCancel")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
