"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIAS,
  montoUsd,
  TIPOS_MOVIMIENTO,
  type TipoTransaccion,
} from "@/lib/finanzas";
import { ALERTA_RIESGO, ANIMACION, MOVIMIENTO, VACIO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  eliminarTransaccion,
  guardarTransaccion,
  type EstadoTransaccion,
} from "@/server/finanzas/acciones";
import type { Movimiento } from "@/server/finanzas/consultas";

/** Clase del desplegable nativo, la misma del resto del proyecto. */
const SELECT =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-white px-2 text-base shadow-xs outline-none focus-visible:ring-[3px] sm:text-sm";

/**
 * Movimientos de la contabilidad: tabla, alta, corrección y borrado.
 *
 * NI VERDE NI ROJO, que es lo primero que pide un módulo de contabilidad y lo
 * primero que este no hace. Lo que entra va en el azul de la marca y lo que
 * sale en negro, tal como fija `MOVIMIENTO` en `paleta.ts`, y **el signo va
 * escrito delante del monto**: es la única señal que sobrevive en una hoja
 * impresa en blanco y negro, que es como se revisa un balance.
 *
 * La flecha del icono acompaña al signo por lo mismo. Con color, signo y
 * dirección, un ingreso y un egreso se distinguen aunque falle cualquiera de
 * las tres.
 *
 * En pantalla ancha es una tabla y en móvil son tarjetas. No es un adorno: una
 * tabla de seis columnas en 360 px obliga a desplazar en horizontal para llegar
 * al monto, que es la columna que se viene a leer.
 */
