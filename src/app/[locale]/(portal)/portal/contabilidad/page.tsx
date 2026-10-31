import type { Metadata } from "next";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  HandCoins,
  Info,
  Landmark,
  Plus,
  ReceiptText,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { LanzadorModulos } from "@/components/contabilidad/inicio/lanzador-modulos";
import { ParaHoy, type PendienteVisible } from "@/components/contabilidad/inicio/para-hoy";
import { ListaRecibos } from "@/components/contabilidad/recibos/lista-recibos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { visibilidadDeRol } from "@/server/visibilidad/consultas";
import { formatearMonto, sumarMontos } from "@/lib/contabilidad/formato";
import { GRUPOS_CONTABLES, modulosDeGrupo } from "@/lib/contabilidad/modulos";
import { claveDia, fechaCorta } from "@/lib/fechas";
import { TARJETA, INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cuentasConSaldo, tasaVigente } from "@/server/contabilidad/bancos/consultas";
import { listarCajas } from "@/server/contabilidad/cajas/consultas";
import {
  pendientesDelDepartamento,
  resumenFinancieroFundacion,
} from "@/server/contabilidad/inicio/consultas";
import { leerFiltroRecibos, recibos } from "@/server/contabilidad/recibos/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.inicio" });
  return { title: t("antetitulo") };
}

/**
 * Inicio del Departamento de Contabilidad (§4.1).
 *
 * Diseñado bajo la misión institucional de una Fundación (ASFL Ley 122-05):
 * 1. Control del flujo de fondos: dinero que entra, dinero que sale y cuánto se tiene.
 * 2. Indicador de liquidez para saber si hay que solicitar más dinero.
 * 3. Acceso directo al cuadre de caja (arqueo físico de billetes y monedas).
 * 4. Cuentas bancarias y cola de decisiones de hoy.
 * 5. Módulos y funciones organizados por ciclo de trabajo.
 */
