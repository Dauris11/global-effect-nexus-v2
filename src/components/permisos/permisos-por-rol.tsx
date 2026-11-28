"use client";

import { ROLE_DESCRIPTION } from "@/lib/roles";
import { esRolTotal } from "@/lib/rbac";
import { useState, useTransition } from "react";
import {
  AlertCircle,
  Bus,
  Calculator,
  GraduationCap,
  Shield,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { ListaPermisos } from "@/components/permisos/lista-permisos";
import { VistaModulos } from "@/components/permisos/vista-modulos";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { FilaChips } from "@/components/ui/fila-chips";
import { modulosQueHabilita } from "@/lib/nav";
import type { Permiso, Rol } from "@/lib/rbac";
import { guardarPermisoRol } from "@/server/configuracion/acciones-permisos";
import type { PermisosDeRol } from "@/server/configuracion/consultas-permisos";

const ICONO_ROL: Record<Rol, LucideIcon> = {
  owner: Shield,
  developer: Shield,
  admin: Shield,
  docente: GraduationCap,
  estudiante: UserRound,
  contabilidad: Calculator,
  habitudes: Users,
  dir_habitudes: UserCog,
  chofer: Bus,
};

/**
 * Lo que trae cada rol. El owner no aparece: su acceso es total y no se
 * edita, así que ofrecerlo solo invitaría a un error.
 */
export function PermisosPorRol({ roles }: { roles: PermisosDeRol[] }) {
  const t = useTranslations("permisosAdmin");
  const tRoles = useTranslations("roles");
  const tRaiz = useTranslations();
  const editables = roles.filter((r) => !esRolTotal(r.rol));

  const [seleccionado, setSeleccionado] = useState<Rol>(
    editables[0]?.rol ?? "admin",
  );
  const [porRol, setPorRol] = useState(
    () => new Map(editables.map((r) => [r.rol, new Set(r.permisos)])),
  );
  const [error, setError] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const actuales = porRol.get(seleccionado) ?? new Set<Permiso>();

  const cambiar = (permiso: Permiso, activo: boolean) => {
    setError(false);
    const rol = seleccionado;

    // Optimista: el interruptor responde al instante y se revierte si falla.
    const aplicar = (valor: boolean) =>
      setPorRol((previo) => {
        const siguiente = new Map(previo);
        const conjunto = new Set(siguiente.get(rol));
        if (valor) conjunto.add(permiso);
        else conjunto.delete(permiso);
        siguiente.set(rol, conjunto);
        return siguiente;
      });

    aplicar(activo);
    iniciar(async () => {
      const res = await guardarPermisoRol({ rol, permiso, concedido: activo });
      if (!res.ok) {
        aplicar(!activo);
        setError(true);
      }
    });
  };

  return (
    <div className="space-y-6">
      <FilaChips etiqueta={t("rolesLabel")}>
        {editables.map(({ rol }) => (
          <ChipFiltro
            key={rol}
            icono={ICONO_ROL[rol]}
            etiqueta={tRoles(rol)}
            activo={rol === seleccionado}
            onClick={() => setSeleccionado(rol)}
          />
        ))}
      </FilaChips>

      {/* Qué es el rol, con las mismas palabras de «Ver como» y Personal. */}
      <p className="texto-meta">{tRaiz(ROLE_DESCRIPTION[seleccionado])}</p>

      <VistaModulos rol={seleccionado} permisos={actuales} />

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
        key={seleccionado}
        deshabilitado={pendiente}
        habilitaDe={(permiso) =>
          modulosQueHabilita(seleccionado, permiso).map((item) => item.etiqueta)
        }
        estadoDe={(permiso) => ({ activo: actuales.has(permiso) })}
        onCambio={cambiar}
      />
    </div>
  );
}
