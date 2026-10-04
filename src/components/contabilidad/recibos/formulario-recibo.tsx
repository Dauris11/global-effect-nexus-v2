"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { AvisoError, SELECT } from "@/components/contabilidad/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { FORMAS_PAGO, TIPOS_RECIBO, type TipoRecibo } from "@/lib/contabilidad/formato";
import { guardarRecibo, type EstadoRecibo } from "@/server/contabilidad/recibos/acciones";
import type { DetalleRecibo, OpcionesRecibo } from "@/server/contabilidad/recibos/consultas";

/**
 * Alta y corrección de un borrador.
 *
 * La moneda no se elige: sale de la cuenta, y el servidor la vuelve a
 * tomar de la cuenta. El campo de tasa solo aparece con una cuenta en
 * dólares. Patrocinador o beneficiario según el tipo: lo mismo que hace
 * el servidor, que ignora el que no toca.
 *
 * El tipo no se puede cambiar al editar: el número ya se tomó de su serie
 * (RI o CE) y pasarlo a la otra dejaría un hueco en ambas.
 */
export function FormularioRecibo({
  opciones,
  recibo,
  hoy,
}: {
  opciones: OpcionesRecibo;
  recibo?: DetalleRecibo;
  hoy: string;
}) {
  const t = useTranslations("contab");
  const router = useRouter();
  const [estado, enviar, enviando] = useActionState<EstadoRecibo, FormData>(guardarRecibo, {
    estado: "inicial",
  });
  const [tipo, setTipo] = useState<TipoRecibo>(recibo?.tipo ?? "ingreso");
  const [cuentaId, setCuentaId] = useState(recibo?.cuenta_id ?? opciones.cuentas[0]?.id ?? "");
  const moneda = opciones.cuentas.find((c) => c.id === cuentaId)?.moneda ?? "DOP";
  const categorias = opciones.categorias.filter((c) => c.tipo === tipo || c.tipo === "ambos");

  useEffect(() => {
    if (estado.estado === "ok" && estado.id) router.push(`/contabilidad/recibos/${estado.id}`);
  }, [estado, router]);

  const error =
    estado.estado === "inicial" || estado.estado === "ok" ? null : t(`error.${estado.estado}`);

  return (
    <form action={enviar} className="space-y-6">
      {recibo && <input type="hidden" name="id" value={recibo.id} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta={t("formulario.tipo")} id="tipo">
          <select
            id="tipo"
            name="tipo"
            className={SELECT}
            value={tipo}
            disabled={Boolean(recibo)}
            onChange={(e) => setTipo(e.target.value as TipoRecibo)}
          >
            {TIPOS_RECIBO.map((valor) => (
              <option key={valor} value={valor}>
                {t(`tipo.${valor}`)}
              </option>
            ))}
          </select>
          {/* Un select deshabilitado no se envía; el tipo viaja igual. */}
          {recibo && <input type="hidden" name="tipo" value={tipo} />}
        </Campo>

        <Campo etiqueta={t("formulario.fecha")} id="fecha">
          <Input id="fecha" name="fecha" type="date" required defaultValue={recibo?.fecha ?? hoy} />
        </Campo>

        <Campo etiqueta={t("formulario.cuenta")} id="cuenta" ayuda={t("formulario.moneda", { moneda })}>
          <select
            id="cuenta"
            name="cuenta"
            className={SELECT}
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            required
          >
            {opciones.cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta={t("formulario.monto")} id="monto">
          <Input
            id="monto"
            name="monto"
            inputMode="decimal"
            required
            placeholder="0.00"
            defaultValue={recibo?.monto ?? ""}
          />
        </Campo>

        {moneda === "USD" && (
          <Campo etiqueta={t("formulario.tasa")} id="tasa">
            <Input id="tasa" name="tasa" inputMode="decimal" required defaultValue={recibo?.tasa ?? ""} />
          </Campo>
        )}

        <Campo etiqueta={t("formulario.formaPago")} id="forma_pago">
          <select
            id="forma_pago"
            name="forma_pago"
            className={SELECT}
            defaultValue={recibo?.forma_pago ?? "transferencia"}
          >
            {FORMAS_PAGO.map((valor) => (
              <option key={valor} value={valor}>
                {t(`formaPago.${valor}`)}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta={t("formulario.concepto")} id="concepto">
        <Input id="concepto" name="concepto" required maxLength={200} defaultValue={recibo?.concepto ?? ""} />
      </Campo>

      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta={t("formulario.categoria")} id="categoria">
          <select
            key={tipo}
            id="categoria"
            name="categoria"
            className={SELECT}
            defaultValue={recibo?.categoria_id ?? ""}
            required
          >
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta={t("formulario.fondo")} id="fondo">
          <select id="fondo" name="fondo" className={SELECT} defaultValue={recibo?.fondo_id ?? ""} required>
            {opciones.fondos.map((fondo) => (
              <option key={fondo.id} value={fondo.id}>
                {fondo.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta={t("formulario.proyecto")} id="proyecto">
          <select id="proyecto" name="proyecto" className={SELECT} defaultValue={recibo?.proyecto_id ?? ""}>
            <option value="">{t("formulario.ninguno")}</option>
            {opciones.proyectos.map((proyecto) => (
              <option key={proyecto.id} value={proyecto.id}>
                {proyecto.nombre}
              </option>
            ))}
          </select>
        </Campo>

        {tipo === "ingreso" ? (
          <Campo etiqueta={t("formulario.patrocinador")} id="patrocinador">
            <select
              id="patrocinador"
              name="patrocinador"
              className={SELECT}
              defaultValue={recibo?.patrocinador_id ?? ""}
            >
              <option value="">{t("formulario.ninguno")}</option>
              {opciones.patrocinadores.map((patrocinador) => (
                <option key={patrocinador.id} value={patrocinador.id}>
                  {patrocinador.nombre}
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          <Campo etiqueta={t("formulario.beneficiario")} id="beneficiario">
            <Input id="beneficiario" name="beneficiario" maxLength={160} defaultValue={recibo?.beneficiario ?? ""} />
          </Campo>
        )}

        <Campo etiqueta={t("formulario.referencia")} id="referencia" ayuda={t("formulario.referenciaAyuda")}>
          <Input id="referencia" name="referencia" maxLength={120} defaultValue={recibo?.referencia ?? ""} />
        </Campo>
      </div>

      <Campo etiqueta={t("formulario.notas")} id="notas">
        <Textarea id="notas" name="notas" rows={3} maxLength={900} defaultValue={recibo?.notas ?? ""} />
      </Campo>

      {error && <AvisoError>{error}</AvisoError>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("formulario.guardar")}
        </Button>
        <Button asChild variant="ghost">
          <Link href={recibo ? `/contabilidad/recibos/${recibo.id}` : "/contabilidad/recibos"}>
            {t("formulario.cancelar")}
          </Link>
        </Button>
      </div>
    </form>
  );
}

function Campo({
  etiqueta,
  id,
  ayuda,
  children,
}: {
  etiqueta: string;
  id: string;
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
