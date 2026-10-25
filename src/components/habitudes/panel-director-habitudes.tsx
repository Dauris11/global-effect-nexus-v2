"use client";

import { useState, useTransition } from "react";
import {
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

import { MapaLaVega } from "@/components/mapa/mapa-la-vega";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { HabitudesLiceo, ProfesorMonitoreoItem } from "@/lib/habitudes";
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

  // Mapear liceos para el componente del mapa de La Vega
  const liceosParaMapa = liceos
    .filter((l) => l.latitud != null && l.longitud != null)
    .map((l) => ({
      id: l.id,
      nombre: l.nombre,
      codigo: l.codigo,
      direccion: l.direccion,
      municipio: l.municipio,
      sector: l.sector,
      latitud: l.latitud!,
      longitud: l.longitud!,
      profesores: l.profesoresAsignados?.map((p) => ({
        nombre: p.profesorNombre,
        tanda: p.tanda,
      })),
      estudiantesCount: l.totalEstudiantes,
    }));

  const handleAsignarProfesor = (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    startTransition(async () => {
      const res = await asignarProfesorLiceoAction({
        liceoId,
        profesorId,
        tanda,
        materiaTaller: "Liderazgo Habitudes",
      });

      if (res.ok) {
        setMensaje({ tipo: "exito", texto: res.mensaje ?? "Profesor asignado con éxito." });
      } else {
        setMensaje({ tipo: "error", texto: res.mensaje ?? "Error al asignar." });
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
        setMensaje({ tipo: "exito", texto: res.mensaje ?? "Estudiante vinculado con éxito." });
      } else {
        setMensaje({ tipo: "error", texto: res.mensaje ?? "Error al vincular estudiante." });
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Banner del Director de Habitudes (DH) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#2096BA]/15 via-white dark:via-slate-900 to-[#0a6a8a]/15 border border-[#2096BA]/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-[#2096BA] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
            DH
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-tinta dark:text-slate-100">
                Dirección Pedagógica y Supervisión de Habitudes (DH)
              </h2>
              <span className="text-[10px] font-bold uppercase bg-[#0a6a8a] text-white px-2 py-0.5 rounded-full">
                Rol Oficial DH
              </span>
            </div>
            <p className="text-xs text-tinta-2 dark:text-slate-400 mt-0.5">
              Monitoreo en tiempo real de facilitadores, evidencias fotográficas y red de liceos exclusiva de la provincia de La Vega.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-tinta-2 dark:text-slate-300 bg-white/80 dark:bg-slate-950/80 px-3 py-1.5 rounded-xl border border-linea dark:border-slate-800">
          <MapPin className="size-3.5 text-[#2096BA]" />
          <span>Provincia La Vega: 4 Municipios &bull; {liceos.length} Liceos Activos</span>
        </div>
      </div>

      {/* 1. MAPA INTERACTIVO DE LA VEGA (REGLA ESTRICTA) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-tinta dark:text-slate-100 flex items-center gap-2">
              <Building2 className="size-4 text-[#2096BA]" />
              Red Geoespacial de Liceos — Provincia de La Vega
            </h3>
            <p className="text-xs text-muted-foreground">
              Mapa oficial interactivo restringido exclusivamente al territorio de La Vega (Concepción de La Vega, Jarabacoa, Constanza y Jima Abajo).
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {liceosParaMapa.length} centros geolocalizados
          </span>
        </div>

        <MapaLaVega
          modo="liceos"
          liceos={liceosParaMapa}
          altura="440px"
          etiqueta="Liceos oficiales donde opera el Programa Habitudes en La Vega"
        />
      </div>

      {/* 2. MONITOREO DE PROFESORES Y EVIDENCIAS DE CLASE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-tinta dark:text-slate-100 flex items-center gap-2">
              <Users className="size-4 text-[#2096BA]" />
              Monitoreo de Profesores y Despliegue en Liceos
            </h3>
            <p className="text-xs text-muted-foreground">
              Supervisión de cada facilitador: liceos asignados, tandas, evidencias fotográficas subidas y alcance de impacto.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {profesores.length} facilitadores activos
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profesores.map((prof) => (
            <Card key={prof.id} className="rounded-2xl border-linea dark:border-slate-800 shadow-xs overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-muted dark:bg-slate-800 text-[#187a99] dark:text-[#5FB8D4] flex items-center justify-center font-bold text-xs shrink-0">
                      {prof.nombre.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-tinta dark:text-slate-100">
                        {prof.nombre}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{prof.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono bg-muted dark:bg-slate-800 px-2 py-0.5 rounded text-tinta-2 dark:text-slate-400">
                    {prof.rol}
                  </span>
                </div>

                {/* Liceos donde da clase */}
                <div className="space-y-1 bg-muted dark:bg-slate-900/60 p-2.5 rounded-xl border border-linea dark:border-slate-800/80 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Liceos Asignados ({prof.liceosAsignados.length}):
                  </span>
                  {prof.liceosAsignados.length > 0 ? (
                    <ul className="space-y-1 mt-1">
                      {prof.liceosAsignados.map((lic, idx) => (
                        <li key={idx} className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-tinta dark:text-slate-200 truncate pr-2">
                            {lic.liceoNombre}
                          </span>
                          <span className="text-[10px] text-muted-foreground bg-card dark:bg-slate-800 px-1.5 py-0.5 rounded border border-linea/60 dark:border-slate-700 shrink-0">
                            {lic.tanda}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Sin liceos asignados actualmente.</p>
                  )}
                </div>

                {/* Métricas de Evidencias */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-linea dark:border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Evidencias Fotos</span>
                    <p className="font-bold text-xs text-[#0a6a8a] dark:text-[#5FB8D4]">
                      {prof.totalEvidencias} visitas
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Estudiantes</span>
                    <p className="font-bold text-xs text-[#2096BA]">
                      {prof.estudiantesImpactados} impacto
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. CENTRO DE ASIGNACIONES (PROFESORES Y ESTUDIANTES A LICEOS) */}
      <div className="bg-card dark:bg-slate-900 p-6 rounded-2xl border border-linea dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-linea dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-tinta dark:text-slate-100 flex items-center gap-2">
              <UserPlus className="size-4 text-[#2096BA]" />
              Gestión de Asignaciones a Liceos de La Vega
            </h3>
            <p className="text-xs text-muted-foreground">
              Asigna profesores para impartir talleres en centros educativos o inscribe estudiantes en sus respectivos liceos.
            </p>
          </div>

          <div className="flex rounded-xl bg-muted dark:bg-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => setTabAccion("profesor")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                tabAccion === "profesor"
                  ? "bg-card dark:bg-slate-950 text-[#0a6a8a] dark:text-[#5FB8D4] shadow-xs"
                  : "text-tinta-2 dark:text-slate-400"
              }`}
            >
              Asignar Profesor a Liceo
            </button>
            <button
              type="button"
              onClick={() => setTabAccion("estudiante")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                tabAccion === "estudiante"
                  ? "bg-card dark:bg-slate-950 text-[#0a6a8a] dark:text-[#5FB8D4] shadow-xs"
                  : "text-tinta-2 dark:text-slate-400"
              }`}
            >
              Vincular Estudiante a Liceo
            </button>
          </div>
        </div>

        {mensaje && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              mensaje.tipo === "exito"
                ? "bg-[#1E9E6A]/10 text-[#1E9E6A] border-[#1E9E6A]/30"
                : "bg-[#B4342B]/10 text-[#B4342B] border-[#B4342B]/30"
            }`}
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* Formulario 1: Asignar Profesor */}
        {tabAccion === "profesor" && (
          <form onSubmit={handleAsignarProfesor} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-tinta-2 dark:text-slate-300 mb-1">
                Profesor / Facilitador
              </label>
              <select
                value={profesorId}
                onChange={(e) => setProfesorId(e.target.value)}
                className="w-full h-9 rounded-xl border border-linea dark:border-slate-700 bg-card dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#2096BA]"
              >
                {docentesDisponibles.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.nombre} ({doc.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 dark:text-slate-300 mb-1">
                Liceo de La Vega
              </label>
              <select
                value={liceoId}
                onChange={(e) => setLiceoId(e.target.value)}
                className="w-full h-9 rounded-xl border border-linea dark:border-slate-700 bg-card dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#2096BA]"
              >
                {liceos.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.nombre} ({lic.municipio ?? "La Vega"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 dark:text-slate-300 mb-1">
                Tanda de Clases
              </label>
              <select
                value={tanda}
                onChange={(e) => setTanda(e.target.value)}
                className="w-full h-9 rounded-xl border border-linea dark:border-slate-700 bg-card dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#2096BA]"
              >
                <option value="matutina">Tanda Matutina</option>
                <option value="vespertina">Tanda Vespertina</option>
                <option value="jornada_extendida">Jornada Extendida</option>
                <option value="nocturna">Tanda Nocturna</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-9 rounded-xl bg-[#2096BA] hover:bg-[#187a99] text-white text-xs font-semibold"
              >
                {isPending ? "Asignando..." : "Guardar Asignación"}
              </Button>
            </div>
          </form>
        )}

        {/* Formulario 2: Vincular Estudiante */}
        {tabAccion === "estudiante" && (
          <form onSubmit={handleAsignarEstudiante} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-tinta-2 dark:text-slate-300 mb-1">
                Estudiante Activo
              </label>
              <select
                value={estudianteId}
                onChange={(e) => setEstudianteId(e.target.value)}
                className="w-full h-9 rounded-xl border border-linea dark:border-slate-700 bg-card dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#2096BA]"
              >
                {estudiantesDisponibles.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.nombre} {est.matricula ? `(${est.matricula})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 dark:text-slate-300 mb-1">
                Liceo Destino
              </label>
              <select
                value={liceoId}
                onChange={(e) => setLiceoId(e.target.value)}
                className="w-full h-9 rounded-xl border border-linea dark:border-slate-700 bg-card dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#2096BA]"
              >
                {liceos.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-tinta-2 dark:text-slate-300 mb-1">
                Grado
              </label>
              <input
                type="text"
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
                placeholder="Ej. 5to Secundaria"
                className="w-full h-9 rounded-xl border border-linea dark:border-slate-700 bg-card dark:bg-slate-950 px-3 text-xs outline-none focus:border-[#2096BA]"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-9 rounded-xl bg-[#2096BA] hover:bg-[#187a99] text-white text-xs font-semibold"
              >
                {isPending ? "Vinculando..." : "Vincular Estudiante"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
