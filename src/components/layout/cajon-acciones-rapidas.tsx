"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  Bot,
  Bus,
  CalendarDays,
  Camera,
  CheckSquare,
  FileText,
  Package,
  Receipt,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { usePermisos } from "@/components/layout/visibilidad";
import { tienePermiso, type Permiso, type Rol } from "@/lib/rbac";
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
  const t = useTranslations("accesoRapido");
  const permisos = usePermisos();

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

  const ACCIONES: {
    clave: string;
    href?: string;
    onClick?: () => void;
    icono: typeof Bot;
    /**
     * Lo que exige la pantalla o la acción de destino. Se decide por permiso
     * efectivo (rol + excepciones), no por rol: con la lista de roles el
     * cajón ofrecía atajos que rebotaban y escondía los habilitados a título
     * personal.
     */
    permiso?: Permiso;
    /** Solo para destinos sin permiso propio, que se abren por rol. */
    roles?: Rol[];
  }[] = [
    {
      clave: "scan",
      href: "/administrativo/inventario/escanear",
      icono: Camera,
      permiso: "inventario.auditar",
    },
    {
      clave: "expense",
      href: "/administrativo/rendiciones",
      icono: Receipt,
      permiso: "rendicion.enviar",
    },
    {
      clave: "today",
      href: "/administrativo/torre-control",
      icono: CheckSquare,
      roles: ["super_admin", "admin", "contabilidad", "docente", "habitudes", "dir_habitudes", "chofer"],
    },
    {
      clave: "meeting",
      href: "/reuniones?agendar=true",
      icono: Users,
      permiso: "reuniones.agendar",
    },
    {
      clave: "inventory",
      href: "/administrativo/inventario",
      icono: Package,
      permiso: "inventario.leer",
    },
    {
      clave: "habitudes",
      href: "/habitudes",
      icono: Sparkles,
      roles: ["super_admin", "admin", "docente", "habitudes", "dir_habitudes"],
    },
    {
      clave: "ia",
      onClick: abrirIA,
      icono: Bot,
      permiso: "ia.usar",
    },
    {
      clave: "transport",
      href: "/portal/chofer",
      icono: Bus,
      permiso: "transporte.operar",
    },
  ];

  const puede = (permiso: Permiso) =>
    permisos ? permisos.has(permiso) : tienePermiso(rol, permiso);
  const accionesPermitidas = ACCIONES.filter((a) =>
    a.permiso ? puede(a.permiso) : (a.roles?.includes(rol) ?? false),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
      {/* Telón traslúcido */}
      <div
        className="animate-velo fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onCerrar}
      />

      {/* Hoja inferior táctil estilo nativo */}
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border-t border-linea bg-background p-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-elevada animate-hoja">
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
            <h2 className="text-sm font-bold text-tinta">{t("title")}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="flex size-8 items-center justify-center rounded-full bg-muted text-tinta-2 transicion-control hover:text-tinta active:scale-90"
            aria-label={t("close")}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Rejilla de tarjetas de acceso rápido táctiles */}
        {/* Las tarjetas llegan en cascada justo detrás de la hoja. */}
        <div className="escalonado mt-4 grid grid-cols-2 gap-2.5">
          {accionesPermitidas.map((item) => {
            const Icono = item.icono;
            const tarjetaClases = cn(
              "flex flex-col justify-between rounded-2xl border border-linea bg-card p-3.5 text-left transicion-control",
              "active:scale-95 active:bg-muted/80 focus-visible:ring-2 focus-visible:ring-marca-500"
            );

            const contenido = (
              <>
                <div className="flex size-9 items-center justify-center rounded-xl bg-marca-50 text-marca-600">
                  <Icono className="size-5" />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-bold text-tinta">{t(`${item.clave}.title`)}</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-tinta-2">
                    {t(`${item.clave}.desc`)}
                  </p>
                </div>
              </>
            );

            if (item.href) {
              return (
                <Link
                  key={item.clave}
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
                key={item.clave}
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
