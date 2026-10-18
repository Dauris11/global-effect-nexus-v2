import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Archive,
  ArrowDownRight,
  Calculator,
  Coins,
  Receipt,
  User,
  Wallet,
} from "lucide-react";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requerirPermiso } from "@/lib/auth";
import { formatearMonto } from "@/lib/contabilidad/formato";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { listarCajas } from "@/server/contabilidad/cajas/consultas";
import { listarUsuariosSolicitantes } from "@/server/contabilidad/proveedores/consultas";
import { FormularioCaja } from "@/components/contabilidad/cajas/formulario-caja";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contab.cajas" });
  return { title: t("titulo") };
}

export default async function PaginaCajas({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requerirPermiso("contabilidad.leer");

  const [t, cajas, responsables] = await Promise.all([
    getTranslations({ locale, namespace: "contab.cajas" }),
    listarCajas(),
    listarUsuariosSolicitantes(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <EncabezadoPagina
        antetitulo="Contabilidad"
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
        acciones={<FormularioCaja responsables={responsables} />}
      />

      {cajas.length === 0 ? (
        <div className="rounded-tarjeta border border-dashed border-linea bg-background p-12 text-center space-y-3">
          <Wallet className="mx-auto size-12 text-tinta-2/50" />
          <h3 className="text-base font-semibold text-tinta">No hay cajas chicas registradas</h3>
          <p className="text-sm text-tinta-2 max-w-md mx-auto">
            Crea la primera caja chica para gestionar los gastos menores, vales provisionales
            y arqueos físicos de la Fundación.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cajas.map((caja) => {
            const saldoNum = parseFloat(caja.saldoActual);
            const fondoNum = parseFloat(caja.fondoFijo);
            const pct = Math.min(100, Math.round((saldoNum / fondoNum) * 100));

            return (
              <div
                key={caja.id}
                className="flex flex-col justify-between rounded-tarjeta border border-linea bg-background p-5 hover:border-marca/40 transition-colors shadow-sm"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-semibold text-marca-700 bg-marca-50 px-2 py-0.5 rounded">
                        {caja.codigo}
                      </span>
                      <h3 className="text-base font-semibold text-tinta mt-1.5 line-clamp-1">
                        {caja.nombre}
                      </h3>
                      <p className="text-xs text-tinta-2 capitalize">{caja.departamento}</p>
                    </div>
                    <Badge
                      className={
                        caja.estado === "activa"
                          ? INSIGNIA_SEMAFORO.dentro
                          : INSIGNIA_SEMAFORO.alerta
                      }
                    >
                      {caja.estado}
                    </Badge>
                  </div>

                  <div className="rounded-control bg-superficie/60 p-3 space-y-2 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="texto-meta">{t("saldoActual")}</span>
                      <span className="text-lg font-bold text-tinta">
                        {formatearMonto(caja.saldoActual, caja.moneda)}
                      </span>
                    </div>

                    {/* Barra de nivel de fondo */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-tinta-2">
                        <span>Fondo fijo: {formatearMonto(caja.fondoFijo, caja.moneda)}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-linea">
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

                    <div className="pt-1.5 flex items-center gap-1.5 text-tinta-2 border-t border-linea/60">
                      <User className="size-3.5 shrink-0" />
                      <span className="truncate">{caja.responsableNombre}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-linea flex items-center justify-between gap-2">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/contabilidad/cajas/${caja.id}`}>
                      <Receipt className="size-3.5" />
                      <span>Movimientos</span>
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/contabilidad/cajas/${caja.id}/arqueo`}>
                      <Calculator className="size-3.5" />
                      <span>Arqueo</span>
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
