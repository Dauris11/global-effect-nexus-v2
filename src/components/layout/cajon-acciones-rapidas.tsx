"use client";

import { useEffect } from "react";
import {
  Bot,
  CalendarDays,
  Camera,
  CheckSquare,
  FileText,
  Package,
  Receipt,
  X,
  Zap,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";

interface CajonAccionesRapidasProps {
  abierto: boolean;
  onCerrar: () => void;
  rol: Rol;
}

/**
 * Cajón táctil de acciones rápidas nativas para móviles (Quick Action Sheet).
 *
 * Proporciona acceso a las operaciones operativas y de campo más frecuentes
 * en menos de dos toques: escáner de cámara QR, rendición de gastos con foto,
 * tareas de hoy y asistente de IA por voz.
 */
export function CajonAccionesRapidas({
  abierto,
  onCerrar,
  rol,
}: CajonAccionesRapidasProps) {
  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    if (abierto) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const abrirIA = () => {
    onCerrar();
    window.dispatchEvent(new CustomEvent("abrir-widget-ia"));
  };

  const ACCIONES = [
    {
      titulo: "Escanear QR Activo",
      descripcion: "Auditoría física con cámara",
      href: "/administrativo/inventario/escanear",
      icono: Camera,
      badge: "Cámara",
      roles: ["super_admin", "admin", "contabilidad"],
    },
    {
      titulo: "Rendir Gasto / Factura",
      descripcion: "Carga de comprobante fiscal",
      href: "/administrativo/rendiciones",
      icono: Receipt,
      badge: "Comprobante",
      roles: ["super_admin", "admin", "contabilidad", "docente", "habitudes"],
    },
    {
      titulo: "Lo que me toca hoy",
      descripcion: "Torre de control y mis tareas",
      href: "/administrativo/tareas/hoy",
      icono: CheckSquare,
      badge: "Mi Día",
      roles: ["super_admin", "admin", "contabilidad", "docente", "habitudes"],
    },
    {
      titulo: "Agendar Reunión",
      descripcion: "Reuniones institucionales y asesorías",
      href: "/calendario",
      icono: CalendarDays,
      badge: "Agenda",
      roles: ["super_admin", "admin", "contabilidad", "docente", "estudiante", "habitudes"],
    },
    {
      titulo: "Inventario de Activos",
      descripcion: "Catálogo de herramientas y equipos",
      href: "/administrativo/inventario",
      icono: Package,
      badge: "Patrimonio",
      roles: ["super_admin", "admin", "contabilidad"],
    },
    {
      titulo: "Nexus Asistente IA",
      descripcion: "Consultas por voz y acciones rápidas",
      onClick: abrirIA,
      icono: Bot,
      badge: "IA & Voz",
      roles: ["super_admin", "admin", "contabilidad", "docente", "estudiante", "habitudes"],
    },
  ];

  const accionesPermitidas = ACCIONES.filter((a) => a.roles.includes(rol));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
      {/* Telón traslúcido */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onCerrar}
      />

      {/* Hoja inferior táctil estilo nativo */}
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border-t border-linea bg-background p-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Barra superior de arrastre */}
        <div className="flex justify-center pb-2">
          <div className="h-1.5 w-12 rounded-full bg-linea" />
        </div>

        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-linea pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-marca-50 text-marca-600">
              <Zap className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-tinta">Centro de Acceso Rápido</h2>
              <p className="text-[11px] text-tinta-2">Acciones operativas a un toque</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="flex size-8 items-center justify-center rounded-full bg-muted text-tinta-2 transition-colors hover:text-tinta"
            aria-label="Cerrar menú de accesos rápidos"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Rejilla de tarjetas de acceso rápido táctiles */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {accionesPermitidas.map((item) => {
            const Icono = item.icono;
            const tarjetaClases = cn(
              "flex flex-col justify-between rounded-2xl border border-linea bg-card p-3.5 text-left transition-all",
              "active:scale-95 active:bg-muted/80 focus-visible:ring-2 focus-visible:ring-marca-500"
            );

            const contenido = (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-marca-50 text-marca-600">
                    <Icono className="size-5" />
                  </div>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-tinta-2">
                    {item.badge}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-tinta">{item.titulo}</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-tinta-2">
                    {item.descripcion}
                  </p>
                </div>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={item.titulo}
                  href={item.href}
                  onClick={onCerrar}
                  className={tarjetaClases}
                >
                  {contenido}
                </Link>
              );
            }

            return (
              <button
                key={item.titulo}
                type="button"
                onClick={item.onClick}
                className={tarjetaClases}
              >
                {contenido}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
