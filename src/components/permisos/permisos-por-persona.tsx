"use client";

import { useState, useTransition } from "react";
import { AlertCircle, RotateCcw, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { ListaPermisos } from "@/components/permisos/lista-permisos";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Input } from "@/components/ui/input";
import type { Permiso } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { guardarExcepcionPermiso } from "@/server/configuracion/acciones-permisos";
import type {
  PermisosDeRol,
  PersonaConPermisos,
} from "@/server/configuracion/consultas-permisos";

/**
 * Cambios personales sobre lo que trae el rol. Un solo interruptor por
 * permiso: si lo dejas distinto de lo que da el rol, se guarda como cambio
 * personal; si lo devuelves a lo del rol, el cambio se borra solo.
 */
export function PermisosPorPersona({
  personas: inicial,
  roles,
}: {
  personas: PersonaConPermisos[];
  roles: PermisosDeRol[];
}) {
  const t = useTranslations("permisosAdmin");
  const tRoles = useTranslations("roles");

  const [personas, setPersonas] = useState(inicial);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionadaId, setSeleccionadaId] = useState(inicial[0]?.id ?? "");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const persona = personas.find((p) => p.id === seleccionadaId);
  const delRol = new Set<Permiso>(
    roles.find((r) => r.rol === persona?.rol)?.permisos ?? [],
  );

  const filtro = busqueda.trim().toLowerCase();
  const visibles = personas.filter(
    (p) =>
      !filtro ||
      p.nombre.toLowerCase().includes(filtro) ||
      p.email.toLowerCase().includes(filtro) ||
      tRoles(p.rol).toLowerCase().includes(filtro),
  );

  const guardar = (permiso: Permiso, concedido: boolean | null) => {
    if (!persona) return;
    setError(false);
    const id = persona.id;

    iniciar(async () => {
      const res = await guardarExcepcionPermiso({
        usuarioId: id,
        permiso,
        concedido,
        motivo,
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      setPersonas((previo) =>
        previo.map((p) =>
          p.id !== id
            ? p
            : {
                ...p,
                excepciones: [
                  ...p.excepciones.filter((e) => e.permiso !== permiso),
                  ...(concedido === null
                    ? []
                    : [{ permiso, concedido, motivo: motivo || null }]),
                ],
              },
        ),
      );
    });
  };

  const cambiar = (permiso: Permiso, activo: boolean) =>
    // Igual a lo que da el rol = sin cambio personal.
    guardar(permiso, activo === delRol.has(permiso) ? null : activo);

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="relative">
          <Search className="text-tinta-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("searchPerson")}
            aria-label={t("searchPerson")}
            className="pl-9"
          />
        </div>

        {visibles.length === 0 ? (
          <EstadoVacio icono={Search} titulo={t("noResults")} />
        ) : (
          <ul className="sin-barra max-h-80 space-y-1 overflow-y-auto lg:max-h-[640px]">
            {visibles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSeleccionadaId(p.id)}
                  aria-current={p.id === seleccionadaId ? "true" : undefined}
                  className={cn(
                    "flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-left transition-colors duration-(--duracion-rapida)",
                    p.id === seleccionadaId
                      ? "bg-marca-50"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span className="bg-muted text-tinta-2 flex size-9 shrink-0 items-center justify-center rounded-full">
                    <UserRound className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-tinta">
                      {p.nombre}
                    </span>
                    <span className="texto-meta block truncate">
                      {tRoles(p.rol)}
                      {p.excepciones.length > 0 &&
                        ` · ${t("exceptionsCount", { count: p.excepciones.length })}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 space-y-5">
        {!persona ? (
          <EstadoVacio icono={UserRound} titulo={t("selectPerson")} />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="texto-titulo-seccion truncate">{persona.nombre}</h2>
                <p className="texto-meta">{tRoles(persona.rol)}</p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder={t("reasonPlaceholder")}
                  aria-label={t("reasonPlaceholder")}
                  className="sm:w-72"
                />
                {persona.excepciones.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendiente}
                    onClick={() =>
                      persona.excepciones.forEach((e) => guardar(e.permiso, null))
                    }
                  >
                    <RotateCcw className="size-4" />
                    {t("restore")}
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-3 rounded-card bg-tinta p-4 text-sm text-background"
              >
                <AlertCircle className="size-5 shrink-0" />
                {t("errorSaving")}
              </p>
            )}

            <ListaPermisos
              key={persona.id}
              deshabilitado={pendiente}
              estadoDe={(permiso) => {
                const excepcion = persona.excepciones.find(
                  (e) => e.permiso === permiso,
                );
                if (!excepcion)
                  return { activo: delRol.has(permiso), origen: "rol" };
                return {
                  activo: excepcion.concedido,
                  origen: excepcion.concedido ? "habilitado" : "retirado",
                };
              }}
              onCambio={cambiar}
            />
          </>
        )}
      </div>
    </div>
  );
}
