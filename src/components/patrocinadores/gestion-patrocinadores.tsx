"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  Building2,
  HandCoins,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALERTA_RIESGO, ANIMACION, CUADRO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  type EstadoPatrocinador,
  guardarPatrocinador,
} from "@/server/patrocinadores/acciones";
import type { PatrocinadorFila } from "@/server/patrocinadores/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

const TIPOS = ["persona", "empresa", "iglesia", "ong", "otro"] as const;

/**
 * Directorio de patrocinadores.
 *
 * DINERO EN AZUL, NUNCA EN VERDE. `MOVIMIENTO.ingreso` de `paleta.ts` ya fija
 * que lo que entra va en el azul de la marca; aquí se sigue esa misma regla
 * aunque no sea una transacción contable, porque para quien mira es la misma
 * clase de cifra.
 *
 * No hay botón de borrar: retirar a un patrocinador es marcarlo `inactivo`.
 * Borrarlo dejaría a sus becados sin origen de fondos (`patrocinador_id` cae a
 * NULL) y se llevaría por delante el historial de aportes
 * (`asignacion_beca` va en cascada). El formulario lo dice en su subtítulo.
 */
export function GestionPatrocinadores({
  patrocinadores,
  puedeEscribir,
  hayMas,
  hayFiltro,
}: {
  patrocinadores: readonly PatrocinadorFila[];
  puedeEscribir: boolean;
  hayMas: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("sponsors");
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className={cn("space-y-4", ANIMACION.entrada)}>
      {puedeEscribir && editando !== "nuevo" && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setEditando("nuevo")}
            className="transition-transform duration-150 active:scale-95"
          >
            <Plus className="size-3.5" />
            {t("new")}
          </Button>
        </div>
      )}

      {editando === "nuevo" && (
        <Card>
          <CardContent className="pt-5">
            <Formulario alTerminar={() => setEditando(null)} />
          </CardContent>
        </Card>
      )}

      {patrocinadores.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <HandCoins className="size-6" />
            </span>
            <p className={VACIO.titulo}>
              {hayFiltro ? t("noMatches") : t("empty")}
            </p>
            <p className={VACIO.descripcion}>
              {hayFiltro ? t("noMatchesHint") : t("emptyHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {patrocinadores.map((fila) => (
              <Card key={fila.id} className="group">
                <CardContent className="pt-5">
                  {editando === fila.id ? (
                    <Formulario
                      patrocinador={fila}
                      alTerminar={() => setEditando(null)}
                    />
                  ) : (
                    <Ficha
                      fila={fila}
                      puedeEscribir={puedeEscribir}
                      alEditar={() => setEditando(fila.id)}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {hayMas && (
            <p className="text-muted-foreground text-center text-xs">
              {t("limitHint")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Un patrocinador: quién es, cómo se le escribe y cuánto aporta. */
function Ficha({
  fila,
  puedeEscribir,
  alEditar,
}: {
  fila: PatrocinadorFila;
  puedeEscribir: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("sponsors");

  const activo = fila.estado === "activo";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110",
            activo ? CUADRO.marca : CUADRO.neutro,
          )}
        >
          <Building2 className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          {/* `break-words` y no `truncate`: el nombre de una organización es lo
              que se viene a leer, y cortarlo a la mitad obliga a abrir la ficha
              para saber de quién se habla. */}
          <p className="text-sm font-semibold break-words">{fila.nombre}</p>
          <p className="text-muted-foreground text-xs">
            {t(`type.${fila.tipo}` as never)}
            {fila.pais ? ` · ${fila.pais}` : ""}
          </p>
        </div>

        <Badge
          className={cn(
            "shrink-0 text-[10px]",
            activo
              ? "bg-[#2096BA]/15 text-[#187a99]"
              : "bg-muted text-tinta-2",
          )}
        >
          {t(`state.${fila.estado}` as never)}
        </Badge>

        {puedeEscribir && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEditar}
            title={t("edit")}
            aria-label={t("edit")}
            className="size-8 shrink-0"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {fila.email && (
          <a
            href={`mailto:${fila.email}`}
            className="inline-flex min-h-8 items-center gap-1 hover:text-[#187a99] hover:underline"
          >
            <Mail className="size-3 shrink-0" />
            {fila.email}
          </a>
        )}

        {fila.telefono && (
          <a
            href={`tel:${fila.telefono}`}
            className="inline-flex min-h-8 items-center gap-1 hover:text-[#187a99] hover:underline"
          >
            <Phone className="size-3 shrink-0" />
            {fila.telefono}
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        {/* El aporte en el azul de la marca: es lo que entra, y `MOVIMIENTO`
            ya fija que lo que entra va en azul y nunca en verde. */}
        <p className="text-sm font-bold text-[#2096BA]">
          {t("perMonth", { monto: formatoUsd(fila.monto_mensual) })}
        </p>

        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Users className="size-3 shrink-0" />
          {t("scholars", { count: fila.becados })}
        </span>
      </div>
    </div>
  );
}

/** Alta y edición. Sin `patrocinador`, es un alta. */
function Formulario({
  patrocinador,
  alTerminar,
}: {
  patrocinador?: PatrocinadorFila;
  alTerminar: () => void;
}) {
  const t = useTranslations("sponsors");
  const [estado, enviar, enviando] = useActionState<
    EstadoPatrocinador,
    FormData
  >(
    async (previo, datos) => {
      const resultado = await guardarPatrocinador(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = patrocinador?.id ?? "nuevo";

  return (
    <form action={enviar} className="space-y-3">
      <div>
        <p className="text-sm font-semibold">
          {patrocinador ? t("form.editTitle") : t("form.newTitle")}
        </p>
        <p className="text-muted-foreground text-xs">
          {patrocinador ? t("form.editSubtitle") : t("form.newSubtitle")}
        </p>
      </div>

      <input type="hidden" name="id" value={patrocinador?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`s-nombre-${clave}`}>{t("field.name")}</Label>
          <Input
            id={`s-nombre-${clave}`}
            name="nombre"
            defaultValue={patrocinador?.nombre}
            required
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-tipo-${clave}`}>{t("field.type")}</Label>
          <select
            id={`s-tipo-${clave}`}
            name="tipo"
            defaultValue={patrocinador?.tipo ?? "persona"}
            className={SELECT}
          >
            {TIPOS.map((valor) => (
              <option key={valor} value={valor}>
                {t(`type.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-estado-${clave}`}>{t("field.state")}</Label>
          <select
            id={`s-estado-${clave}`}
            name="estado"
            defaultValue={patrocinador?.estado ?? "activo"}
            className={SELECT}
          >
            {(["activo", "inactivo"] as const).map((valor) => (
              <option key={valor} value={valor}>
                {t(`state.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-email-${clave}`}>{t("field.email")}</Label>
          <Input
            id={`s-email-${clave}`}
            name="email"
            type="email"
            defaultValue={patrocinador?.email ?? ""}
            maxLength={160}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-tel-${clave}`}>{t("field.phone")}</Label>
          <Input
            id={`s-tel-${clave}`}
            name="telefono"
            type="tel"
            defaultValue={patrocinador?.telefono ?? ""}
            maxLength={40}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-pais-${clave}`}>{t("field.country")}</Label>
          <Input
            id={`s-pais-${clave}`}
            name="pais"
            defaultValue={patrocinador?.pais ?? ""}
            maxLength={80}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`s-monto-${clave}`}>{t("field.monthly")}</Label>
          <Input
            id={`s-monto-${clave}`}
            name="monto"
            type="number"
            min={0}
            step="0.01"
            defaultValue={patrocinador?.monto_mensual ?? 0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`s-notas-${clave}`}>{t("field.notes")}</Label>
        <Textarea
          id={`s-notas-${clave}`}
          name="notas"
          defaultValue={patrocinador?.notas ?? ""}
          maxLength={900}
          rows={2}
        />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "nombre_vacio"
              ? t("form.nameRequired")
              : estado.estado === "monto_invalido"
                ? t("form.amountInvalid")
                : t("form.error")}
          </span>
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={enviando}
          className="transition-transform duration-150 active:scale-95"
        >
          {enviando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {enviando
            ? patrocinador
              ? t("form.saving")
              : t("form.creating")
            : patrocinador
              ? t("form.save")
              : t("form.create")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={alTerminar}>
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Dinero en USD, con dos decimales siempre.
 *
 * `Intl.NumberFormat` con `en-US` fijo y no con el idioma de la interfaz: el
 * monto es en dólares y el símbolo tiene que ser el mismo en las dos versiones
 * del sitio. Un "US$ 250,00" en la versión española y un "$250.00" en la
 * inglesa serían la misma cifra escrita de dos formas.
 */
function formatoUsd(valor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(valor);
}
