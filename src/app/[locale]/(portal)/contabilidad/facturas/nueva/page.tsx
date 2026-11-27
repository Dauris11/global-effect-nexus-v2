import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FormularioFactura } from "@/components/contabilidad/proveedores/formularios";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { claveDia } from "@/lib/fechas";
import { tiposGastoFactura } from "@/server/contabilidad/proveedores/consultas";
import { opcionesRecibo } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.facturaForm" });
  return { title: t("tituloNueva") };
}

export default async function PaginaNuevaFactura({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ proveedor?: string }>;
}) {
  const { locale } = await params;
  const { proveedor } = await searchParams;
  await requerirPermiso("contabilidad.registrar");

  const [t, opciones, tiposGasto, listaProveedores, solicitantes, estudiantes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.facturaForm" }),
    opcionesRecibo(),
    tiposGastoFactura(),
    consultar<{
      id: string;
      nombre: string;
      tipo: "fisica" | "juridica";
      identificacion: string;
      dias: number;
    }>(
      `SELECT id, nombre, tipo, identificacion, condiciones_pago_dias AS dias
         FROM contabilidad.proveedor
        WHERE estado = 'activo'
        ORDER BY nombre`,
    ),
    consultar<{ id: string; nombre: string; email: string; rol: string }>(
      `SELECT u.id, u.nombre, u.email, r.nombre AS rol
         FROM public.usuario u
         JOIN public.rol r ON u.rol_id = r.id
        WHERE u.activo = TRUE
        ORDER BY u.nombre ASC`,
    ),
    // Quien sigue en el programa: imputar un gasto a un egresado o retirado es raro y se hace desde el expediente.
    consultar<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM public.estudiante
        WHERE estado::text IN ('activo', 'standby_tecnico', 'academia_liderazgo', 'suspendido')
        ORDER BY nombre`,
    ),
  ]);

  return (
    <div className="space-y-6 animate-entrada">
      <EncabezadoPagina
        titulo={t("tituloNueva")}
      />

      <div className="rounded-tarjeta border border-linea bg-background p-6">
        <FormularioFactura
          proveedores={listaProveedores}
          proveedorId={proveedor}
          tiposGasto={tiposGasto}
          fondos={opciones.fondos}
          proyectos={opciones.proyectos}
          solicitantes={solicitantes}
          estudiantes={estudiantes}
          hoy={claveDia()}
        />
      </div>
    </div>
  );
}
