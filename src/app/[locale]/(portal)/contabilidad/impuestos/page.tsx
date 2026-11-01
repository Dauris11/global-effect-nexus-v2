import type { Metadata } from "next";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { INSIGNIA_SEMAFORO, TARJETA } from "@/lib/paleta";
import { cuentasConSaldo } from "@/server/contabilidad/bancos/consultas";
import { hoyEnLaBase } from "@/server/contabilidad/cxp/consultas";
import {
  calcularIr17,
  calcularIsfl01,
  calcularIt1,
} from "@/server/contabilidad/dgii/calculo-impuestos";
import {
  listarDeclaraciones,
  obtenerCalendarioFiscal,
} from "@/server/contabilidad/dgii/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.impuestos" });
  return { title: t("titulo") };
}

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export default async function PaginaImpuestos({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { locale } = await params;
  const { mes } = await searchParams;

  await requerirPermiso("contabilidad.leer");

  const [t, hoy, cuentas] = await Promise.all([
    getTranslations({ locale, namespace: "contab.impuestos" }),
    hoyEnLaBase(),
    cuentasConSaldo(),
  ]);

  const elegido = MES.test(mes ?? "") ? mes! : mesAnterior(hoy);
  const [anioStr, numeroMesStr] = elegido.split("-");
  const anio = Number(anioStr);
  const numeroMes = Number(numeroMesStr);
  const consulta = `anio=${anio}&mes=${numeroMes}`;

  const [calendario, resIt1, resIr17, resIsfl01, declaraciones] = await Promise.all([
    obtenerCalendarioFiscal(anio, numeroMes),
    calcularIt1(elegido),
    calcularIr17(elegido),
    calcularIsfl01(anio),
    listarDeclaraciones({ periodo: elegido }),
  ]);

  const formatos = [
    {
      clave: "f606",
      nombre: "Formato 606",
      descripcion: "Compras de Bienes y Servicios",
      txtHref: `/api/contabilidad/exportar/606-txt?${consulta}`,
      txtCeroHref: `/api/contabilidad/exportar/606-txt?${consulta}&enCero=1`,
      excelHref: `/api/contabilidad/exportar/606?${consulta}`,
      origen: "/contabilidad/proveedores",
    },
    {
      clave: "f607",
      nombre: "Formato 607",
      descripcion: "Ventas e Ingresos de Operaciones",
      txtHref: `/api/contabilidad/exportar/607-txt?${consulta}`,
      txtCeroHref: `/api/contabilidad/exportar/607-txt?${consulta}&enCero=1`,
      excelHref: `/api/contabilidad/exportar/607?${consulta}`,
      origen: "/contabilidad/donaciones",
    },
    {
      clave: "f608",
      nombre: "Formato 608",
      descripcion: "Comprobantes Fiscales Anulados",
      txtHref: `/api/contabilidad/exportar/608-txt?${consulta}`,
      txtCeroHref: `/api/contabilidad/exportar/608-txt?${consulta}&enCero=1`,
      excelHref: null,
      origen: "/contabilidad/asientos",
    },
    {
      clave: "f609",
      nombre: "Formato 609",
      descripcion: "Pagos por Servicios al Exterior",
      txtHref: `/api/contabilidad/exportar/609-txt?${consulta}`,
      txtCeroHref: `/api/contabilidad/exportar/609-txt?${consulta}&enCero=1`,
      excelHref: null,
      origen: "/contabilidad/proveedores",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 md:space-y-10 animate-entrada">
      <EncabezadoPagina
        titulo={t("titulo")}
      />

      {/* Selector de Mes */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mes">{t("mes")}</Label>
          <Input id="mes" name="mes" type="month" defaultValue={elegido} className="w-48" />
        </div>
        <Button type="submit" variant="outline">
          {t("cambiarMes")}
        </Button>
      </form>

      <Tabs defaultValue="formatos" className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md bg-muted p-1 dark:bg-slate-800 rounded-xl">
          <TabsTrigger value="formatos" className="text-xs">
            {t("formatosDgii")}
          </TabsTrigger>
          <TabsTrigger value="liquidaciones" className="text-xs">
            {t("liquidaciones")}
          </TabsTrigger>
          <TabsTrigger value="calendario" className="text-xs">
            {t("calendarioFiscal")}
          </TabsTrigger>
        </TabsList>

        {/* 1. FORMATOS TXT Y EXCEL */}
        <TabsContent value="formatos" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {formatos.map((formato) => (
              <div
                key={formato.clave}
                className={`${TARJETA.contenido} flex flex-col justify-between gap-4 p-5`}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className={TARJETA.icono}>
                      <FileCode className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-tinta dark:text-slate-100">
                        {formato.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">{formato.descripcion}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-linea pt-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm">
                      <a href={formato.txtHref} download>
                        <Download className="mr-1.5 size-3.5" />
                        {t("descargarTxt")}
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={formato.txtCeroHref} download>
                        {t("envioEnCero")}
                      </a>
                    </Button>
                    {formato.excelHref && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={formato.excelHref} download>
                          <FileSpreadsheet className="mr-1 size-3.5" />
                          {t("excel")}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sección Libros Contables Auxiliares */}
          <div className="space-y-4 pt-6 border-t border-linea dark:border-slate-800">
            <h3 className="text-base font-semibold text-tinta dark:text-slate-100">
              {t("libros")}
            </h3>
            <ul className={TARJETA.contenido}>
              <li className="flex min-h-11 flex-wrap items-center gap-3 border-b border-linea px-4 py-3 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-tinta">{t("cxp.nombre")}</span>
                  <span className="texto-meta block">{t("cxp.texto")}</span>
                </span>
                <Button asChild size="sm" variant="outline">
                  <a href="/api/contabilidad/exportar/cxp" download>
                    <Download className="size-4" />
                    {t("excel")}
                  </a>
                </Button>
              </li>
              {cuentas.map((cuenta) => (
                <li
                  key={cuenta.id}
                  className="flex min-h-11 flex-wrap items-center gap-3 border-b border-linea px-4 py-3 last:border-b-0"
                >
                  <Landmark className="size-4 shrink-0 text-tinta-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-tinta">
                      {t("libroBanco", { cuenta: cuenta.nombre })}
                    </span>
                    <span className="texto-meta block">{cuenta.moneda}</span>
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/contabilidad/exportar/bancos?cuentaId=${cuenta.id}`} download>
                      <Download className="size-4" />
                      {t("excel")}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        {/* 2. LIQUIDACIONES (IT-1, IR-17, ISFL-01) */}
        <TabsContent value="liquidaciones" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Tarjeta IT-1 */}
            <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-tinta dark:text-slate-100">IT-1 (ITBIS)</span>
                <Badge variant="outline">{elegido}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("exencionAsflLey122")}
              </p>
              <div className="space-y-1.5 text-xs divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground font-sans">{t("ingresosExentos")}:</span>
                  <span>RD$ {resIt1.ingresosExentosAsfl.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground font-sans">{t("itbisCompras")}:</span>
                  <span>RD$ {resIt1.itbisDeducibleCompras.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground font-sans">{t("itbisRetenido")}:</span>
                  <span className="font-bold text-marca-600 dark:text-marca-400">
                    RD$ {resIt1.itbisRetenidoProveedores.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta IR-17 */}
            <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-tinta dark:text-slate-100">IR-17 (Retenciones)</span>
                <Badge variant="outline">{elegido}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("retencionesProveedoresYHonorarios")}
              </p>
              <div className="space-y-1.5 text-xs divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground font-sans">{t("baseHonorarios")}:</span>
                  <span>RD$ {resIr17.baseServiciosHonorarios.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground font-sans">{t("isrRetenidoHonorarios")}:</span>
                  <span className="font-bold text-marca-600 dark:text-marca-400">
                    RD$ {resIr17.retencionHonorarios.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 font-sans font-semibold">
                  <span>{t("totalAPagarDgii")}:</span>
                  <span className="font-mono text-tinta font-bold">
                    RD$ {resIr17.totalRetenidoAPagar.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta ISFL-01 */}
            <div className="rounded-xl border border-linea bg-card p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-tinta dark:text-slate-100">ISFL-01 (Anual)</span>
                <Badge variant="outline">{anio}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("declaracionJuradaAsfl")}
              </p>
              <div className="space-y-1.5 text-xs divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground font-sans">{t("donacionesEfectivo")}:</span>
                  <span>RD$ {resIsfl01.donacionesEfectivoExentas.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground font-sans">{t("donacionesEspecie")}:</span>
                  <span>RD$ {resIsfl01.donacionesEspecieExentas.toLocaleString("es-DO", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1 font-sans font-semibold">
                  <span>{t("superavitSocial")}:</span>
                  <span className="font-mono text-marca-600 dark:text-marca-400">
                    RD$ {resIsfl01.superavitDeficit.toLocaleString("es-DO", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 3. CALENDARIO FISCAL */}
        <TabsContent value="calendario" className="space-y-4 mt-6">
          <div className="overflow-x-auto rounded-xl border border-linea bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-linea bg-muted text-xs font-medium text-muted-foreground uppercase tracking-wider dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("codigo")}</th>
                  <th className="px-4 py-3">{t("obligacion")}</th>
                  <th className="px-4 py-3">{t("vencimiento")}</th>
                  <th className="px-4 py-3">{t("diasRestantes")}</th>
                  <th className="px-4 py-3 text-right">{t("estado")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {calendario.map((ev) => (
                  <tr key={ev.codigo} className="hover:bg-muted/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono font-bold text-tinta dark:text-slate-100">
                      {ev.codigo}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-tinta dark:text-slate-100">{ev.nombre}</div>
                      <div className="text-xs text-muted-foreground">{ev.descripcion}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-tinta-2 dark:text-slate-400">
                      {ev.fechaVencimiento} (Día {ev.diaLimite})
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {ev.diasRestantes > 0 ? (
                        <span className="text-tinta-2 dark:text-slate-400">
                          {ev.diasRestantes} {t("dias")}
                        </span>
                      ) : (
                        <span className="font-semibold text-tinta">
                          {t("plazoCumplido")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ev.presentada ? (
                        <Badge className={INSIGNIA_SEMAFORO.dentro}>
                          <CheckCircle2 className="mr-1 size-3" />
                          {t("presentada")}
                        </Badge>
                      ) : ev.estadoVencimiento === "vencido" ? (
                        <Badge className={INSIGNIA_SEMAFORO.alerta}>
                          <AlertTriangle className="mr-1 size-3" />
                          {t("pendienteVencida")}
                        </Badge>
                      ) : ev.estadoVencimiento === "proximo" ? (
                        <Badge variant="outline" className="border-linea-fuerte bg-muted text-tinta">
                          {t("vencePronto")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("alDia")}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function mesAnterior(hoy: string): string {
  const [anio, mes] = hoy.split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}
