import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ModalReposicionCaja } from "@/components/contabilidad/cajas/modal-reposicion";
import { FormularioMovimientoCaja } from "@/components/contabilidad/cajas/formulario-movimiento";
import { TablaArqueos, TablaMovimientos } from "@/components/contabilidad/cajas/tablas-caja";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { esUuid, formatearMonto } from "@/lib/contabilidad/formato";
import { claveDia } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";
import {
  categoriasGastoCaja,
  listarArqueos,
  listarMovimientosCaja,
  obtenerCaja,
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

  const [t, caja, movimientos, arqueos, cuentas, personas, categorias] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cajas" }),
    obtenerCaja(id),
    listarMovimientosCaja(id),
    listarArqueos(id),
    cuentasConSaldo(),
    listarUsuariosSolicitantes(),
    categoriasGastoCaja(),
  ]);
  if (!caja) notFound();

  const hoy = claveDia();
  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const m = (valor: string) => formatearMonto(valor, caja.moneda);
  const cifras = [
    { etiqueta: t("efectivo"), valor: m(caja.saldoActual) },
    { etiqueta: t("valesPendientes"), valor: m(caja.valesPendientes) },
    { etiqueta: t("porReponer"), valor: m(caja.pendienteReposicion) },
    { etiqueta: t("fondoFijo"), valor: m(caja.fondoFijo) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-entrada">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href="/contabilidad/cajas">
            <ArrowLeft className="size-4" />
            {t("volverCajas")}
          </Link>
        </Button>
        <EncabezadoPagina
          antetitulo={`${t("antetitulo")} · ${caja.codigo}`}
          titulo={caja.nombre}
          subtitulo={t("responsableDe", { nombre: caja.responsableNombre, departamento: caja.departamento })}
          acciones={
            puedeRegistrar ? (
              <>
                <FormularioMovimientoCaja caja={caja} personas={personas} categorias={categorias} hoy={hoy} />
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
                <Button asChild size="sm" disabled={caja.estado !== "activa"}>
                  <Link href={`/contabilidad/cajas/${caja.id}/arqueo`}>
                    <Calculator className="size-4" />
                    {t("nuevoArqueo")}
                  </Link>
                </Button>
              </>
            ) : undefined
          }
        />
      </div>

      <section className="space-y-2">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cifras.map((cifra) => (
            <div key={cifra.etiqueta} className={`${TARJETA.contenido} p-4`}>
              <dt className="texto-meta">{cifra.etiqueta}</dt>
              <dd className="mt-1 truncate text-xl font-semibold text-tinta">{cifra.valor}</dd>
            </div>
          ))}
        </dl>
        <p className="texto-meta">
          {t("ecuacion")} · {t("reglaSoporte", { monto: m(caja.umbralAdjunto) })} · {t("ultimoArqueo")}:{" "}
          {caja.ultimoArqueo ?? t("nunca")}
          {caja.cuentaContableCodigo && ` · ${t("cuentaContable")}: ${caja.cuentaContableCodigo}`}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="texto-titulo-seccion">{t("arqueos")}</h2>
        <TablaArqueos
          arqueos={arqueos}
          moneda={caja.moneda}
          usuarioId={usuario.id}
          puedeAprobar={usuarioTienePermiso(usuario, "contabilidad.aprobar")}
        />
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <h2 className="texto-titulo-seccion">{t("movimientos")}</h2>
        <TablaMovimientos
          movimientos={movimientos}
          moneda={caja.moneda}
          categorias={categorias}
          hoy={hoy}
          puedeRegistrar={puedeRegistrar}
        />
      </section>
    </div>
  );
}
