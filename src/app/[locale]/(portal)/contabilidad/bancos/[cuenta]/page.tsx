import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Link2, ListChecks, Rows3, Scale } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { BotonAnularPartida, Conciliador } from "@/components/contabilidad/bancos/conciliador";
import { DialogoSubirEstado, DialogoVincularCuenta } from "@/components/contabilidad/bancos/formularios-banco";
import { LibroBanco } from "@/components/contabilidad/bancos/libro-banco";
import { Monto } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { enmascararCuenta, numeroDocumento } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { TARJETA } from "@/lib/paleta";
import { usuarioTienePermiso } from "@/lib/rbac";
import {
  configuracionEstado,
  cuentaPorId,
  cuentasAuxiliaresDeActivo,
  leerFiltroLibro,
  libroDeBanco,
  partidasConciliadas,
  porConciliar,
} from "@/server/contabilidad/bancos/consultas";

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
  const configura = usuarioTienePermiso(usuario, "contabilidad.configurar");

  const [t, tc, mensajes, config, auxiliares] = await Promise.all([
    getTranslations({ locale, namespace: "contab.conciliacion" }),
    getTranslations({ locale, namespace: "contab" }),
    mensajesCliente(["contab"]),
    concilia ? configuracionEstado(cuenta.id) : Promise.resolve(null),
    configura ? cuentasAuxiliaresDeActivo() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-entrada">
      <Link href="/contabilidad/bancos" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-600 hover:underline">
        <ArrowLeft className="size-4" />
        {tc("bancos.titulo")}
      </Link>

      <NextIntlClientProvider messages={mensajes}>
        <EncabezadoPagina
          titulo={cuenta.nombre}
          subtitulo={`${cuenta.banco} · ${enmascararCuenta(cuenta.numero)} · ${cuenta.moneda}`}
          acciones={
            <div className="flex flex-wrap items-center gap-2">
              {concilia && config && <DialogoSubirEstado cuentaId={cuenta.id} config={config.config} />}
              <Button asChild variant="outline" size="sm">
                <a href={`/api/contabilidad/exportar/bancos?cuentaId=${cuenta.id}`} download>
                  <Download className="size-4" />
                  {tc("exportarExcel")}
                </a>
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link2 className="size-4 text-tinta-3" />
          <span className="text-tinta-2">{t("vinculada")}</span>
          <span className="font-medium text-tinta">{cuenta.cuenta_contable}</span>
          {configura && (
            <DialogoVincularCuenta cuentaId={cuenta.id} actual={cuenta.cuenta_contable_id} opciones={auxiliares} />
          )}
        </div>
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
        <LibroBanco
          cuentaId={cuenta.id}
          moneda={cuenta.moneda}
          filtro={leerFiltroLibro(crudo)}
          libro={await libroDeBanco(cuenta.id, leerFiltroLibro(crudo))}
          idioma={idioma}
        />
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

async function VistaConciliar({
  cuentaId,
  moneda,
  concilia,
}: {
  cuentaId: string;
  moneda: "DOP" | "USD";
  concilia: boolean;
}) {
  const [t, pendientes] = await Promise.all([getTranslations("contab.conciliacion"), porConciliar(cuentaId)]);
  if (!concilia) return <EstadoVacio icono={Scale} titulo={t("sinPermiso")} />;
  if (pendientes.banco.length === 0 && pendientes.libros.length === 0) {
    return <EstadoVacio icono={Scale} titulo={t("todoConciliado")} />;
  }
  return <Conciliador cuentaId={cuentaId} moneda={moneda} banco={pendientes.banco} libros={pendientes.libros} />;
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
    <ul className="space-y-3">
      {partidas.map((p) => (
        <li key={p.id} className={`${TARJETA.contenido} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 sm:gap-6">
            <div className="min-w-0">
              <p className="texto-meta">{t("delBancoCorto")}</p>
              <p className="truncate text-tinta">{p.banco_descripcion}</p>
              <p className="texto-meta">
                {fechaCorta(p.banco_fecha, idioma)}
                {p.banco_referencia && ` · ${p.banco_referencia}`}
              </p>
            </div>
            <div className="min-w-0">
              <p className="texto-meta">{t("deLibrosCorto")}</p>
              <Link href={`/contabilidad/asientos/${p.asiento_id}`} className="block truncate text-marca-600 hover:underline">
                {numeroDocumento("AS", p.asiento_numero)} · {p.asiento_concepto}
              </Link>
              <p className="texto-meta">{t("conciliadaPor", { nombre: p.conciliado_por, fecha: fechaCorta(p.conciliado_en, idioma) })}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <Monto valor={p.monto} moneda={moneda} conSigno className="font-semibold" />
            {concilia && <BotonAnularPartida id={p.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
