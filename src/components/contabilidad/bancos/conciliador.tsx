"use client";

import { useActionState, useState } from "react";
import { Link2, Loader2, Unlink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AvisoError, AvisoOk, Monto } from "@/components/contabilidad/comun";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { numeroDocumento, type Moneda } from "@/lib/contabilidad/formato";
import { fechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { anularPartida, conciliarPartida, type EstadoBanco } from "@/server/contabilidad/bancos/acciones";
import type { LineaAsientoBanco, LineaExtracto } from "@/server/contabilidad/bancos/consultas";

const INICIAL: EstadoBanco = { estado: "inicial" };

function useError(estado: EstadoBanco): string | null {
  const t = useTranslations("contab");
  if (estado.estado === "inicial" || estado.estado === "ok") return null;
  return t(`error.${estado.estado}` as never);
}

/** Igualdad de montos para resaltar parejas; la que manda es la del servidor. */
const mismoMonto = (a: string, b: string) => Number(a).toFixed(2) === Number(b).toFixed(2);

/**
 * Conciliar (Observaciones #1): a la izquierda lo que trae el banco sin
 * pareja, a la derecha los asientos de la cuenta auxiliar sin pareja.
 * Al elegir una transacción del banco, los asientos del mismo monto suben
 * arriba y se marcan; se elige uno y se concilia. Son radios de un
 * formulario: el servidor recibe los dos ids y vuelve a comprobar todo.
 */
export function Conciliador({
  cuentaId,
  moneda,
  banco,
  libros,
}: {
  cuentaId: string;
  moneda: Moneda;
  banco: LineaExtracto[];
  libros: LineaAsientoBanco[];
}) {
  const t = useTranslations("contab.conciliacion");
  const idioma = useLocale() === "en" ? "en" : "es";
  const [extracto, setExtracto] = useState<string | null>(null);
  const [linea, setLinea] = useState<string | null>(null);
  const [estado, enviar, enviando] = useActionState(async (previo: EstadoBanco, datos: FormData) => {
    const resultado = await conciliarPartida(previo, datos);
    if (resultado.estado === "ok") {
      setExtracto(null);
      setLinea(null);
    }
    return resultado;
  }, INICIAL);
  const error = useError(estado);

  const elegido = banco.find((b) => b.id === extracto) ?? null;
  // Con una transacción elegida, primero los asientos del mismo monto.
  const ordenados = elegido
    ? [...libros].sort((a, b) => Number(mismoMonto(b.monto, elegido.monto)) - Number(mismoMonto(a.monto, elegido.monto)))
    : libros;
  const asiento = libros.find((l) => l.id === linea) ?? null;
  const listo = elegido !== null && asiento !== null && mismoMonto(elegido.monto, asiento.monto);

  const opcion = "flex min-h-11 cursor-pointer items-start gap-3 px-4 py-3 has-[:checked]:bg-marca-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="cuenta" value={cuentaId} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="texto-titulo-seccion">{t("delBanco", { n: banco.length })}</h2>
          {banco.length === 0 ? (
            <p className="texto-meta">{t("bancoVacio")}</p>
          ) : (
            <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card shadow-card">
              {banco.map((b) => (
                <li key={b.id}>
                  <label className={opcion}>
                    <input
                      type="radio"
                      name="extracto"
                      value={b.id}
                      checked={extracto === b.id}
                      onChange={() => {
                        setExtracto(b.id);
                        setLinea(null);
                      }}
                      className="mt-1 size-5 shrink-0 accent-marca-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-tinta">{b.descripcion}</span>
                      <span className="texto-meta block">
                        {fechaCorta(b.fecha, idioma)}
                        {b.referencia && ` · ${b.referencia}`}
                      </span>
                    </span>
                    <Monto valor={b.monto} moneda={moneda} conSigno className="font-medium" />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="texto-titulo-seccion">{t("deLibros", { n: libros.length })}</h2>
          {libros.length === 0 ? (
            <p className="texto-meta">{t("librosVacio")}</p>
          ) : (
            <ul className="divide-y divide-linea overflow-hidden rounded-card border border-linea bg-card shadow-card">
              {ordenados.map((l) => {
                const coincide = elegido !== null && mismoMonto(l.monto, elegido.monto);
                return (
                  <li key={l.id} className={cn(elegido && !coincide && "opacity-60")}>
                    <label className={opcion}>
                      <input
                        type="radio"
                        name="linea"
                        value={l.id}
                        checked={linea === l.id}
                        onChange={() => setLinea(l.id)}
                        className="mt-1 size-5 shrink-0 accent-marca-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-tinta">{l.concepto}</span>
                        <span className="texto-meta block">
                          {numeroDocumento("AS", l.numero)} · {fechaCorta(l.fecha, idioma)}
                        </span>
                        {coincide && (
                          <Badge variant="marca" className="mt-1">
                            {t("mismoMonto")}
                          </Badge>
                        )}
                      </span>
                      <Monto valor={l.monto} moneda={moneda} conSigno className="font-medium" />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {error && <AvisoError>{error}</AvisoError>}
      {estado.estado === "ok" && <AvisoOk>{t("conciliadaOk")}</AvisoOk>}
      {elegido && asiento && !listo && <p className="texto-meta">{t("montosDistintos")}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={!listo || enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          {t("conciliar")}
        </Button>
      </div>
    </form>
  );
}

/** Anular una conciliación, con confirmación para que no sea un clic al pasar. */
export function BotonAnularPartida({ id }: { id: string }) {
  const t = useTranslations("contab.conciliacion");
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, enviando] = useActionState(async (previo: EstadoBanco, datos: FormData) => {
    const resultado = await anularPartida(previo, datos);
    if (resultado.estado === "ok") setAbierto(false);
    return resultado;
  }, INICIAL);
  const error = useError(estado);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Unlink className="size-4" />
          {t("anular")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("anularTitulo")}</DialogTitle>
          <DialogDescription>{t("anularTexto")}</DialogDescription>
        </DialogHeader>
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          {error && <AvisoError>{error}</AvisoError>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={enviando}>
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
              {t("anularConfirmar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
