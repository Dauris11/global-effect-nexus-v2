import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { TablaSolicitudesCxp } from "@/components/contabilidad/cxp/tabla-solicitudes-cxp";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirPermiso } from "@/lib/auth";
import { consultar } from "@/lib/db";
import { claveDia } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  facturasBorradorPorIds,
  solicitudesMaterialesParaCxp,
} from "@/server/contabilidad/cxp/solicitudes-consultas";
import { tiposGastoFactura } from "@/server/contabilidad/proveedores/consultas";
import { opcionesRecibo } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.solicitudesCxp" });
  return { title: t("titulo") };
}

/**
 * Pestaña «Solicitudes» dentro de Cuentas por Pagar (antes «Rendiciones», Etapa 2).
 *
 * Muestra las solicitudes de tipo «Materiales» para atenderlas mediante el modal
 * «Agregar Factura» (NCF/e-CF opcional en el primer guardado → «Pendiente de llenado»
 * y «Aceptada» en Mis Solicitudes; luego completar NCF/e-CF y aprobar → «Pendiente»;
 * al registrarse el pago → «Pagada» en ambas vistas).
 */
export default async function PaginaSolicitudesCxp({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [
    t,
    filas,
    opciones,
    tiposGasto,
    listaProveedores,
    solicitantes,
    estudiantes,
    mensajes,
  ] = await Promise.all([
    getTranslations({ locale, namespace: "contab.solicitudesCxp" }),
    solicitudesMaterialesParaCxp(),
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
    consultar<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM public.estudiante
        WHERE estado::text IN ('activo', 'standby_tecnico', 'academia_liderazgo', 'suspendido')
        ORDER BY nombre`,
    ),
    mensajesCliente(["contab", "requests", "estados"]),
  ]);

  const idsBorrador = filas
    .filter((f) => f.factura_id && f.factura_estado === "borrador")
    .map((f) => f.factura_id as string);
  const facturasBorrador = await facturasBorradorPorIds(idsBorrador);

  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const puedeAprobar = usuarioTienePermiso(usuario, "contabilidad.aprobar");

  return (
    <PageContainer className="animate-entrada space-y-6">
      <PageHeader title={t("titulo")} />

      <NextIntlClientProvider messages={mensajes}>
        {filas.length === 0 ? (
          <EmptyState readOnly icon={ClipboardList} title={t("vacio")} />
        ) : (
          <TablaSolicitudesCxp
            filas={filas}
            facturasBorrador={facturasBorrador}
            proveedores={listaProveedores}
            tiposGasto={tiposGasto}
            fondos={opciones.fondos}
            proyectos={opciones.proyectos}
            solicitantes={solicitantes}
            estudiantes={estudiantes}
            hoy={claveDia()}
            puedeRegistrar={puedeRegistrar}
            puedeAprobar={puedeAprobar}
          />
        )}
      </NextIntlClientProvider>
    </PageContainer>
  );
}
