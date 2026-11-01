import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PanelChofer } from "@/components/transporte/panel-chofer";
import { requerirPermiso } from "@/lib/auth";
import { obtenerEstadoChofer } from "@/server/transporte/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "transport" });

  return { title: t("driverPortalTitle") };
}

export default async function PaginaPortalChofer() {
  const usuario = await requerirPermiso("transporte.operar");
  const estado = await obtenerEstadoChofer(usuario.id);

  return (
    <div className="animate-entrada py-4">
      <PanelChofer
        viajeActivoInicial={estado.viajeActivo}
        horarioSugerido={estado.horarioSugerido}
        horariosDisponibles={estado.horariosDisponibles}
        pasajerosIniciales={estado.pasajerosHoy}
        paradasIniciales={estado.paradasDisponibles}
      />
    </div>
  );
}

