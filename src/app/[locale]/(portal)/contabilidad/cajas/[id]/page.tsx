import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft, Calculator } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { DialogoConfigurarCaja } from "@/components/contabilidad/cajas/dialogo-configurar-caja";
import { ModalHistoricoCaja } from "@/components/contabilidad/cajas/modal-historico";
import { ModalReposicionCaja } from "@/components/contabilidad/cajas/modal-reposicion";
import { FormularioMovimientoCaja } from "@/components/contabilidad/cajas/formulario-movimiento";
import { TablaArqueos, TablaMovimientos } from "@/components/contabilidad/cajas/tablas-caja";
import { VistaCajaGeneral } from "@/components/contabilidad/cajas/vista-caja-general";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link, redirigir } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { esUuid } from "@/lib/contabilidad/formato";
import { claveDia } from "@/lib/fechas";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";
import {
  categoriasGastoCaja,
  cuentasTipoEgresoCaja,
  cuentasTipoIngresoCaja,
  listarArqueos,
  listarHistorialCajaGeneral,
  listarHistoricoCaja,
  listarMovimientosCaja,
  listarMovimientosCajaGeneral,
  obtenerCaja,
  proximoComprobanteCaja,
} from "@/server/contabilidad/cajas/consultas";
import { listarUsuariosSolicitantes } from "@/server/contabilidad/proveedores/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.cajas" });
  const caja = esUuid(id) ? await obtenerCaja(id) : null;
  return { title: caja ? caja.nombre : t("titulo") };
}

/**
 * Una caja chica: la ecuación del fondo fijo arriba (efectivo + vales +
 * gastos por reponer = fondo), las acciones de su ciclo y sus registros.
 */
export default async function PaginaDetalleCaja({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");
  if (!esUuid(id)) notFound();

  const caja = await obtenerCaja(id);
  if (!caja) notFound();

  const hoy = claveDia();
  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const esSupervisor = caja.supervisorId === usuario.id;

  // Vista dedicada de Caja General (independiente de Caja Chica)
  if (caja.tipo === "caja") {
    if (!caja.abierta) {
      redirigir("/contabilidad/cajas", locale);
    }

    const [movsGeneral, histGeneral, cuentasIngreso, cuentasEgreso, personas, mensajes] =
      await Promise.all([
        listarMovimientosCajaGeneral(id),
        listarHistorialCajaGeneral(id),
        cuentasTipoIngresoCaja(),
        cuentasTipoEgresoCaja(),
        listarUsuariosSolicitantes(),
        mensajesCliente(["contab", "common"]),
      ]);

    return (
      <NextIntlClientProvider messages={mensajes}>
        <VistaCajaGeneral
          caja={caja}
          ingresos={movsGeneral.ingresos}
          egresos={movsGeneral.egresos}
          historialIngresos={histGeneral.ingresos}
          historialEgresos={histGeneral.egresos}
          cierres={histGeneral.cierres}
          cuentasIngreso={cuentasIngreso}
          cuentasEgreso={cuentasEgreso}
          personas={personas}
          hoy={hoy}
          puedeRegistrar={puedeRegistrar}
          esSupervisor={esSupervisor}
          usuarioActualNombre={usuario.nombre}
        />
      </NextIntlClientProvider>
    );
  }

  const [t, movimientos, historico, arqueos, cuentas, personas, categorias, proximoComprobanteB11] =
    await Promise.all([
      getTranslations({ locale, namespace: "contab.cajas" }),
      listarMovimientosCaja(id),
      listarHistoricoCaja(id),
      listarArqueos(id),
      cuentasConSaldo(),
      listarUsuariosSolicitantes(),
      categoriasGastoCaja(),
      proximoComprobanteCaja("B11"),
    ]);

  return (
    <div className="space-y-6 animate-entrada">
      <div className="space-y-2.5">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-tinta-2">
          <Link href="/contabilidad/cajas">
            <ChevronLeft className="size-4" />
            {t("volverCajas")}
          </Link>
        </Button>
        <EncabezadoPagina
          className="md:items-center"
          antetitulo={`${t(`tiposCaja.${caja.tipo}`)} · ${caja.codigo}`}
          titulo={
            <span className="inline-flex items-center gap-2">
              <span>{caja.nombre}</span>
              <DialogoConfigurarCaja
                caja={caja}
                usuarios={personas}
                cuentasBancarias={cuentas
                  .filter((c) => c.estado === "activa")
                  .map((c) => ({
                    id: c.id,
                    nombre: c.nombre,
                    banco: c.banco,
                    numero: c.numero,
                    moneda: c.moneda,
                  }))}
                esSupervisor={esSupervisor}
              />
            </span>
          }
          acciones={
            <div className="flex flex-wrap items-center gap-2.5">
              {puedeRegistrar && (
                <>
                  <FormularioMovimientoCaja
                    caja={caja}
                    categorias={categorias}
                    hoy={hoy}
                    proximoComprobanteB11={proximoComprobanteB11}
                  />
                  <ModalReposicionCaja
                    caja={caja}
                    hoy={hoy}
                    cuentasBanco={cuentas
                      .filter((c) => c.estado === "activa")
                      .map((c) => ({
                        id: c.id,
                        bancoNombre: c.banco,
                        numeroCuenta: c.numero,
                        moneda: c.moneda,
                        saldoActual: c.saldo,
                      }))}
                  />
                  <Button size="md"
                    asChild
                    className="whitespace-nowrap px-3.5"
                    disabled={caja.estado !== "activa"}
                  >
                    <Link href={`/contabilidad/cajas/${caja.id}/arqueo`}>
                      <Calculator className="size-4" />
                      {t("nuevoArqueo")}
                    </Link>
                  </Button>
                </>
              )}
              <ModalHistoricoCaja
                movimientos={historico}
                moneda={caja.moneda}
                categorias={categorias}
              />
            </div>
          }
        />
        <p className="texto-meta pt-0.5">
          {t("responsableDe", { nombre: caja.responsableNombre, departamento: caja.departamento })} · {t("ultimoArqueo")}:{" "}
          {caja.ultimoArqueo ?? t("nunca")}
          {caja.cuentaContableCodigo && ` · ${t("cuentaContable")}: ${caja.cuentaContableCodigo}`}
        </p>
      </div>

      <section className="space-y-4 border-t border-linea pt-6">
        <h2 className="texto-titulo-seccion">{t("movimientos")}</h2>
        <TablaMovimientos movimientos={movimientos} moneda={caja.moneda} />
      </section>

      <section className="space-y-4 border-t border-linea pt-6">
        <h2 className="texto-titulo-seccion">{t("arqueos")}</h2>
        <TablaArqueos
          arqueos={arqueos}
          moneda={caja.moneda}
          usuarioId={usuario.id}
          puedeAprobar={usuarioTienePermiso(usuario, "contabilidad.aprobar")}
        />
      </section>
    </div>
  );
}
