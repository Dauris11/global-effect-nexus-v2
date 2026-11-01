import type { Metadata } from "next";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  Calculator,
  HandCoins,
  Info,
  Landmark,
  Plus,
  Sun,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import { TarjetaCaja } from "@/components/contabilidad/cajas/tarjeta-caja";
import { KpiEnlace } from "@/components/contabilidad/inicio/kpi-enlace";
import { LanzadorModulos } from "@/components/contabilidad/inicio/lanzador-modulos";
import { ParaHoy, type PendienteVisible } from "@/components/contabilidad/inicio/para-hoy";
import { GraficaFlujo } from "@/components/dashboard/graficas";
import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { GRUPOS_CONTABLES, modulosDeGrupo } from "@/lib/contabilidad/modulos";
import { PERIODOS_TABLERO, leerPeriodoTablero } from "@/lib/contabilidad/tablero";
import { claveDia, fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import { cuentasConSaldo, tasaVigente } from "@/server/contabilidad/bancos/consultas";
import { listarCajas } from "@/server/contabilidad/cajas/consultas";
import { pendientesDelDepartamento, resumenFlujo } from "@/server/contabilidad/inicio/consultas";
import { visibilidadDeRol } from "@/server/visibilidad/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.inicio" });
  return { title: t("antetitulo") };
}

const ICONO_PERIODO = { mes: Calendar, trimestre: CalendarRange, anio: CalendarDays } as const;

/**
 * Tablero del Departamento de Contabilidad: cifras del periodo que abren su
 * módulo, flujo por mes, efectivo en bancos y cajas, y la cola de pendientes.
 * El periodo vive en `?periodo=` para que el enlace sea compartible.
 */
