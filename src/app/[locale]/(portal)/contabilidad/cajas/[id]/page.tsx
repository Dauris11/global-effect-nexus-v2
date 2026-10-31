import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  DollarSign,
  Receipt,
  User,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { claveDia } from "@/lib/fechas";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import {
  obtenerCaja,
  listarMovimientosCaja,
  listarArqueos,
} from "@/server/contabilidad/cajas/consultas";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";
import { listarUsuariosSolicitantes } from "@/server/contabilidad/proveedores/consultas";
import { FormularioMovimientoCaja } from "@/components/contabilidad/cajas/formulario-movimiento";
import { ModalReposicionCaja } from "@/components/contabilidad/cajas/modal-reposicion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const caja = await obtenerCaja(id);
  return { title: caja ? `${caja.nombre} · Caja Chica` : "Caja Chica" };
}

export default async function PaginaDetalleCaja({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  await requerirPermiso("contabilidad.leer");

  const [t, caja, movimientos, arqueos, cuentas, personas] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cajas" }),
    obtenerCaja(id),
    listarMovimientosCaja(id),
    listarArqueos(id),
    cuentasConSaldo(),
    listarUsuariosSolicitantes(),
  ]);

  if (!caja) notFound();

  const saldoNum = parseFloat(caja.saldoActual);
  const fondoNum = parseFloat(caja.fondoFijo);
  const pct = Math.min(100, Math.round((saldoNum / fondoNum) * 100));

  const cuentasBancoOpciones = cuentas.map((c) => ({
    id: c.id,
    bancoNombre: c.banco,
    numeroCuenta: c.numero,
    moneda: c.moneda,
    saldoActual: c.saldo,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-tinta-2">
          <Link href="/contabilidad/cajas">
            <ArrowLeft className="size-4" />
            <span>{t("volverCajas")}</span>
          </Link>
        </Button>

        <EncabezadoPagina
          antetitulo={`Caja Chica · ${caja.codigo}`}
          titulo={caja.nombre}
          subtitulo={`Responsable: ${caja.responsableNombre} · Departamento: ${caja.departamento}`}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              <ModalReposicionCaja
                caja={caja}
                cuentasBanco={cuentasBancoOpciones}
                hoy={claveDia()}
              />
              <FormularioMovimientoCaja
                caja={caja}
                personas={personas}
                hoy={claveDia()}
              />
              <Button asChild size="sm">
                <Link href={`/contabilidad/cajas/${caja.id}/arqueo`}>
                  <Calculator className="size-4" />
                  <span>{t("nuevoArqueo")}</span>
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      {/* Resumen de Fondos y Estado */}
      <div className="grid gap-4 sm:grid-cols-3 rounded-tarjeta border border-linea bg-background p-5 shadow-sm text-sm">
        <div className="space-y-1">
          <span className="texto-meta block">Fondo fijo asignado</span>
          <span className="text-xl font-bold text-tinta">
            {formatearMonto(caja.fondoFijo, caja.moneda)}
          </span>
        </div>
        <div className="space-y-1">
          <span className="texto-meta block">Saldo disponible actual</span>
          <span className="text-xl font-bold text-marca-700">
            {formatearMonto(caja.saldoActual, caja.moneda)}
          </span>
          <div className="flex items-center gap-2 text-xs text-tinta-2 mt-1">
            <span>{pct}% disponible</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-linea">
              <div
                className={`h-full ${
                  pct < 25 ? "bg-semaforo-alerta" : pct < 50 ? "bg-semaforo-precaucion" : "bg-marca"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <span className="texto-meta block">Reglas de soporte</span>
          <p className="text-xs text-tinta-2">
            Adjunto obligatorio en gastos &ge;{" "}
            <span className="font-semibold text-tinta">
              {formatearMonto(caja.umbralAdjunto, caja.moneda)}
            </span>
          </p>
          <div className="mt-1">
            <Badge
              className={
                caja.estado === "activa" ? INSIGNIA_SEMAFORO.dentro : INSIGNIA_SEMAFORO.alerta
              }
            >
              Caja {caja.estado}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabla de Movimientos y Vales */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="texto-titulo-seccion">Movimientos de caja (vales y gastos)</h2>
        </div>

        <div className="rounded-tarjeta border border-linea bg-background overflow-hidden shadow-sm">
          {movimientos.length === 0 ? (
            <div className="p-8 text-center text-sm text-tinta-2">
              No hay movimientos registrados en esta caja.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-superficie/60 text-xs font-semibold uppercase text-tinta-2 border-b border-linea">
                  <tr>
                    <th className="px-4 py-3">No.</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Beneficiario / Solicitante</th>
                    <th className="px-4 py-3">Concepto</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-center">Arqueo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {movimientos.map((m) => (
                    <tr key={m.id} className="hover:bg-superficie/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-tinta">
                        CJ-{String(m.numero).padStart(6, "0")}
                      </td>
                      <td className="px-4 py-3 text-tinta whitespace-nowrap">{m.fecha}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                            m.tipo === "reposicion"
                              ? "bg-marca-50 text-marca-800"
                              : m.tipo === "vale"
                              ? "bg-superficie text-tinta-2 border border-linea"
                              : "bg-semaforo-alerta/10 text-semaforo-alerta"
                          }`}
                        >
                          {m.tipo === "reposicion"
                            ? "Reposición"
                            : m.tipo === "vale"
                            ? "Vale provisional"
                            : "Gasto menor"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-tinta">
                        {m.personaNombre ? (
                          <div className="flex items-center gap-1.5">
                            <User className="size-3.5 text-tinta-2" />
                            <span>{m.personaNombre}</span>
                          </div>
                        ) : (
                          <span className="text-tinta-2">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-tinta max-w-xs truncate">
                        {m.concepto}
                        {m.adjuntoRuta && (
                          <span className="ml-2 inline-flex items-center text-[10px] text-marca-700 font-semibold">
                            (con adjunto)
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-medium ${
                          m.tipo === "reposicion" ? "text-marca-700 font-semibold" : "text-tinta"
                        }`}
                      >
                        {m.tipo === "reposicion" ? "+" : "-"}
                        {formatearMonto(m.monto, caja.moneda)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.arqueoId ? (
                          <Badge variant="neutra" className="text-[10px]">
                            Cuadrado
                          </Badge>
                        ) : (
                          <span className="text-xs text-semaforo-precaucion font-medium">
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Historial de Arqueos */}
      <div className="space-y-4 pt-4 border-t border-linea">
        <div className="flex items-center justify-between">
          <h2 className="texto-titulo-seccion">{t("arqueos")}</h2>
        </div>

        <div className="rounded-tarjeta border border-linea bg-background overflow-hidden shadow-sm">
          {arqueos.length === 0 ? (
            <div className="p-8 text-center text-sm text-tinta-2">
              {t("sinArqueos")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-superficie/60 text-xs font-semibold uppercase text-tinta-2 border-b border-linea">
                  <tr>
                    <th className="px-4 py-3">No. Arqueo</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Saldo Sistema</th>
                    <th className="px-4 py-3 text-right">Saldo Físico</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3">Justificación</th>
                    <th className="px-4 py-3">Revisado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {arqueos.map((a) => {
                    const dif = parseFloat(a.diferencia);
                    const exacta = dif === 0;

                    return (
                      <tr key={a.id} className="hover:bg-superficie/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-tinta">
                          AR-{String(a.numero).padStart(6, "0")}
                        </td>
                        <td className="px-4 py-3 text-tinta">{a.fecha}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatearMonto(a.saldoSistema, caja.moneda)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium">
                          {formatearMonto(a.saldoContado, caja.moneda)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {exacta ? (
                            <span className="inline-flex items-center gap-1 rounded bg-semaforo-dentro/15 px-2 py-0.5 text-xs font-semibold text-semaforo-dentro">
                              <CheckCircle2 className="size-3" />
                              Exacto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-semaforo-alerta/15 px-2 py-0.5 text-xs font-semibold text-semaforo-alerta">
                              <AlertCircle className="size-3" />
                              {dif > 0 ? "+" : ""}
                              {formatearMonto(a.diferencia, caja.moneda)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-tinta-2 max-w-xs truncate">
                          {a.justificacion ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-tinta">
                          {a.revisadoPorNombre ?? a.creadoPorNombre}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
