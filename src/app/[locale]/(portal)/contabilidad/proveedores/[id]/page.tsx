import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  FilePlus,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Dato, Monto } from "@/components/contabilidad/comun";
import { FormularioCuentaProveedor } from "@/components/contabilidad/proveedores/formularios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { formatearIdentificacion } from "@/lib/contabilidad/identificacion";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  cuentasDeProveedor,
  estadoDeCuenta,
  facturasDeProveedor,
  proveedorPorId,
} from "@/server/contabilidad/proveedores/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await proveedorPorId(id);
  return { title: p ? p.nombre : "Proveedor" };
}

export default async function PaginaDetalleProveedor({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tc, proveedor, cuentas, facturas, estado] = await Promise.all([
    getTranslations({ locale, namespace: "contab.proveedor" }),
    getTranslations({ locale, namespace: "contab" }),
    proveedorPorId(id),
    cuentasDeProveedor(id),
    facturasDeProveedor(id),
    estadoDeCuenta(id),
  ]);

  if (!proveedor) notFound();

  const puedeRegistrar = usuarioTienePermiso(usuario, "contabilidad.registrar");
  const puedeConfigurar = usuarioTienePermiso(usuario, "contabilidad.configurar");

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-entrada">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href="/contabilidad/proveedores">
            <ArrowLeft className="size-4" />
            {t("volver")}
          </Link>
        </Button>
        <EncabezadoPagina
          antetitulo={tc(`tipoProveedor.${proveedor.tipo}` as never)}
          titulo={proveedor.nombre}
          subtitulo={
            proveedor.nombre_comercial
              ? `${proveedor.nombre_comercial} · ${formatearIdentificacion(proveedor.identificacion)}`
              : formatearIdentificacion(proveedor.identificacion)
          }
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              {puedeRegistrar && (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/contabilidad/proveedores/${id}/editar`}>
                      <Pencil className="size-4" />
                      {t("editar")}
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/contabilidad/facturas/nueva?proveedor=${id}`}>
                      <FilePlus className="size-4" />
                      {t("nuevaFactura")}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      {proveedor.tipo === "fisica" && (
        <div className="rounded-control bg-marca-50 border border-marca-200 p-4 text-sm text-marca-800">
          {t("sinComprobante")}
        </div>
      )}

      {/* Datos generales */}
      <section className="rounded-tarjeta border border-linea bg-background p-6">
        <h2 className="texto-titulo-seccion mb-4">{t("datos")}</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="RNC / Cédula">
            <span className="font-mono">{formatearIdentificacion(proveedor.identificacion)}</span>
          </Dato>
          <Dato etiqueta="Estado">
            <Badge
              className={proveedor.estado === "activo" ? undefined : INSIGNIA_SEMAFORO.alerta}
              variant={proveedor.estado === "activo" ? "neutra" : undefined}
            >
              {tc(`estadoProveedor.${proveedor.estado}` as never)}
            </Badge>
          </Dato>
          <Dato etiqueta="Condiciones de pago">
            {proveedor.condiciones_pago_dias} días
          </Dato>
          {proveedor.contacto && (
            <Dato etiqueta="Persona de contacto">
              <span className="flex items-center gap-1.5">
                <User className="size-4 text-tinta-2 shrink-0" />
                {proveedor.contacto}
              </span>
            </Dato>
          )}
          {proveedor.telefono && (
            <Dato etiqueta="Teléfono">
              <span className="flex items-center gap-1.5">
                <Phone className="size-4 text-tinta-2 shrink-0" />
                <a href={`tel:${proveedor.telefono}`} className="hover:underline">{proveedor.telefono}</a>
              </span>
            </Dato>
          )}
          {proveedor.email && (
            <Dato etiqueta="Correo electrónico">
              <span className="flex items-center gap-1.5">
                <Mail className="size-4 text-tinta-2 shrink-0" />
                <a href={`mailto:${proveedor.email}`} className="hover:underline">{proveedor.email}</a>
              </span>
            </Dato>
          )}
          {proveedor.direccion && (
            <Dato etiqueta="Dirección">
              <span className="flex items-start gap-1.5">
                <MapPin className="size-4 text-tinta-2 shrink-0 mt-0.5" />
                {proveedor.direccion}
              </span>
            </Dato>
          )}
          {proveedor.categoria && (
            <Dato etiqueta="Categoría contable">
              {proveedor.categoria}
            </Dato>
          )}
        </dl>
      </section>

      {/* Cuentas bancarias */}
      <section className="rounded-tarjeta border border-linea bg-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="texto-titulo-seccion flex items-center gap-2">
            <CreditCard className="size-5 text-tinta-2" />
            {t("cuentas")}
          </h2>
        </div>

        {cuentas.length === 0 ? (
          <p className="text-sm text-tinta-2">{t("cuentasVacio")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cuentas.map((c) => (
              <div
                key={c.id}
                className={`rounded-control border p-4 text-sm ${
                  c.activa ? "border-marca-300 bg-marca-50/40" : "border-linea bg-superficie opacity-75"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-tinta">{c.banco}</p>
                    <p className="font-mono text-xs text-tinta-2 mt-0.5">
                      {tc(`tipoCuenta.${c.tipo}` as never)} · {c.moneda} · {c.numero}
                    </p>
                  </div>
                  <Badge
                    className={c.activa ? undefined : INSIGNIA_SEMAFORO.alerta}
                    variant={c.activa ? "neutra" : undefined}
                  >
                    {c.activa ? t("cuentaActiva") : t("cuentaReemplazada", { fecha: c.reemplazada_en ?? "" })}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-tinta-2">
                  {t("cuentaAlta", { nombre: c.creado_por, fecha: c.creado_en })}
                </p>
              </div>
            ))}
          </div>
        )}

        {puedeConfigurar && (
          <div className="mt-4 border-t border-linea pt-4">
            <h3 className="text-sm font-semibold text-tinta mb-3">{t("nuevaCuenta")}</h3>
            <FormularioCuentaProveedor proveedorId={id} />
          </div>
        )}
      </section>

      {/* Facturas */}
      <section className="rounded-tarjeta border border-linea bg-background p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="texto-titulo-seccion flex items-center gap-2">
            <FileText className="size-5 text-tinta-2" />
            {t("facturas")}
          </h2>
          {puedeRegistrar && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/contabilidad/facturas/nueva?proveedor=${id}`}>
                <FilePlus className="size-4" />
                {t("nuevaFactura")}
              </Link>
            </Button>
          )}
        </div>

        {facturas.length === 0 ? (
          <p className="text-sm text-tinta-2">{t("facturasVacio")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea text-xs text-tinta-2 uppercase">
                <tr>
                  <th className="pb-2">Número / NCF</th>
                  <th className="pb-2">Emisión</th>
                  <th className="pb-2">Vencimiento</th>
                  <th className="pb-2 text-right">Neto</th>
                  <th className="pb-2 text-right">Saldo</th>
                  <th className="pb-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {facturas.map((f) => (
                  <tr key={f.id} className="hover:bg-superficie/60 transition-colors">
                    <td className="py-2.5">
                      <Link
                        href={`/contabilidad/facturas/${f.id}`}
                        className="font-medium text-marca-700 hover:underline block"
                      >
                        FP-{String(f.numero).padStart(6, "0")}
                      </Link>
                      {f.ncf && <span className="font-mono text-xs text-tinta-2">{f.ncf}</span>}
                    </td>
                    <td className="py-2.5 text-tinta-2">{f.fecha_emision}</td>
                    <td className="py-2.5 text-tinta-2">{f.fecha_vencimiento}</td>
                    <td className="py-2.5 text-right font-medium">
                      <Monto valor={f.neto} moneda={f.moneda} />
                    </td>
                    <td className="py-2.5 text-right font-semibold">
                      {f.saldo !== null ? (
                        <Monto
                          valor={f.saldo}
                          moneda={f.moneda}
                          className={Number(f.saldo) > 0 ? "text-marca-700" : "text-tinta-2"}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge
                        className={
                          f.estado === "aprobada"
                            ? INSIGNIA_SEMAFORO.dentro
                            : f.estado === "anulada"
                            ? INSIGNIA_SEMAFORO.alerta
                            : undefined
                        }
                        variant={f.estado === "borrador" ? "neutra" : undefined}
                      >
                        {tc(`estadoFactura.${f.estado}` as never)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Estado de cuenta */}
      <section className="rounded-tarjeta border border-linea bg-background p-6 space-y-4">
        <h2 className="texto-titulo-seccion">{t("estadoCuenta")}</h2>
        {estado.length === 0 ? (
          <p className="text-sm text-tinta-2">{t("estadoCuentaVacio")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea text-xs text-tinta-2 uppercase">
                <tr>
                  <th className="pb-2">{t("fecha")}</th>
                  <th className="pb-2">{t("documento")}</th>
                  <th className="pb-2 text-right">{t("cargo")}</th>
                  <th className="pb-2 text-right">{t("abono")}</th>
                  <th className="pb-2 text-right">{t("saldo")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {estado.map((m, idx) => (
                  <tr key={idx} className="hover:bg-superficie/60 transition-colors">
                    <td className="py-2 text-tinta-2 font-mono text-xs">{m.fecha}</td>
                    <td className="py-2 font-medium">{m.documento}</td>
                    <td className="py-2 text-right text-tinta">
                      {m.cargo ? <Monto valor={m.cargo} moneda={m.moneda} /> : "—"}
                    </td>
                    <td className="py-2 text-right text-marca-700 font-medium">
                      {m.abono ? <Monto valor={m.abono} moneda={m.moneda} /> : "—"}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      <Monto valor={m.saldo} moneda={m.moneda} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