export default async function PortalContabilidad({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tMiDia, tc, cuentas, tasa, pendientes, recientes, cajas, resumen] = await Promise.all([
    getTranslations({ locale, namespace: "contab.inicio" }),
    getTranslations({ locale, namespace: "miDia" }),
    getTranslations({ locale, namespace: "contab" }),
    cuentasConSaldo(),
    tasaVigente(),
    pendientesDelDepartamento(),
    recibos(leerFiltroRecibos({}), 5),
    listarCajas(),
    resumenFinancieroFundacion(),
  ]);

  const fueraDelMenu = new Set((await visibilidadDeRol(usuario.rol)).fueraDelMenu);
  const puede = (permiso: Parameters<typeof usuarioTienePermiso>[1]) =>
    usuarioTienePermiso(usuario, permiso);

  const todos: PendienteVisible[] = [
    { clave: "cxpVencidas", cuantos: pendientes.cxp_vencidas, href: "/contabilidad/cuentas-por-pagar", urgente: true },
    { clave: "cxpSemana", cuantos: pendientes.cxp_semana, href: "/contabilidad/cuentas-por-pagar" },
    { clave: "recibosBorrador", cuantos: pendientes.recibos_borrador, href: "/contabilidad/recibos?estado=borrador" },
    { clave: "facturasBorrador", cuantos: pendientes.facturas_borrador, href: "/contabilidad/proveedores" },
    ...(puede("rendicion.revisar")
      ? [{ clave: "rendiciones" as const, cuantos: pendientes.rendiciones, href: "/administrativo/rendiciones" }]
      : []),
    { clave: "arqueos", cuantos: pendientes.arqueos_abiertos, href: "/contabilidad/cajas" },
    { clave: "conciliaciones", cuantos: pendientes.conciliaciones_abiertas, href: "/contabilidad/bancos" },
  ];
  const paraHoy = todos.filter((pendiente) => pendiente.cuantos > 0);

  const grupos = GRUPOS_CONTABLES.map((grupo) => ({
    grupo,
    modulos: modulosDeGrupo(grupo).filter(
      (modulo) => (!modulo.permiso || puede(modulo.permiso)) && !fueraDelMenu.has(modulo.href),
    ),
  })).filter((grupo) => grupo.modulos.length > 0);

  const activas = cuentas.filter((c) => c.estado === "activa");
  const cajasActivas = cajas.filter((c) => c.estado === "activa");

  const totalDop = activas.every((c) => c.saldo_dop !== null)
    ? sumarMontos(activas.map((c) => c.saldo_dop ?? "0"))
    : null;
  const tasaVieja = tasa && tasa.fecha < claveDia();

  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <EncabezadoPagina
        antetitulo={t("antetitulo")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
        acciones={
          <>
            <Button asChild variant="outline">
              <Link href="/contabilidad/mi-dia">
                <Sun className="size-4" />
                {tMiDia("title")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contabilidad/cajas">
                <Calculator className="size-4" />
                {t("cuadreCaja")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/administrativo/solicitudes">
                <Send className="size-4" />
                {t("solicitarFondos")}
              </Link>
            </Button>
            {usuarioTienePermiso(usuario, "contabilidad.registrar") && (
              <Button asChild>
                <Link href="/contabilidad/recibos/nuevo">
                  <Plus className="size-4" />
                  {t("nuevoRecibo")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* ── Flujo de fondos institucional: Dinero que entra, sale y cuánto se tiene ── */}
      <section className="space-y-4">
        <div>
          <h2 className="texto-titulo-seccion">{t("resumenFundacion")}</h2>
          <p className="texto-meta">{t("resumenFundacionDesc")}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Dinero que entra */}
          <div className={`${TARJETA.contenido} flex flex-col justify-between p-5`}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-marca-50 text-marca-600">
                <ArrowDownLeft className="size-5" />
              </span>
              <Badge variant="neutra">DOP</Badge>
            </div>
            <div className="mt-4">
              <p className="texto-meta">{t("dineroEntra")}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-tinta">
                {formatearMonto(resumen.ingresosMesDop, "DOP")}
              </p>
            </div>
          </div>

          {/* Dinero que sale */}
          <div className={`${TARJETA.contenido} flex flex-col justify-between p-5`}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-muted text-tinta">
                <ArrowUpRight className="size-5" />
              </span>
              <Badge variant="neutra">DOP</Badge>
            </div>
            <div className="mt-4">
              <p className="texto-meta">{t("dineroSale")}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-tinta">
                {formatearMonto(resumen.egresosMesDop, "DOP")}
              </p>
            </div>
          </div>

          {/* Cuánto se tiene (Liquidez Total) */}
          <div className={`${TARJETA.contenido} flex flex-col justify-between p-5`}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-marca-50 text-marca-600">
                <Wallet className="size-5" />
              </span>
              <Badge variant="solida">Total</Badge>
            </div>
            <div className="mt-4">
              <p className="texto-meta">{t("disponibilidadTotal")}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-marca-700">
                {formatearMonto(resumen.totalLiquidezDop, "DOP")}
              </p>
              <p className="mt-1 truncate text-xs text-tinta-2">
                {t("disponibilidadDesglose", {
                  bancos: formatearMonto(resumen.disponibleBancosDop, "DOP"),
                  cajas: formatearMonto(resumen.disponibleCajasDop, "DOP"),
                })}
              </p>
            </div>
          </div>

          {/* Compromisos por pagar */}
          <div className={`${TARJETA.contenido} flex flex-col justify-between p-5`}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-muted text-tinta">
                <HandCoins className="size-5" />
              </span>
              <Badge variant="neutra">CxP</Badge>
            </div>
            <div className="mt-4">
              <p className="texto-meta">{t("compromisosPendientes")}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-tinta">
                {formatearMonto(resumen.compromisosPendientesDop, "DOP")}
              </p>
            </div>
          </div>
        </div>

        {/* Diagnóstico de Fondos: ¿Hay que solicitar más dinero? */}
        {resumen.requiereFondos ? (
          <div className="flex flex-col gap-4 rounded-card border border-semaforo-alerta/40 bg-semaforo-alerta/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-semaforo-alerta" />
              <div>
                <p className="font-semibold text-tinta">{t("estadoFondosAlerta")}</p>
                {resumen.cajasBajasCount > 0 && (
                  <p className="mt-0.5 text-xs text-tinta-2">
                    {resumen.cajasBajasCount} caja(s) chica(s) con saldo por debajo del 25% de su fondo fijo.
                  </p>
                )}
              </div>
            </div>
            <Button asChild size="sm">
              <Link href="/administrativo/solicitudes">
                <Send className="size-4" />
                {t("solicitarFondos")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-semaforo-dentro/30 bg-semaforo-dentro/5 p-4">
            <ShieldCheck className="size-5 shrink-0 text-semaforo-dentro" />
            <p className="text-sm font-medium text-tinta">{t("estadoFondosOptimo")}</p>
          </div>
        )}
      </section>

      {/* ── Cajas chicas y Cuadre de caja físico (Efectivo en mano) ── */}
      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="texto-titulo-seccion">{t("cajasTitulo")}</h2>
            <p className="texto-meta">{t("cajasSubtitulo")}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/contabilidad/cajas">
              <Calculator className="size-4" />
              {t("cuadreCaja")}
            </Link>
          </Button>
        </div>

        {cajasActivas.length === 0 ? (
          <EstadoVacio
            icono={Wallet}
            titulo="Sin cajas chicas activas"
            texto="Crea una caja chica para gastos menores y arqueos físicos."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cajasActivas.map((caja) => {
              const saldoNum = parseFloat(caja.saldoActual);
              const fondoNum = parseFloat(caja.fondoFijo);
              const pct = Math.min(100, Math.round((saldoNum / (fondoNum || 1)) * 100));

              return (
                <div key={caja.id} className={`${TARJETA.contenido} flex flex-col justify-between p-5`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-marca-50 px-2 py-0.5 font-mono text-xs font-semibold text-marca-700">
                          {caja.codigo}
                        </span>
                        <h3 className="mt-1 line-clamp-1 text-base font-semibold text-tinta">
                          {caja.nombre}
                        </h3>
                        <p className="text-xs text-tinta-2 capitalize">{caja.departamento}</p>
                      </div>
                      <Badge className={caja.estado === "activa" ? INSIGNIA_SEMAFORO.dentro : INSIGNIA_SEMAFORO.alerta}>
                        {caja.estado}
                      </Badge>
                    </div>

                    <div className="space-y-2 rounded-control bg-muted/60 p-3 text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="texto-meta">{t("disponibilidadTotal")}</span>
                        <span className="text-lg font-bold text-tinta">
                          {formatearMonto(caja.saldoActual, caja.moneda)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-tinta-2">
                          <span>{t("fondoFijo")}: {formatearMonto(caja.fondoFijo, caja.moneda)}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-linea">
                          <div
                            className={`h-full transition-all ${
                              pct < 25
                                ? "bg-semaforo-alerta"
                                : pct < 50
                                ? "bg-semaforo-precaucion"
                                : "bg-marca"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-linea pt-3">
                    <Button asChild size="sm" className="w-full">
                      <Link href={`/contabilidad/cajas/${caja.id}/arqueo`}>
                        <Calculator className="size-3.5" />
                        <span>{t("hacerArqueo")}</span>
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/contabilidad/cajas/${caja.id}`}>
                        <ReceiptText className="size-3.5" />
                        <span>{t("verCaja")}</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Bancos y Cuentas de la Fundación ── */}
      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("saldos")}</h2>
          {totalDop && (
            <p className="text-right">
              <span className="texto-meta block">{t("totalDop")}</span>
              <span className="text-lg font-semibold text-tinta">{formatearMonto(totalDop, "DOP")}</span>
            </p>
          )}
        </div>
        {activas.length === 0 ? (
          <EstadoVacio icono={Landmark} titulo={tc("bancos.vacio")} texto={tc("bancos.vacioTexto")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activas.map((cuenta) => (
              <li key={cuenta.id} className="min-w-0">
                <Link href={`/contabilidad/bancos/${cuenta.id}`} className={`${TARJETA.interactiva} block p-5`}>
                  <p className="texto-meta">{cuenta.nombre}</p>
                  <p className="mt-1 text-2xl font-semibold text-tinta">
                    <Monto valor={cuenta.saldo} moneda={cuenta.moneda} />
                  </p>
                  {cuenta.moneda === "USD" && (
                    <p className="texto-meta">
                      {cuenta.saldo_dop
                        ? t("equivalente", { monto: formatearMonto(cuenta.saldo_dop, "DOP") })
                        : t("sinTasa")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-start gap-2 text-sm text-tinta-2">
          <Info className="mt-0.5 size-4 shrink-0 text-marca-600" />
          {tasa
            ? tasaVieja
              ? t("tasaVieja", { fecha: fechaCorta(tasa.fecha, idioma) })
              : t("tasaDe", { compra: tasa.compra, venta: tasa.venta, fuente: tasa.fuente, fecha: fechaCorta(tasa.fecha, idioma) })
            : t("tasaVacia")}
        </p>
      </section>

      {/* ── Para hoy: cola de pendientes del departamento ── */}
      <section className="space-y-4 border-t border-linea pt-8">
        <h2 className="texto-titulo-seccion">{t("paraHoy.titulo")}</h2>
        <ParaHoy pendientes={paraHoy} />
      </section>

      {/* ── Módulos y funciones del departamento ── */}
      <section className="space-y-4 border-t border-linea pt-8">
        <div>
          <h2 className="texto-titulo-seccion">{t("modulos")}</h2>
          <p className="texto-meta">{t("modulosTexto")}</p>
        </div>
        <LanzadorModulos grupos={grupos} />
      </section>

      {/* ── Recibos recientes ── */}
      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("recientes")}</h2>
          <Link href="/contabilidad/recibos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline">
            {t("verTodos")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {recientes.length > 0 && <ListaRecibos filas={recientes.slice(0, 5)} idioma={idioma} />}
      </section>
    </div>
  );
}
