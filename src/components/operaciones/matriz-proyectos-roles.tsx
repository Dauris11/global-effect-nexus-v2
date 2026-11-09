"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FolderKanban,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ProyectoAsignadoRol,
  ROLES_ASIGNABLES_PROYECTO,
  type RolAsignableProyecto,
} from "@/lib/torre-control";
import { ALERTA_RIESGO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import { guardarAsignacionProyectosRolesAction } from "@/server/colaborador/acciones";

interface MatrizProyectosRolesProps {
  proyectosIniciales: ProyectoAsignadoRol[];
}

export function MatrizProyectosRoles({
  proyectosIniciales,
}: MatrizProyectosRolesProps) {
  const t = useTranslations("colaborador");
  const tRol = useTranslations("roles");

  const [proyectos, setProyectos] = useState(proyectosIniciales);
  const [proyectoGuardandoId, setProyectoGuardandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Sin esto un fallo solo deshacía la casilla y parecía que el clic no hacía nada.
  const [fallo, setFallo] = useState(false);

  const toggleRol = (proyectoId: string, rol: RolAsignableProyecto) => {
    const proyecto = proyectos.find((p) => p.proyecto_id === proyectoId);
    if (!proyecto) return;

    const tieneRol = proyecto.roles.includes(rol);
    const nuevosRoles = tieneRol
      ? proyecto.roles.filter((r) => r !== rol)
      : [...proyecto.roles, rol];

    // Optimista
    setProyectos((prev) =>
      prev.map((p) =>
        p.proyecto_id === proyectoId ? { ...p, roles: nuevosRoles } : p,
      ),
    );
    setProyectoGuardandoId(proyectoId);
    setFallo(false);

    startTransition(async () => {
      const res = await guardarAsignacionProyectosRolesAction(
        proyectoId,
        nuevosRoles,
      );
      if (!res.ok) {
        setFallo(true);
        // Revertir
        setProyectos((prev) =>
          prev.map((p) =>
            p.proyecto_id === proyectoId ? { ...p, roles: proyecto.roles } : p,
          ),
        );
      }
      setProyectoGuardandoId(null);
    });
  };

  return (
    <Card className="rounded-2xl border-linea-fuerte bg-card shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-marca-500" />
          <CardTitle className="text-lg font-bold text-tinta">
            {t("matrixTitle")}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {fallo && (
          <p role="alert" className={cn(ALERTA_RIESGO.contenedor, "mb-3")}>
            <AlertCircle className={ALERTA_RIESGO.icono} />
            <span className={ALERTA_RIESGO.texto}>{t("saveError")}</span>
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-linea-fuerte bg-muted/40">
                <th className="py-3 px-3 font-semibold text-tinta">
                  {t("projectColumn")}
                </th>
                {ROLES_ASIGNABLES_PROYECTO.map((rol) => (
                  <th
                    key={rol}
                    className="py-3 px-3 text-center font-semibold text-tinta"
                  >
                    {tRol(rol)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-linea-fuerte/40">
              {proyectos.map((proyecto) => {
                const guardando = proyectoGuardandoId === proyecto.proyecto_id;
                return (
                  <tr
                    key={proyecto.proyecto_id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="size-4 shrink-0 text-marca-500" />
                        <div>
                          <p className="font-semibold text-tinta">
                            {proyecto.proyecto_nombre}
                          </p>
                          {proyecto.proyecto_descripcion && (
                            <p className="text-[11px] text-tinta/60 line-clamp-1">
                              {proyecto.proyecto_descripcion}
                            </p>
                          )}
                        </div>
                        {guardando && (
                          <Loader2 className="ml-1 size-3.5 animate-spin text-marca-500" />
                        )}
                      </div>
                    </td>

                    {ROLES_ASIGNABLES_PROYECTO.map((rol) => {
                      const asignado = proyecto.roles.includes(rol);
                      return (
                        <td
                          key={rol}
                          className="py-3.5 px-3 text-center align-middle"
                        >
                          <button
                            type="button"
                            onClick={() => toggleRol(proyecto.proyecto_id, rol)}
                            disabled={guardando}
                            className={cn(
                              "inline-flex h-9 min-w-[70px] items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-all active:scale-95",
                              asignado
                                ? "bg-marca-500 text-white shadow-2xs hover:bg-marca-600"
                                : "border border-linea-fuerte/60 bg-muted/40 text-tinta/60 hover:bg-muted hover:text-tinta",
                            )}
                          >
                            {asignado ? (
                              <>
                                <Check className="size-3.5" />
                                <span>{t("assigned")}</span>
                              </>
                            ) : (
                              <span>{t("unassigned")}</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