export function GestionTransacciones({
  movimientos,
  puedeEscribir,
  hayMas,
  hayFiltro,
}: {
  movimientos: readonly Movimiento[];
  puedeEscribir: boolean;
  hayMas: boolean;
  hayFiltro: boolean;
}) {
  const t = useTranslations("finance");
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

      {movimientos.length === 0 ? (
        <Card>
          <CardContent className={VACIO.contenedor}>
            <span className={VACIO.icono}>
              <Wallet className="size-6" />
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
          {/* Tabla, solo en pantalla ancha. */}
          <Card className="hidden md:block">
            <CardContent className="pt-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs">
                      <th className="pb-2 font-medium">{t("field.concept")}</th>
                      <th className="pb-2 font-medium">
                        {t("field.category")}
                      </th>
                      <th className="pb-2 font-medium">{t("field.date")}</th>
                      <th className="pb-2 text-right font-medium">
                        {t("field.amount")}
                      </th>
                      {puedeEscribir && <th className="pb-2" />}
                    </tr>
                  </thead>

                  <tbody>
                    {movimientos.map((fila) => (
                      <Fila
                        key={fila.id}
                        fila={fila}
                        puedeEscribir={puedeEscribir}
                        editando={editando === fila.id}
                        alEditar={() => setEditando(fila.id)}
                        alTerminar={() => setEditando(null)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Tarjetas, solo en móvil. */}
          <div className="space-y-3 md:hidden">
            {movimientos.map((fila) => (
              <Card key={fila.id} className="group">
                <CardContent className="pt-5">
                  {editando === fila.id ? (
                    <Formulario
                      movimiento={fila}
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

/** Una fila de la tabla; si se está editando, el formulario ocupa toda la fila. */
function Fila({
  fila,
  puedeEscribir,
  editando,
  alEditar,
  alTerminar,
}: {
  fila: Movimiento;
  puedeEscribir: boolean;
  editando: boolean;
  alEditar: () => void;
  alTerminar: () => void;
}) {
  const t = useTranslations("finance");

  if (editando) {
    return (
      <tr>
        <td colSpan={puedeEscribir ? 5 : 4} className="py-3">
          <Formulario movimiento={fila} alTerminar={alTerminar} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-muted/40 border-b transition-colors last:border-0">
      <td className="py-2.5 pr-3">
        <p className="font-medium">{fila.concepto}</p>
        {fila.referencia && (
          <p className="text-muted-foreground text-xs">{fila.referencia}</p>
        )}
      </td>

      <td className="py-2.5 pr-3">
        <Badge variant="secondary" className="text-[10px]">
          {t(`category.${fila.categoria}` as never)}
        </Badge>
      </td>

      <td className="text-muted-foreground py-2.5 pr-3 text-xs whitespace-nowrap">
        {fila.fecha}
      </td>

      <td className="py-2.5 text-right whitespace-nowrap">
        <Monto tipo={fila.tipo} monto={fila.monto} />
      </td>

      {puedeEscribir && (
        <td className="py-2.5 pl-2 text-right whitespace-nowrap">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={alEditar}
            title={t("edit")}
            aria-label={t("edit")}
            className="size-8"
          >
            <Pencil className="size-3.5" />
          </Button>

          <DialogoBorrado fila={fila} />
        </td>
      )}
    </tr>
  );
}

/** El mismo movimiento, en tarjeta, para móvil. */
function Ficha({
  fila,
  puedeEscribir,
  alEditar,
}: {
  fila: Movimiento;
  puedeEscribir: boolean;
  alEditar: () => void;
}) {
  const t = useTranslations("finance");

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words">{fila.concepto}</p>
          <p className="text-muted-foreground text-xs">
            {t(`category.${fila.categoria}` as never)} · {fila.fecha}
          </p>
        </div>

        <Monto tipo={fila.tipo} monto={fila.monto} />
      </div>

      {fila.referencia && (
        <p className="text-muted-foreground text-xs">{fila.referencia}</p>
      )}

      {puedeEscribir && (
        <div className="flex items-center gap-1 border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={alEditar}
            className="transition-transform duration-150 active:scale-95"
          >
            <Pencil className="size-3.5" />
            {t("edit")}
          </Button>

          <DialogoBorrado fila={fila} />
        </div>
      )}
    </div>
  );
}

/**
 * El monto, con su signo, su color y su flecha.
 *
 * `tipo` llega de la base como TEXT y se comprueba: una fila con un tipo que no
 * sea ninguno de los dos se pinta como egreso —el peso más alto— en vez de
 * romper la pantalla buscando una clave que no existe.
 */
function Monto({ tipo, monto }: { tipo: string; monto: number }) {
  const entra = tipo === "ingreso";
  const estilo = MOVIMIENTO[entra ? "ingreso" : "egreso"];
  const Flecha = entra ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-bold tabular-nums",
        estilo.texto,
      )}
    >
      <Flecha className="size-3.5 shrink-0" />
      {estilo.signo}
      {montoUsd(monto)}
    </span>
  );
}

/**
 * Borrado con confirmación.
 *
 * Se pregunta antes porque un movimiento no se puede recuperar desde la
 * pantalla: la acción lo guarda en `audit_log`, pero eso solo se lee por SQL.
 * El diálogo dice el concepto y el monto, que es lo que permite darse cuenta de
 * que se está a punto de borrar la fila equivocada.
 */
function DialogoBorrado({ fila }: { fila: Movimiento }) {
  const t = useTranslations("finance");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState<
    EstadoTransaccion,
    FormData
  >(
    async (previo, datos) => {
      const resultado = await eliminarTransaccion(previo, datos);
      if (resultado.estado === "ok") setAbierto(false);
      return resultado;
    },
    { estado: "inicial" },
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setAbierto(true)}
        title={t("delete")}
        aria-label={t("delete")}
        className="size-8"
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("form.deleteTitle", { concept: fila.concepto })}
            </DialogTitle>
            <DialogDescription>
              {t("form.deleteWarning", { amount: montoUsd(fila.monto) })}
            </DialogDescription>
          </DialogHeader>

          {estado.estado !== "inicial" && estado.estado !== "ok" && (
            <p role="alert" className={ALERTA_RIESGO.contenedor}>
              <AlertCircle className={ALERTA_RIESGO.icono} />
              <span className={ALERTA_RIESGO.texto}>{t("form.error")}</span>
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAbierto(false)}
            >
              {t("form.cancel")}
            </Button>

            <form action={enviar}>
              <input type="hidden" name="id" value={fila.id} />
              <Button type="submit" variant="destructive" disabled={enviando}>
                {enviando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {enviando ? t("form.deleting") : t("delete")}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Alta y corrección. Sin `movimiento`, es un alta. */
function Formulario({
  movimiento,
  alTerminar,
}: {
  movimiento?: Movimiento;
  alTerminar: () => void;
}) {
  const t = useTranslations("finance");
  const [estado, enviar, enviando] = useActionState<
    EstadoTransaccion,
    FormData
  >(
    async (previo, datos) => {
      const resultado = await guardarTransaccion(previo, datos);
      if (resultado.estado === "ok") alTerminar();
      return resultado;
    },
    { estado: "inicial" },
  );

  const clave = movimiento?.id ?? "nuevo";
  const tipoPuesto = (movimiento?.tipo ?? "ingreso") as TipoTransaccion;

  return (
    <form action={enviar} className="space-y-3">
      <div>
        <p className="text-sm font-semibold">
          {movimiento ? t("form.editTitle") : t("form.newTitle")}
        </p>
        <p className="text-muted-foreground text-xs">
          {movimiento ? t("form.editSubtitle") : t("form.newSubtitle")}
        </p>
      </div>

      <input type="hidden" name="id" value={movimiento?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`f-concepto-${clave}`}>{t("field.concept")}</Label>
          <Input
            id={`f-concepto-${clave}`}
            name="concepto"
            defaultValue={movimiento?.concepto}
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`f-tipo-${clave}`}>{t("field.type")}</Label>
          <select
            id={`f-tipo-${clave}`}
            name="tipo"
            defaultValue={tipoPuesto}
            className={SELECT}
          >
            {TIPOS_MOVIMIENTO.map((valor) => (
              <option key={valor} value={valor}>
                {t(`type.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`f-monto-${clave}`}>{t("field.amount")}</Label>
          {/* `min` es 0.01 y no 0: el CHECK de la tabla exige monto > 0,
              porque el signo lo lleva el tipo del movimiento. */}
          <Input
            id={`f-monto-${clave}`}
            name="monto"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={movimiento?.monto ?? ""}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`f-categoria-${clave}`}>{t("field.category")}</Label>
          <select
            id={`f-categoria-${clave}`}
            name="categoria"
            defaultValue={movimiento?.categoria ?? "otro"}
            className={SELECT}
          >
            {CATEGORIAS.map((valor) => (
              <option key={valor} value={valor}>
                {t(`category.${valor}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`f-fecha-${clave}`}>{t("field.date")}</Label>
          <Input
            id={`f-fecha-${clave}`}
            name="fecha"
            type="date"
            defaultValue={movimiento?.fecha ?? ""}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`f-ref-${clave}`}>{t("field.reference")}</Label>
          <Input
            id={`f-ref-${clave}`}
            name="referencia"
            defaultValue={movimiento?.referencia ?? ""}
            maxLength={120}
            placeholder={t("field.referenceHint")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`f-notas-${clave}`}>{t("field.notes")}</Label>
        <Textarea
          id={`f-notas-${clave}`}
          name="notas"
          defaultValue={movimiento?.notas ?? ""}
          maxLength={900}
          rows={2}
        />
      </div>

      {estado.estado !== "inicial" && estado.estado !== "ok" && (
        <p role="alert" className={ALERTA_RIESGO.contenedor}>
          <AlertCircle className={ALERTA_RIESGO.icono} />
          <span className={ALERTA_RIESGO.texto}>
            {estado.estado === "concepto_vacio"
              ? t("form.conceptRequired")
              : estado.estado === "monto_invalido"
                ? t("form.amountInvalid")
                : estado.estado === "fecha_invalida"
                  ? t("form.dateInvalid")
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
            ? movimiento
              ? t("form.saving")
              : t("form.creating")
            : movimiento
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