export default async function PortalContabilidad({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const [{ locale }, filtros] = await Promise.all([params, searchParams]);
  const idioma = locale === "en" ? "en" : "es";
  const periodo = leerPeriodoTablero(filtros.periodo);
  const usuario = await requerirPermiso("contabilidad.leer");

  const [t, tc, tMiDia, cuentas, tasa, pendientes, cajas, flujo, visibilidad] = await Promise.all([
    getTranslations({ locale, namespace: "contab.inicio" }),
    getTranslations({ locale, namespace: "contab" }),
    getTranslations({ locale, namespace: "miDia" }),
    cuentasConSaldo(),
    tasaVigente(),
    pendientesDelDepartamento(),
    listarCajas(),
    resumenFlujo(periodo),
    visibilidadDeRol(usuario.rol),
  ]);

  const puede = (permiso: Parameters<typeof usuarioTienePermiso>[1]) =>
    usuarioTienePermiso(usuario, permiso);
  const fueraDelMenu = new Set(visibilidad.fueraDelMenu);
  const dop = (n: number | string) => formatearMonto(Number(n).toFixed(2), "DOP");

  const activas = cuentas.filter((c) => c.estado === "activa");
  const cajasActivas = cajas.filter((c) => c.estado === "activa");
  // Una cuenta en dólares sin tasa no se suma: mejor un total parcial dicho
  // por cuenta que un total que mezcla monedas.
  const bancosDop = activas.reduce((s, c) => s + Number(c.saldo_dop ?? 0), 0);
  const cajasDop = cajasActivas
    .filter((c) => c.moneda === "DOP")
    .reduce((s, c) => s + Number(c.saldoActual), 0);
  const liquidez = bancosDop + cajasDop;
  const ajustado = liquidez < flujo.compromisosDop || pendientes.cajas_bajas > 0;

  const todos: PendienteVisible[] = [
    { clave: "cxpVencidas", cuantos: pendientes.cxp_vencidas, href: "/contabilidad/cuentas-por-pagar", urgente: true },
    { clave: "cxpSemana", cuantos: pendientes.cxp_semana, href: "/contabilidad/cuentas-por-pagar" },
    { clave: "comprobantes", cuantos: pendientes.comprobantes_por_validar, href: "/contabilidad/comprobantes-recibidos" },
    { clave: "cajasBajas", cuantos: pendientes.cajas_bajas, href: "/contabilidad/cajas", urgente: true },
    { clave: "arqueos", cuantos: pendientes.arqueos_abiertos, href: "/contabilidad/cajas" },
    { clave: "recibosBorrador", cuantos: pendientes.recibos_borrador, href: "/contabilidad/recibos?estado=borrador" },
    { clave: "facturasBorrador", cuantos: pendientes.facturas_borrador, href: "/contabilidad/proveedores" },
    ...(puede("rendicion.revisar")
      ? [{ clave: "rendiciones" as const, cuantos: pendientes.rendiciones, href: "/administrativo/rendiciones" }]
      : []),
    { clave: "conciliaciones", cuantos: pendientes.conciliaciones_abiertas, href: "/contabilidad/bancos" },
  ];

  const grupos = GRUPOS_CONTABLES.map((grupo) => ({
    grupo,
    modulos: modulosDeGrupo(grupo).filter(
      (modulo) => (!modulo.permiso || puede(modulo.permiso)) && !fueraDelMenu.has(modulo.href),
    ),
  })).filter((grupo) => grupo.modulos.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8 md:space-y-10">
      <EncabezadoPagina
        antetitulo={t("antetitulo")}
        titulo={t("titulo")}
        acciones={
          <>
            <Button asChild variant="outline">
              <Link href="/contabilidad/mi-dia">
                <Sun className="size-4" />
                {tMiDia("title")}
              </Link>
            </Button>
            {puede("contabilidad.registrar") && (
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

      <section className="space-y-4">
        <FilaChips etiqueta={t("periodo.etiqueta")}>
          {PERIODOS_TABLERO.map((p) => (
            <ChipFiltro
              key={p}
              href={`/portal/contabilidad?periodo=${p}`}
              icono={ICONO_PERIODO[p]}
              etiqueta={t(`periodo.${p}`)}
              activo={p === periodo}
            />
          ))}
        </FilaChips>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiEnlace
            href="/contabilidad/recibos?tipo=ingreso"
            icono={ArrowDownLeft}
            acento
            etiqueta={t("kpiIngresos")}
            valor={dop(flujo.ingresosDop)}
            detalle={t("kpiBalance", { monto: dop(flujo.ingresosDop - flujo.egresosDop) })}
          />
          <KpiEnlace
            href="/contabilidad/recibos?tipo=egreso"
            icono={ArrowUpRight}
            etiqueta={t("kpiEgresos")}
            valor={dop(flujo.egresosDop)}
          />
          <KpiEnlace
            href="/contabilidad/bancos"
            icono={Wallet}
            acento
            etiqueta={t("kpiLiquidez")}
            valor={dop(liquidez)}
            detalle={t("kpiDesglose", { bancos: dop(bancosDop), cajas: dop(cajasDop) })}
          />
          <KpiEnlace
            href="/contabilidad/cuentas-por-pagar"
            icono={HandCoins}
            etiqueta={t("kpiCxp")}
            valor={dop(flujo.compromisosDop)}
            detalle={t("kpiPorVencer", { monto: dop(flujo.cxpPorVencerDop) })}
          />
        </div>

        <p
          className={`flex items-center gap-2 rounded-card p-3 text-sm ${
            ajustado ? "bg-tinta text-background" : "bg-marca-50 text-marca-700"
          }`}
        >
          {ajustado ? <AlertCircle className="size-4 shrink-0" /> : <Info className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1">{ajustado ? t("alertaFondos") : t("fondosOk")}</span>
          {ajustado && (
            <Link href="/administrativo/solicitudes" className="inline-flex min-h-11 items-center gap-1 font-medium underline">
              {t("solicitarFondos")}
            </Link>
          )}
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-5">
        <div className={`${TARJETA.contenido} space-y-3 p-5 lg:col-span-3`}>
          <h2 className="texto-titulo-tarjeta">{t("flujoTitulo")}</h2>
          <GraficaFlujo
            datos={flujo.serie}
            etiquetas={{ ingresos: t("kpiIngresos"), egresos: t("kpiEgresos"), vacio: t("flujoVacio") }}
          />
        </div>
        <div className="space-y-3 lg:col-span-2">
          <h2 className="texto-titulo-seccion">{t("pendientes")}</h2>
          <ParaHoy pendientes={todos.filter((p) => p.cuantos > 0)} />
        </div>
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("cajasTitulo")}</h2>
          <Link href="/contabilidad/cajas" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline">
            <Calculator className="size-4" />
            {t("cuadreCaja")}
          </Link>
        </div>
        {cajasActivas.length === 0 ? (
          <EstadoVacio icono={Wallet} titulo={t("cajasVacio")} texto={t("cajasVacioTexto")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cajasActivas.map((caja) => (
              <TarjetaCaja key={caja.id} caja={caja} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="texto-titulo-seccion">{t("saldos")}</h2>
          <Link href="/contabilidad/bancos" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-marca-600 hover:underline">
            {t("verTodos")}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {activas.length === 0 ? (
          <EstadoVacio icono={Landmark} titulo={tc("bancos.vacio")} texto={tc("bancos.vacioTexto")} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activas.map((cuenta) => (
              <li key={cuenta.id} className="min-w-0">
                <Link href={`/contabilidad/bancos/${cuenta.id}`} className={`${TARJETA.interactiva} block p-5`}>
                  <p className="texto-meta truncate">{cuenta.nombre}</p>
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
        <p className="texto-meta flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-marca-600" />
          {tasa
            ? tasa.fecha < claveDia()
              ? t("tasaVieja", { fecha: fechaCorta(tasa.fecha, idioma) })
              : t("tasaDe", { compra: tasa.compra, venta: tasa.venta, fuente: tasa.fuente, fecha: fechaCorta(tasa.fecha, idioma) })
            : t("tasaVacia")}
        </p>
      </section>

      <section className="space-y-4 border-t border-linea pt-8">
        <h2 className="texto-titulo-seccion">{t("modulos")}</h2>
        <LanzadorModulos grupos={grupos} />
      </section>
    </div>
  );
}
