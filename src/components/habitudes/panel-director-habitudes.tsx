"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Plus,
  School,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { UbicarLiceo } from "@/components/habitudes/ubicar-liceo";
import { MapaLaVega, type LiceoMapaItem } from "@/components/mapa/mapa-la-vega";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { HabitudesLiceo, ProfesorMonitoreoItem, TandaLiceo } from "@/lib/habitudes";
import { buscarMunicipio, MUNICIPIOS_LA_VEGA } from "@/lib/la-vega-geografia";
import {
  asignarEstudianteLiceoAction,
  asignarProfesorLiceoAction,
} from "@/server/habitudes/acciones";

interface PropsPanelDirector {
  liceos: HabitudesLiceo[];
  profesores: ProfesorMonitoreoItem[];
  docentesDisponibles: Array<{ id: string; nombre: string; email: string }>;
  estudiantesDisponibles: Array<{ id: string; nombre: string; matricula: string | null }>;
}

export function PanelDirectorHabitudes({
  liceos,
  profesores,
  docentesDisponibles,
  estudiantesDisponibles,
}: PropsPanelDirector) {
  const [tabAccion, setTabAccion] = useState<"profesor" | "estudiante">("profesor");
  const [profesorId, setProfesorId] = useState(docentesDisponibles[0]?.id ?? "");
  const [liceoId, setLiceoId] = useState(liceos[0]?.id ?? "");
  const [tanda, setTanda] = useState("matutina");
  const [estudianteId, setEstudianteId] = useState(estudiantesDisponibles[0]?.id ?? "");
  const [grado, setGrado] = useState("5to Secundaria");
  const [seccion, setSeccion] = useState("A");

  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const tMapa = useTranslations("common.mapa");
  const tHab = useTranslations("habitudes");
  const tDir = useTranslations("habitudes.director");
  const tTanda = (tanda: TandaLiceo) =>
    ({
      matutina: tHab("shiftMorning"),
      vespertina: tHab("shiftAfternoon"),
      jornada_extendida: tHab("shiftExtended"),
      nocturna: tHab("shiftNight"),
    })[tanda] ?? tanda;

  // Los liceos sin coordenadas no desaparecen del mapa: se pintan huecos en
  // el centro de su municipio, marcados como aproximados, hasta que alguien
  // los ubique con «Ubicar liceo».
  const liceosParaMapa: LiceoMapaItem[] = liceos.flatMap((l) => {
    const exacto = l.latitud != null && l.longitud != null;
    const centro = buscarMunicipio(l.municipio)?.centro;
    if (!exacto && !centro) return [];
    return [
      {
        id: l.id,
        nombre: l.nombre,
        codigo: l.codigo,
        direccion: l.direccion,
        municipio: l.municipio,
        sector: l.sector,
        latitud: exacto ? l.latitud! : centro![0],
        longitud: exacto ? l.longitud! : centro![1],
        aproximado: !exacto,
        ultimaVisita: l.ultimaVisita,
        profesores: l.profesoresAsignados?.map((p) => ({
          nombre: p.profesorNombre,
          tanda: tTanda(p.tanda),
        })),
        estudiantesCount: l.totalEstudiantes,
      },
    ];
  });
  const geolocalizados = liceosParaMapa.filter((l) => !l.aproximado).length;

  const handleAsignarProfesor = (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    startTransition(async () => {
      const res = await asignarProfesorLiceoAction({
        liceoId,
        profesorId,
        tanda,
        // Valor de datos que se guarda en la base, no texto de interfaz: no se traduce.
        materiaTaller: "Liderazgo Habitudes",
      });

      if (res.ok) {
        setMensaje({ tipo: "exito", texto: res.mensaje ?? tDir("okProfesor") });
      } else {
        setMensaje({ tipo: "error", texto: res.mensaje ?? tDir("errProfesor") });
      }
    });
  };

  const handleAsignarEstudiante = (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    startTransition(async () => {
      const res = await asignarEstudianteLiceoAction({
        liceoId,
        estudianteId,
        grado,
        seccion,
      });

      if (res.ok) {
        setMensaje({ tipo: "exito", texto: res.mensaje ?? tDir("okEstudiante") });
      } else {
        setMensaje({ tipo: "error", texto: res.mensaje ?? tDir("errEstudiante") });
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Banner del Director de Habitudes (DH) */}
      <div className="p-5 rounded-card bg-marca-50 border border-marca-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-card bg-marca-500 text-white flex items-center justify-center font-black text-lg shadow-card shrink-0">
            DH
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-tinta">
                {tDir("titulo")}
              </h2>
              <span className="text-[10px] font-bold uppercase bg-marca-700 text-white px-2 py-0.5 rounded-full">
                {tDir("rol")}
              </span>
            </div>
            <p className="text-xs text-tinta-2 mt-0.5">
              {tDir("descripcion")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-tinta-2 bg-card px-3 py-1.5 rounded-control border border-linea">
          <MapPin className="size-3.5 text-marca-500" />
          <span>{tMapa("redLiceos.chip", { municipios: MUNICIPIOS_LA_VEGA.length, liceos: liceos.length })}</span>
        </div>
      </div>

      {/* 1. Red de liceos en el mapa */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="texto-titulo-seccion flex items-center gap-2">
              <Building2 className="size-5 text-marca-600" />
              {tMapa("redLiceos.titulo")}
            </h3>
            <p className="texto-meta mt-1">{tMapa("redLiceos.subtitulo")}</p>
          </div>
          <span className="texto-meta">
            {tMapa("redLiceos.geolocalizados", { n: geolocalizados, total: liceos.length })}
          </span>
        </div>

        <MapaLaVega
          modo="liceos"
          liceos={liceosParaMapa}
          altura="460px"
          etiqueta={tMapa("redLiceos.etiqueta")}
        />

        {liceos.length > 0 && <UbicarLiceo liceos={liceos} />}
      </section>

      {/* 2. MONITOREO DE PROFESORES Y EVIDENCIAS DE CLASE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-tinta flex items-center gap-2">
              <Users className="size-4 text-marca-500" />
              {tDir("monitoreoTitulo")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {tDir("monitoreoDescripcion")}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {tDir("facilitadoresActivos", { n: profesores.length })}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profesores.map((prof) => (
            <Card key={prof.id} className="rounded-card border-linea shadow-card overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-control bg-muted text-marca-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {prof.nombre.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-tinta">
                        {prof.nombre}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{prof.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-tinta-2">
                    {prof.rol}
                  </span>
                </div>

                {/* Liceos donde da clase */}
                <div className="space-y-1 bg-muted p-2.5 rounded-control border border-linea text-xs">
                  <span className="text-[10px] uppercase font-bold text-tinta-3 tracking-wider">
                    {tDir("liceosAsignados", { n: prof.liceosAsignados.length })}
                  </span>
                  {prof.liceosAsignados.length > 0 ? (
                    <ul className="space-y-1 mt-1">
                      {prof.liceosAsignados.map((lic, idx) => (
                        <li key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-tinta truncate pr-2">
                            {lic.liceoNombre}
                          </span>
                          <span className="text-[10px] text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-linea shrink-0">
                            {lic.tanda}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-tinta-3 italic">{tDir("sinLiceos")}</p>
                  )}
                </div>

                {/* Métricas de Evidencias */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-linea text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground">{tDir("evidenciasFotos")}</span>
                    <p className="font-bold text-xs text-marca-700">
                      {tDir("visitas", { n: prof.totalEvidencias })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">{tDir("estudiantes")}</span>
                    <p className="font-bold text-xs text-marca-500">
                      {tDir("impacto", { n: prof.estudiantesImpactados })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. CENTRO DE ASIGNACIONES (PROFESORES Y ESTUDIANTES A LICEOS) */}
      <div className="bg-card p-6 rounded-card border border-linea shadow-card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-linea">
          <div>
            <h3 className="text-sm font-bold text-tinta flex items-center gap-2">
              <UserPlus className="size-4 text-marca-500" />
              {tDir("asignacionesTitulo")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {tDir("asignacionesDescripcion")}
            </p>
          </div>

          <div className="flex rounded-control bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setTabAccion("profesor")}
              className={`px-3 py-1.5 rounded-control font-medium transition-all cursor-pointer ${
                tabAccion === "profesor"
                  ? "bg-card text-marca-700 shadow-card"
                  : "text-tinta-2"
              }`}
            >
              {tDir("tabProfesor")}
            </button>
            <button
              type="button"
              onClick={() => setTabAccion("estudiante")}
              className={`px-3 py-1.5 rounded-control font-medium transition-all cursor-pointer ${
                tabAccion === "estudiante"
                  ? "bg-card text-marca-700 shadow-card"
                  : "text-tinta-2"
              }`}
            >
              {tDir("tabEstudiante")}
            </button>
          </div>
        </div>

        {mensaje && (
          <div
            role="status"
            // Un aviso no es el estado de una entidad: no lleva semáforo.
            className={`p-3 rounded-control text-xs flex items-center gap-2 ${
              mensaje.tipo === "exito"
                ? "bg-marca-50 text-marca-700"
                : "bg-tinta text-background"
            }`}
          >
            {mensaje.tipo === "exito" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* Formulario 1: Asignar Profesor */}
        {tabAccion === "profesor" && (
          <form onSubmit={handleAsignarProfesor} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-tinta-2 mb-1">
                {tDir("profesorLabel")}
              </label>
              <select
                value={profesorId}
                onChange={(e) => setProfesorId(e.target.value)}
                className="w-full h-9 rounded-control border border-linea bg-card px-3 text-xs outline-none focus:border-marca-500"
              >
                {docentesDisponibles.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.nombre} ({doc.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 mb-1">
                {tDir("liceoLabel")}
              </label>
              <select
                value={liceoId}
                onChange={(e) => setLiceoId(e.target.value)}
                className="w-full h-9 rounded-control border border-linea bg-card px-3 text-xs outline-none focus:border-marca-500"
              >
                {liceos.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.nombre} ({lic.municipio ?? tDir("municipioPorDefecto")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 mb-1">
                {tDir("tandaLabel")}
              </label>
              <select
                value={tanda}
                onChange={(e) => setTanda(e.target.value)}
                className="w-full h-9 rounded-control border border-linea bg-card px-3 text-xs outline-none focus:border-marca-500"
              >
                <option value="matutina">{tTanda("matutina")}</option>
                <option value="vespertina">{tTanda("vespertina")}</option>
                <option value="jornada_extendida">{tTanda("jornada_extendida")}</option>
                <option value="nocturna">{tTanda("nocturna")}</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-9 text-xs font-semibold"
              >
                {isPending ? tDir("asignando") : tDir("guardarAsignacion")}
              </Button>
            </div>
          </form>
        )}

        {/* Formulario 2: Vincular Estudiante */}
        {tabAccion === "estudiante" && (
          <form onSubmit={handleAsignarEstudiante} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-tinta-2 mb-1">
                {tDir("estudianteLabel")}
              </label>
              <select
                value={estudianteId}
                onChange={(e) => setEstudianteId(e.target.value)}
                className="w-full h-9 rounded-control border border-linea bg-card px-3 text-xs outline-none focus:border-marca-500"
              >
                {estudiantesDisponibles.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.nombre} {est.matricula ? `(${est.matricula})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 mb-1">
                {tDir("liceoDestino")}
              </label>
              <select
                value={liceoId}
                onChange={(e) => setLiceoId(e.target.value)}
                className="w-full h-9 rounded-control border border-linea bg-card px-3 text-xs outline-none focus:border-marca-500"
              >
                {liceos.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 mb-1">
                {tDir("gradoLabel")}
              </label>
              <input
                type="text"
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
                placeholder={tDir("gradoPlaceholder")}
                className="w-full h-9 rounded-control border border-linea bg-card px-3 text-xs outline-none focus:border-marca-500"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-9 text-xs font-semibold"
              >
                {isPending ? tDir("vinculando") : tDir("vincularEstudiante")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
