"use client";

import { useState, useTransition } from "react";
import {
  Check,
  CheckCircle2,
  FolderLock,
  Info,
  MinusCircle,
  PlusCircle,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISOS_POR_ROL, type Permiso, type Rol } from "@/lib/rbac";
import {
  guardarExcepcionPermiso,
  type PermisoCatalogoItem,
  type UsuarioPermisoItem,
} from "@/server/configuracion/acciones-permisos";

interface PropsGestorPermisos {
  usuariosIniciales: UsuarioPermisoItem[];
  catalogoPermisos: PermisoCatalogoItem[];
}

export function GestorPermisosUsuario({
  usuariosIniciales,
  catalogoPermisos,
}: PropsGestorPermisos) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = useState<string>(
    usuariosIniciales[0]?.id ?? "",
  );
  const [filtroModulo, setFiltroModulo] = useState<string>("todos");
  const [motivoInput, setMotivoInput] = useState<string>("");
  const [mensajeEstado, setMensajeEstado] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const usuarioActual = usuarios.find((u) => u.id === usuarioSeleccionadoId) ?? usuarios[0];

  const usuariosFiltrados = usuarios.filter(
    (u) =>
      u.nombre.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
      u.email.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
      u.rol.toLowerCase().includes(busquedaUsuario.toLowerCase()),
  );

  const modulosDisponibles = ["todos", ...Array.from(new Set(catalogoPermisos.map((p) => p.modulo)))];

  const permisosFiltrados = catalogoPermisos.filter((p) => {
    if (filtroModulo !== "todos" && p.modulo !== filtroModulo) return false;
    return true;
  });

  const cambiarPermiso = (permisoCodigo: Permiso, concedido: boolean | null) => {
    if (!usuarioActual) return;
    setMensajeEstado(null);

    startTransition(async () => {
      const res = await guardarExcepcionPermiso({
        usuarioId: usuarioActual.id,
        permisoCodigo,
        concedido,
        motivo: motivoInput || undefined,
      });

      if (res.ok) {
        setMensajeEstado({ tipo: "exito", texto: res.mensaje });
        // Actualizar estado local
        setUsuarios((prev) =>
          prev.map((u) => {
            if (u.id !== usuarioActual.id) return u;
            const nuevasExcepciones = u.excepciones.filter((e) => e.permisoCodigo !== permisoCodigo);
            if (concedido !== null) {
              nuevasExcepciones.push({
                permisoCodigo,
                concedido,
                motivo: motivoInput || null,
              });
            }
            return { ...u, excepciones: nuevasExcepciones };
          }),
        );
      } else {
        setMensajeEstado({ tipo: "error", texto: res.mensaje });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Columna Izquierda: Directorio de Usuarios */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Users className="size-4 text-[#2096BA]" />
              Usuarios del Sistema ({usuariosFiltrados.length})
            </h3>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <Input
              value={busquedaUsuario}
              onChange={(e) => setBusquedaUsuario(e.target.value)}
              placeholder="Buscar por nombre, email o rol..."
              className="pl-8 text-xs h-9 rounded-xl border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            {usuariosFiltrados.map((u) => {
              const esSeleccionado = u.id === usuarioActual?.id;
              const tieneExcepciones = u.excepciones.length > 0;

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUsuarioSeleccionadoId(u.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between border cursor-pointer ${
                    esSeleccionado
                      ? "bg-[#2096BA]/10 border-[#2096BA]/40 shadow-xs"
                      : "bg-slate-50/60 dark:bg-slate-800/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">
                      {u.nombre}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-mono bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                        {u.rol}
                      </span>
                      {tieneExcepciones && (
                        <span className="text-[10px] font-semibold text-[#187a99] dark:text-[#5FB8D4] bg-[#2096BA]/15 px-1.5 py-0.5 rounded">
                          {u.excepciones.length} excepción(es)
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Columna Derecha: Matriz de Permisos del Usuario Seleccionado */}
      <div className="lg:col-span-8 space-y-4">
        {usuarioActual ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
            {/* Cabecera del Usuario */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {usuarioActual.nombre}
                  </h2>
                  <Badge variant="outline" className="text-xs">
                    Rol base: {usuarioActual.rol}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{usuarioActual.email}</p>
              </div>

              {/* Input de Motivo para Auditoría */}
              <div className="w-full sm:w-auto">
                <input
                  type="text"
                  value={motivoInput}
                  onChange={(e) => setMotivoInput(e.target.value)}
                  placeholder="Motivo de la excepción (auditoría)..."
                  className="h-8 w-full sm:w-64 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs outline-none focus:border-[#2096BA]"
                />
              </div>
            </div>

            {/* Mensajes de Feedback */}
            {mensajeEstado && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  mensajeEstado.tipo === "exito"
                    ? "bg-[#1E9E6A]/10 text-[#1E9E6A] border-[#1E9E6A]/30"
                    : "bg-[#B4342B]/10 text-[#B4342B] border-[#B4342B]/30"
                }`}
              >
                {mensajeEstado.tipo === "exito" ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <ShieldAlert className="size-4 shrink-0" />
                )}
                <span>{mensajeEstado.texto}</span>
              </div>
            )}

            {/* Filtros por Módulo */}
            <div className="flex flex-wrap gap-1.5 pb-2">
              {modulosDisponibles.map((mod) => (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setFiltroModulo(mod)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    filtroModulo === mod
                      ? "bg-[#2096BA] text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {mod === "todos" ? "Todos los Módulos" : mod}
                </button>
              ))}
            </div>

            {/* Lista de Permisos con Controles de Excepción */}
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {permisosFiltrados.map((perm) => {
                const tienePorRol = PERMISOS_POR_ROL[usuarioActual.rol]?.includes(perm.codigo) ?? false;
                const excepcion = usuarioActual.excepciones.find((e) => e.permisoCodigo === perm.codigo);
                const tieneEfectivo = excepcion !== undefined ? excepcion.concedido : tienePorRol;

                return (
                  <div
                    key={perm.codigo}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors ${
                      excepcion !== undefined
                        ? excepcion.concedido
                          ? "bg-[#1E9E6A]/5 border-[#1E9E6A]/30"
                          : "bg-[#B4342B]/5 border-[#B4342B]/30"
                        : "bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {perm.codigo}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                          {perm.modulo}
                        </span>

                        {excepcion !== undefined ? (
                          excepcion.concedido ? (
                            <span className="text-[10px] font-semibold text-[#1E9E6A] bg-[#1E9E6A]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <PlusCircle className="size-3" /> Concedido (+ Excepción)
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-[#B4342B] bg-[#B4342B]/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <MinusCircle className="size-3" /> Revocado (- Excepción)
                            </span>
                          )
                        ) : tienePorRol ? (
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="size-3 text-slate-500" /> Heredado del Rol
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/40 px-2 py-0.5 rounded-full">
                            No concedido
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {perm.descripcion}
                      </p>
                      {excepcion?.motivo && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">
                          Motivo: {excepcion.motivo}
                        </p>
                      )}
                    </div>

                    {/* Acciones de Superadmin */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Forzar Conceder */}
                      <button
                        type="button"
                        disabled={isPending || (excepcion !== undefined && excepcion.concedido)}
                        onClick={() => cambiarPermiso(perm.codigo, true)}
                        title="Forzar concesión para este usuario"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#1E9E6A]/30 text-[#1E9E6A] hover:bg-[#1E9E6A]/10 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <PlusCircle className="size-3.5" />
                        Conceder
                      </button>

                      {/* Forzar Revocar */}
                      <button
                        type="button"
                        disabled={isPending || (excepcion !== undefined && !excepcion.concedido)}
                        onClick={() => cambiarPermiso(perm.codigo, false)}
                        title="Forzar revocación para este usuario"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#B4342B]/30 text-[#B4342B] hover:bg-[#B4342B]/10 transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <MinusCircle className="size-3.5" />
                        Revocar
                      </button>

                      {/* Revertir al Rol */}
                      {excepcion !== undefined && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => cambiarPermiso(perm.codigo, null)}
                          title="Eliminar excepción y volver a lo que determine su rol"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="size-3.5" />
                          Restablecer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500">
            Selecciona un usuario a la izquierda para gestionar sus excepciones de permisos.
          </div>
        )}
      </div>
    </div>
  );
}
