"use client";

import { useActionState } from "react";
import { Info, Loader2, Save } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { SELECT } from "@/components/contabilidad/comun";
import { AvisoEstado, ESTADO_INICIAL } from "@/components/contabilidad/configuracion/aviso-estado";
import { Button } from "@/components/ui/button";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TARJETA } from "@/lib/paleta";
import { guardarEntidad } from "@/server/contabilidad/configuracion/acciones";
import type { Entidad } from "@/server/contabilidad/configuracion/consultas";

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

function Campo({
  id,
  etiqueta,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </Label>
      {children}
      {ayuda && <p className="texto-meta">{ayuda}</p>}
    </div>
  );
}

/**
 * Los datos de la Fundación. Sin permiso de configurar se ven igual pero
 * el `fieldset` va deshabilitado y no hay botón: lo que se lee es lo mismo
 * que sale en los formatos de la DGII.
 */
export function SeccionEntidad({ entidad, puedeEditar }: { entidad: Entidad; puedeEditar: boolean }) {
  const t = useTranslations("contab.config.entidad");
  const formato = useFormatter();
  const [estado, enviar, enviando] = useActionState(guardarEntidad, ESTADO_INICIAL);

  const nombreMes = (mes: number) =>
    formato.dateTime(new Date(Date.UTC(2026, mes - 1, 1)), { month: "long", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <form action={enviar} className={`${TARJETA.contenido} space-y-6 p-5 md:p-6`}>
        {/* El selector de modo y Anterior/Siguiente quedan fuera del
            `fieldset`: sin permiso de editar se puede seguir recorriendo. */}
        <FormularioGuiado className="space-y-6">
          <fieldset disabled={!puedeEditar || enviando} className="space-y-6">
            <legend className="sr-only">{t("titulo")}</legend>
            <PasoFormulario titulo={t("pasos.identidad")}>
              <div className="grid gap-5 md:grid-cols-2">
                <Campo id="razon_social" etiqueta={t("razonSocial")}>
                  <Input id="razon_social" name="razon_social" required maxLength={200} defaultValue={entidad.razonSocial} />
                </Campo>
                <Campo id="nombre_comercial" etiqueta={t("nombreComercial")}>
                  <Input id="nombre_comercial" name="nombre_comercial" maxLength={200} defaultValue={entidad.nombreComercial ?? ""} />
                </Campo>
                <Campo id="rnc" etiqueta={t("rnc")} ayuda={t("rncAyuda")}>
                  <Input
                    id="rnc"
                    name="rnc"
                    inputMode="numeric"
                    maxLength={11}
                    pattern="[0-9\-]{9,11}"
                    defaultValue={entidad.rnc ?? ""}
                  />
                </Campo>
              </div>
            </PasoFormulario>
            <PasoFormulario titulo={t("pasos.ejercicio")}>
              <div className="grid gap-5 md:grid-cols-2">
                <Campo id="inicio_ejercicio_mes" etiqueta={t("inicioEjercicio")} ayuda={t("inicioEjercicioAyuda")}>
                  <select
                    id="inicio_ejercicio_mes"
                    name="inicio_ejercicio_mes"
                    defaultValue={String(entidad.inicioEjercicioMes)}
                    className={`${SELECT} h-12 capitalize`}
                  >
                    {MESES.map((mes) => (
                      <option key={mes} value={mes}>
                        {nombreMes(mes)}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo id="decimales" etiqueta={t("decimales")} ayuda={t("decimalesAyuda")}>
                  <select id="decimales" name="decimales" defaultValue={String(entidad.decimales)} className={`${SELECT} h-12`}>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            </PasoFormulario>
            <PasoFormulario titulo={t("pasos.contacto")}>
              <div className="grid gap-5 md:grid-cols-2">
                <Campo id="telefono" etiqueta={t("telefono")}>
                  <Input id="telefono" name="telefono" type="tel" maxLength={25} defaultValue={entidad.telefono ?? ""} />
                </Campo>
                <Campo id="email" etiqueta={t("email")}>
                  <Input id="email" name="email" type="email" maxLength={160} defaultValue={entidad.email ?? ""} />
                </Campo>
                <div className="md:col-span-2">
                  <Campo id="direccion" etiqueta={t("direccion")}>
                    <Input id="direccion" name="direccion" maxLength={300} defaultValue={entidad.direccion ?? ""} />
                  </Campo>
                </div>
              </div>
            </PasoFormulario>
          </fieldset>

          <div className="flex flex-col gap-3 border-t border-linea pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="texto-meta">
              {entidad.actualizadoPor
                ? t("actualizado", { quien: entidad.actualizadoPor, cuando: entidad.actualizadoEn })
                : t("monedaBase")}
            </p>
            {/* Va siempre, aunque no se pueda guardar: quien solo consulta
                también necesita Anterior/Siguiente en modo guiado. Sin borde
                propio porque esta fila ya trae el suyo. */}
            <AccionesFormulario className="border-t-0 pt-0">
              {puedeEditar && (
                <Button type="submit" disabled={enviando}>
                  {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t("guardar")}
                </Button>
              )}
            </AccionesFormulario>
          </div>
        </FormularioGuiado>
        <AvisoEstado estado={estado} mostrarOk />
      </form>

      {/* Solo informa: la bandera no tiene interruptor porque encenderla
          exige un facturador homologado que la Fundación no tiene. */}
      <div className="flex items-start gap-3 rounded-card bg-marca-50 p-4 text-marca-700">
        <Info className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {entidad.emisionHabilitada ? t("emisionSi") : t("emisionNo")}
          </p>
          <p className="text-sm">{t("emisionTexto")}</p>
        </div>
      </div>
    </div>
  );
}
