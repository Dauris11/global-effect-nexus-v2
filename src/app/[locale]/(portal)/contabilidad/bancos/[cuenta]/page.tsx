import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, Download, ListChecks, Rows3, Scale, XCircle } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { BotonAnularPartida, Conciliador } from "@/components/contabilidad/bancos/conciliador";
import { DialogoConfigurarCuentaBanco } from "@/components/contabilidad/bancos/dialogo-configurar-banco";
import { DialogoSubirEstado } from "@/components/contabilidad/bancos/formularios-banco";
import { LibroBanco } from "@/components/contabilidad/bancos/libro-banco";
import { Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { TooltipAyuda } from "@/components/ui/tooltip-ayuda";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { numeroDocumento } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  cuentaPorId,
  cuentasAuxiliaresDeActivo,
  extractoDeBanco,
  leerFiltroExtracto,
  partidasConciliadas,
  porConciliar,
  solicitudesCambioBanco,
} from "@/server/contabilidad/bancos/consultas";
import {
  formatosEstadoBanco,
  impuestosCargos,
} from "@/server/contabilidad/configuracion/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cuenta: string }>;
}): Promise<Metadata> {
  const { cuenta } = await params;
  const datos = await cuentaPorId(cuenta);
  return { title: datos?.nombre };
}

const VISTAS = ["movimientos", "conciliar", "conciliadas"] as const;
type Vista = (typeof VISTAS)[number];
const ICONO = { movimientos: Rows3, conciliar: Scale, conciliadas: ListChecks } as const;

/**
 * Una cuenta de banco en tres vistas (`?vista=`): sus movimientos, conciliar
 * y lo ya conciliado (Observaciones #1). El estado de cuenta se sube desde
 * aquí mismo, y aquí se ve y se cambia con qué cuenta contable auxiliar está
 * vinculado el banco: es la cuenta cuyos asientos se concilian.
 */
