import { Bot, CalendarDays, DollarSign, HandCoins, ListTodo, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/**
 * Accesos rápidos del panel: los seis módulos a los que se salta desde aquí.
 *
 * Todos con el mismo círculo gris: el módulo no tiene color propio, y seis
 * pastillas de seis colores era exactamente lo que hacía que el panel no
 * pareciera de la Fundación. El turquesa aparece solo en el icono al pasar,
 * que es lo que la norma reserva para lo activo.
 *
 * Contabilidad solo se ofrece a quien tiene `finanzas.leer`; esconder el enlace
 * no protege nada (lo protege la propia página), pero no se invita a una
 * puerta que va a estar cerrada.
 */
export function AccesosPanel({ verFinanzas }: { verFinanzas: boolean }) {
  const t = useTranslations("dashboard");

  const accesos = [
    { etiqueta: t("qaChat"), href: "/chat-ia", icono: Bot },
    { etiqueta: t("qaRecords"), href: "/expedientes", icono: Users },
    ...(verFinanzas
      ? [{ etiqueta: t("qaFinance"), href: "/contabilidad", icono: DollarSign }]
      : []),
    { etiqueta: t("qaSponsors"), href: "/patrocinadores", icono: HandCoins },
    { etiqueta: t("qaTasks"), href: "/administrativo/tareas", icono: ListTodo },
    { etiqueta: t("qaCalendar"), href: "/calendario", icono: CalendarDays },
  ];

  return (
    <section className="space-y-4">
      <h2 className="texto-titulo-seccion">{t("quickAccess")}</h2>

      <div className="grid grid-cols-3 gap-3 md:gap-4 lg:grid-cols-6">
        {accesos.map((acceso) => (
          <Link
            key={acceso.href}
            href={acceso.href}
            className="group rounded-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Card interactiva className="h-full items-center gap-2.5 px-2 py-4 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-muted text-tinta transition-colors group-hover:text-marca-500">
                <acceso.icono className="size-5" />
              </span>
              <span className="text-sm leading-tight font-medium text-tinta">
                {acceso.etiqueta}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
