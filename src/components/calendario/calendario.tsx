"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

import { CalendarioBase } from "@/components/ui/calendario-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ORIGEN_VISUAL,
  type Entrada,
  type EventoCalendario,
  type OrigenCalendario,
  type VistaCalendario,
} from "@/lib/calendario";
import { moverEntrada } from "@/server/calendario/acciones";

import { DialogoAlta, DialogoEntrada, TIPOS_EVENTO } from "./dialogo-entrada";
import { FiltroMenu, FiltroPuesto } from "./filtros-calendario";

const ORIGENES: readonly Entrada["origen"][] = [
  "evento",
  "tarea",
  "asignacion",
  "cita",
  "reunion",
  "clase",
];

/**
 * Calendario interno (`/calendario`): el calendario base más lo propio de esta
 * pantalla —buscador, filtros por origen y por tipo, alta de evento, detalle y
 * mover arrastrando—.
 *
 * El mes y la vista viven en la URL —`?mes=2026-08&vista=semana`— para que la
 * pantalla se pueda enlazar y recargar sin perder dónde estabas. Cambiar la URL
 * es cosa del router, que solo existe en el cliente.
 *
 * `router.replace` y no `push`: pasar de agosto a septiembre no es un paso del
 * historial, y con `push` el botón "atrás" tendría que recorrer mes a mes todo
 * lo que la persona haya mirado.
 *
 * Qué se puede arrastrar lo dice cada entrada (`editable`, calculado en el
 * servidor); `moverEntrada` vuelve a comprobar el permiso antes de escribir.
 */
export function Calendario({
  entradas,
  mes,
  vista,
  hoy,
  puedeCrear,
}: {
  entradas: readonly Entrada[];
  /** `YYYY-MM` que se está mirando. */
  mes: string;
  vista?: VistaCalendario;
  /** `YYYY-MM-DD` de hoy, calculado en el servidor. */
  hoy: string;
  /** Si tiene `operaciones.escribir`: dibuja el botón de crear. */
  puedeCrear: boolean;
}) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const parametros = useSearchParams();

  const [busqueda, setBusqueda] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [origenes, setOrigenes] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<Entrada | null>(null);
  const [creando, setCreando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const hayFiltros = tipos.length > 0 || origenes.length > 0;
  const etiquetaOrigen = (origen: OrigenCalendario) =>
    t(`origin.${ORIGEN_VISUAL[origen].llave}`);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return entradas.filter((entrada) => {
      if (
        texto &&
        !entrada.titulo.toLowerCase().includes(texto) &&
        !(entrada.detalle ?? "").toLowerCase().includes(texto) &&
        !(entrada.ubicacion ?? "").toLowerCase().includes(texto)
      ) {
        return false;
      }

      if (origenes.length > 0 && !origenes.includes(entrada.origen)) return false;

      // El filtro por tipo solo aplica a eventos: una cita o una tarea no
      // tienen tipo de evento, y esconderlas al filtrar sería mentir.
      if (tipos.length > 0) {
        if (entrada.origen !== "evento") return false;
        if (!tipos.includes(entrada.detalle ?? "otro")) return false;
      }

      return true;
    });
  }, [entradas, busqueda, tipos, origenes]);

  const porClave = useMemo(
    () => new Map(entradas.map((e) => [`${e.origen}:${e.id}`, e])),
    [entradas],
  );

  const eventos = useMemo<EventoCalendario[]>(
    () =>
      visibles.map((e) => ({
        clave: `${e.origen}:${e.id}`,
        origen: e.origen,
        titulo: e.titulo,
        dia: e.dia,
        hora: e.hora,
        horaFin: e.horaFin,
        movible: e.editable,
      })),
    [visibles],
  );

  async function mover(clave: string, dia: string, hora: string) {
    const entrada = porClave.get(clave);

    if (!entrada?.editable) {
      setAviso(t("readOnly"));
      return false;
    }

    const datos = new FormData();
    datos.set("origen", entrada.origen);
    datos.set("id", entrada.id);
    datos.set("dia", dia);
    datos.set("hora", hora);

    const resultado = await moverEntrada({ estado: "inicial" }, datos);
    const bien = resultado.estado === "ok";

    setAviso(bien ? t("moved") : t("moveError"));
    return bien;
  }

  function alCambiarRango(rango: { mes: string; vista: VistaCalendario }) {
    if (rango.mes === mes && rango.vista === (vista ?? "mes")) return;

    const siguientes = new URLSearchParams(parametros);
    siguientes.set("mes", rango.mes);
    siguientes.set("vista", rango.vista);
    router.replace(`?${siguientes}`, { scroll: false });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ── Buscador y filtros ───────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3" />
          <Input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="pl-9"
          />
          {busqueda && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0"
              onClick={() => setBusqueda("")}
              aria-label={t("clear")}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FiltroMenu
            etiqueta={t("filterByOrigin")}
            opciones={ORIGENES.map((o) => [o, etiquetaOrigen(o)])}
            elegidas={origenes}
            onCambiar={setOrigenes}
          />

          <FiltroMenu
            etiqueta={t("filterByType")}
            opciones={TIPOS_EVENTO.map((tipo) => [tipo, t(`eventType.${tipo}`)])}
            elegidas={tipos}
            onCambiar={setTipos}
          />

          {hayFiltros && (
            <Button
              variant="ghost"
              onClick={() => {
                setTipos([]);
                setOrigenes([]);
              }}
            >
              <X className="size-4" />
              {t("clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Con dos menús cerrados no se ve qué está filtrando, y un calendario
          que esconde cosas sin decirlo se lee como un calendario vacío. */}
      {hayFiltros && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="texto-meta">{t("activeFilters")}</span>

          {origenes.map((origen) => (
            <FiltroPuesto
              key={origen}
              nombre={etiquetaOrigen(origen as OrigenCalendario)}
              onQuitar={() => setOrigenes(origenes.filter((v) => v !== origen))}
            />
          ))}

          {tipos.map((tipo) => (
            <FiltroPuesto
              key={tipo}
              nombre={t(`eventType.${tipo}`)}
              onQuitar={() => setTipos(tipos.filter((v) => v !== tipo))}
            />
          ))}
        </div>
      )}

      <p className="texto-meta flex flex-wrap items-center gap-x-3" aria-live="polite">
        <span>{t("count", { n: visibles.length })}</span>
        {aviso && <span className="font-medium text-marca-600">· {aviso}</span>}
      </p>

      <CalendarioBase
        className="rounded-card border border-linea bg-card p-3 shadow-card sm:p-4"
        eventos={eventos}
        hoy={hoy}
        fechaInicial={hoy.startsWith(mes) ? hoy : `${mes}-01`}
        vistaInicial={vista}
        etiquetaOrigen={etiquetaOrigen}
        onAbrir={(clave) => setAbierta(porClave.get(clave) ?? null)}
        onDiaClick={puedeCrear ? setCreando : undefined}
        onMover={mover}
        onCambioRango={alCambiarRango}
        acciones={
          puedeCrear ? (
            <Button onClick={() => setCreando(hoy.startsWith(mes) ? hoy : `${mes}-01`)}>
              <Plus className="size-4" />
              {t("newEvent.action")}
            </Button>
          ) : undefined
        }
      />

      <DialogoEntrada
        entrada={abierta}
        onCerrar={() => setAbierta(null)}
        puedeCrear={puedeCrear}
      />

      <DialogoAlta dia={creando} onCerrar={() => setCreando(null)} />
    </div>
  );
}