export default async function PaginaCuentaBanco({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; cuenta: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, cuenta: cuentaId } = await params;
  const idioma = locale === "en" ? "en" : "es";
  const usuario = await requerirPermiso("contabilidad.leer");

  const cuenta = await cuentaPorId(cuentaId);
  if (!cuenta) notFound();

  const crudo = await searchParams;
  const vista: Vista = (VISTAS as readonly unknown[]).includes(crudo.vista) ? (crudo.vista as Vista) : "movimientos";
  const concilia = usuarioTienePermiso(usuario, "contabilidad.conciliar") && cuenta.estado === "activa";
  const esContabilidad = usuario.rol === "contabilidad";

  const [t, tc, mensajes, formatos, auxiliares, solicitudesPendientes] = await Promise.all([
    getTranslations({ locale, namespace: "contab.conciliacion" }),
    getTranslations({ locale, namespace: "contab" }),
    mensajesCliente(["contab"]),
    concilia ? formatosEstadoBanco(true) : Promise.resolve([]),
    cuentasAuxiliaresDeActivo(),
    solicitudesCambioBanco(cuenta.id, esContabilidad ? undefined : usuario.id),
  ]);

  return (
    <div className="space-y-6 animate-entrada">
      <Link href="/contabilidad/bancos" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline">
        <ChevronLeft className="size-4" />
        {tc("bancos.titulo")}
      </Link>

      <NextIntlClientProvider messages={mensajes}>
        <EncabezadoPagina
          titulo={
            <span className="inline-flex items-center gap-2">
              <span>{cuenta.nombre}</span>
              <DialogoConfigurarCuentaBanco
                cuenta={cuenta}
                auxiliares={auxiliares}
                esContabilidad={esContabilidad}
                solicitudesPendientes={solicitudesPendientes}
              />
            </span>
          }
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              {concilia && <DialogoSubirEstado cuentaId={cuenta.id} formatos={formatos} />}
              <Button asChild variant="outline" size="sm">
                <a href={`/api/contabilidad/exportar/bancos?cuentaId=${cuenta.id}`} download>
                  <Download className="size-4" />
                  {tc("exportarExcel")}
                </a>
              </Button>
            </div>
          }
        />
      </NextIntlClientProvider>

      <FilaChips etiqueta={t("vistas")}>
        {VISTAS.map((v) => (
          <ChipFiltro
            key={v}
            icono={ICONO[v]}
            etiqueta={t(`vista.${v}`)}
            activo={vista === v}
            href={`/contabilidad/bancos/${cuenta.id}?vista=${v}`}
          />
        ))}
      </FilaChips>

      {vista === "movimientos" && (
        <NextIntlClientProvider messages={mensajes}>
          <VistaMovimientos
            cuentaId={cuenta.id}
            moneda={cuenta.moneda}
            crudo={crudo}
            idioma={idioma}
          />
        </NextIntlClientProvider>
      )}

      {vista === "conciliar" && (
        <NextIntlClientProvider messages={mensajes}>
          <VistaConciliar cuentaId={cuenta.id} moneda={cuenta.moneda} concilia={concilia} />
        </NextIntlClientProvider>
      )}

      {vista === "conciliadas" && (
        <NextIntlClientProvider messages={mensajes}>
          <VistaConciliadas cuentaId={cuenta.id} moneda={cuenta.moneda} concilia={concilia} idioma={idioma} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}

async function VistaMovimientos({
  cuentaId,
  moneda,
  crudo,
  idioma,
}: {
  cuentaId: string;
  moneda: "DOP" | "USD";
  crudo: Record<string, string | string[] | undefined>;
  idioma: "es" | "en";
}) {
  const filtro = leerFiltroExtracto(crudo);
  const [movimientos, cargos] = await Promise.all([
    extractoDeBanco(cuentaId, filtro),
    impuestosCargos(true),
  ]);
  return (
    <LibroBanco
      cuentaId={cuentaId}
      moneda={moneda}
      filtro={filtro}
      movimientos={movimientos}
      cargos={cargos}
      idioma={idioma}
    />
  );
}

async function VistaConciliar({
  cuentaId,
  moneda,
  concilia,
}: {
  cuentaId: string;
  moneda: "DOP" | "USD";
  concilia: boolean;
}) {
  const [t, pendientes, cargos] = await Promise.all([
    getTranslations("contab.conciliacion"),
    porConciliar(cuentaId),
    impuestosCargos(true),
  ]);
  if (!concilia) return <EstadoVacio icono={Scale} titulo={t("sinPermiso")} />;
  if (pendientes.banco.length === 0 && pendientes.libros.length === 0) {
    return <EstadoVacio icono={Scale} titulo={t("todoConciliado")} />;
  }
  return (
    <Conciliador
      cuentaId={cuentaId}
      moneda={moneda}
      banco={pendientes.banco}
      libros={pendientes.libros}
      cargos={cargos}
    />
  );
}

async function VistaConciliadas({
  cuentaId,
  moneda,
  concilia,
  idioma,
}: {
  cuentaId: string;
  moneda: "DOP" | "USD";
  concilia: boolean;
  idioma: "es" | "en";
}) {
  const [t, partidas] = await Promise.all([getTranslations("contab.conciliacion"), partidasConciliadas(cuentaId)]);
  if (partidas.length === 0) return <EstadoVacio icono={ListChecks} titulo={t("ningunaConciliada")} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <h2 className="texto-titulo-seccion">{t("conciliadasTitulo", { n: partidas.length })}</h2>
        <TooltipAyuda texto={t("conciliadasAyuda")} etiqueta={t("masInformacion")} />
      </div>
      <div className="overflow-x-auto rounded-card border border-linea bg-card shadow-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-linea text-tinta-3">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 font-medium">{t("colConciliadas.fecha")}</th>
              <th className="px-3 py-3 font-medium">{t("colConciliadas.descBanco")}</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">{t("colConciliadas.refBanco")}</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">{t("colConciliadas.asiento")}</th>
              <th className="px-3 py-3 font-medium">{t("colConciliadas.descLibro")}</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">{t("colConciliadas.refLibro")}</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-medium">{t("colConciliadas.monto")}</th>
              <th className="whitespace-nowrap px-3 py-3 text-center font-medium">{t("colConciliadas.comision")}</th>
              <th className="whitespace-nowrap px-3 py-3 font-medium">{t("colConciliadas.usuario")}</th>
              {concilia && (
                <th className="whitespace-nowrap px-3 py-3 text-right font-medium">{t("colConciliadas.anular")}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {partidas.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-muted/40">
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-tinta-2">
                  {fechaCorta(p.conciliado_en, idioma)}
                </td>
                <td className="max-w-52 truncate px-3 py-2.5 text-tinta" title={p.banco_descripcion}>
                  {p.banco_descripcion}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-tinta-2">
                  {p.banco_referencia || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">
                  {p.asiento_id && p.asiento_numero ? (
                    <Link
                      href={`/contabilidad/asientos/${p.asiento_id}`}
                      className="font-medium text-marca-600 hover:underline"
                    >
                      {numeroDocumento("AS", p.asiento_numero)}
                    </Link>
                  ) : (
                    <span className="text-tinta-3">—</span>
                  )}
                </td>
                <td
                  className="max-w-52 truncate px-3 py-2.5 text-tinta"
                  title={p.libro_descripcion ?? p.cargo_nombre ?? undefined}
                >
                  {p.libro_descripcion ?? p.cargo_nombre ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-tinta-2">
                  {p.libro_referencia || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                  <Monto valor={p.monto} moneda={moneda} conSigno className="font-semibold" />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  {p.es_comision ? (
                    <Badge className={INSIGNIA_SEMAFORO.dentro}>
                      <CheckCircle2 />
                      {t("si")}
                    </Badge>
                  ) : (
                    <Badge className={INSIGNIA_SEMAFORO.alerta}>
                      <XCircle />
                      {t("no")}
                    </Badge>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-tinta-2">
                  {p.conciliado_por}
                </td>
                {concilia && (
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <BotonAnularPartida id={p.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
