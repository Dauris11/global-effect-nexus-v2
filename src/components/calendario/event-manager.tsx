"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Grid3x3,
  Heart,
  Inbox,
  List,
  ListTodo,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { esPrioridad, PRIORIDAD, type Prioridad } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import {
  eliminarEvento,
  guardarEvento,
  moverEntrada,
} from "@/server/calendario/acciones";

/**
 * Calendario del sistema: mes, semana, día y lista, con buscador, filtros,
 * arrastrar para mover y un diálogo para crear y editar.
 *
 * Adaptado de un gestor de eventos de shadcn. De aquel se conserva la
 * estructura —cuatro vistas, filtros, arrastrar, tarjeta al pasar el ratón— y se
 * cambia todo lo demás, porque tal cual no servía aquí:
 *
 * - La paleta. Traía azul, verde, morado, naranja, rosa y rojo. `docs/09-sistema-visual.md`
 *   fija que el sitio se pinta con azul claro, azul oscuro, blanco y negro, así
 *   que el color de una entrada ya no lo elige quien la crea: lo dice su ORIGEN,
 *   que es lo único que de verdad hay que distinguir de un vistazo.
 *
 * - Los textos. Estaban en inglés y en el código. Ahora salen del espacio
 *   `calendar`, que ya existía traducido a los dos idiomas.
 *
 * - Los datos. Guardaba los eventos en estado de cliente con ids de
 *   `Math.random()`, así que nada sobrevivía a recargar. Ahora las entradas
 *   llegan del servidor y cada cambio pasa por una Server Action que escribe en
 *   la base y deja rastro en `audit_log`.
 *
 * - Qué se puede tocar. Un evento institucional lo mueve y edita quien tenga
 *   `operaciones.escribir`; una cita con administración, quien tenga
 *   `solicitudes.gestionar`; una tarea no se mueve desde aquí. El componente pinta lo que
 *   puede hacerse, y el servidor lo vuelve a comprobar.
 *
 * Las fechas llegan como `YYYY-MM-DD` y `HH:MM`, no como `Date`: un `Date`
 * serializado del servidor al cliente cambia de día según la zona del navegador,
 * y aquí el día es el dato.
 */

export type Entrada = {
  origen: "evento" | "tarea" | "asignacion" | "cita" | "reunion";
  id: string;
  titulo: string;
  detalle: string | null;
  /** `YYYY-MM-DD`. */
  dia: string;
  /** `HH:MM` o `null` si dura todo el día. */
  hora: string | null;
  horaFin: string | null;
  descripcion: string | null;
  ubicacion: string | null;
  estado: string;
  prioridad?: string | null;
  /** Si esta persona puede moverla o editarla. Lo decide el servidor. */
  editable: boolean;
};

type Vista = "mes" | "semana" | "dia" | "lista";

/**
 * El color lo da el origen, no una elección.
 *
 * Azul oscuro para las citas con administración, negro para lo que tiene fecha límite, azul de la
 * casa para lo institucional, azul medio para reuniones y azul claro para lo que vence en una clase.
 */
const COLOR_ORIGEN = {
  cita: "bg-[#0a6a8a] text-white",
  tarea: "bg-[#171A1D] text-white",
  evento: "bg-[#2096BA] text-white",
  asignacion: "bg-[#5FB8D4] text-[#171A1D]",
  reunion: "bg-[#187a99] text-white",
} as const;

/** Del origen a su clave en `calendar.origin.*`. */
const LLAVE_ORIGEN = {
  evento: "event",
  tarea: "task",
  cita: "appointment",
  asignacion: "assignment",
  reunion: "meeting",
} as const;

const TIPOS_EVENTO = [
  "academico",
  "administrativo",
  "social",
  "reunion",
  "otro",
] as const;

/** Las 24 horas de las rejillas de semana y día. */
const HORAS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Alto de una fila de hora, en píxeles.
 *
 * Va en JavaScript y no solo en clases porque hace falta para colocar el scroll
 * al abrir: la rejilla arranca a las 07:00, no a medianoche.
 */
const ALTO_HORA = 56;

export function EventManager({
  entradas,
  mes,
  hoy,
  puedeCrear,
  puedeMoverCitas,
  onCambiarMes,
}: {
  entradas: readonly Entrada[];
  /** `YYYY-MM` que se está mirando. */
  mes: string;
  /** `YYYY-MM-DD` de hoy, calculado en el servidor. */
  hoy: string;
  /** Si tiene `operaciones.escribir`: dibuja el botón de crear. */
  puedeCrear: boolean;
  /** Si puede mover citas. Solo para el aviso; el servidor decide. */
  puedeMoverCitas: boolean;
  /** Navegar de mes cambia la URL, así que lo resuelve quien nos usa. */
  onCambiarMes: (mes: string) => void;
}) {
  const t = useTranslations("calendar");
  const [vista, setVista] = useState<Vista>("mes");
  const [busqueda, setBusqueda] = useState("");
  const [tipos, setTipos] = useState<string[]>([]);
  const [origenes, setOrigenes] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<Entrada | null>(null);
  const [creando, setCreando] = useState<string | null>(null);
  const [arrastrada, setArrastrada] = useState<Entrada | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [moviendo, moverConTransicion] = useTransition();

  /*
   * Día de referencia de las vistas de semana y día.
   *
   * El mes vive en la URL, pero la semana y el día no: son una forma de mirar el
   * mismo mes, y meterlos en la URL obligaría a recargar del servidor para pasar
   * de un martes a un miércoles que ya está en memoria. Cuando la navegación se
   * sale del mes cargado —una semana que cruza— sí se pide el mes nuevo.
   */
  const [foco, setFoco] = useState(hoy);

  // Si el mes cambió por la URL, el foco viejo ya no pinta: se vuelve a hoy si
  // cae en este mes, y si no al día 1.
  const focoEfectivo = foco.startsWith(mes)
    ? foco
    : hoy.startsWith(mes)
      ? hoy
      : `${mes}-01`;

  const dias = useMemo(() => semanaDe(focoEfectivo), [focoEfectivo]);

  const hayFiltros = tipos.length > 0 || origenes.length > 0;

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

  const porDia = useMemo(() => {
    const mapa = new Map<string, Entrada[]>();

    for (const entrada of visibles) {
      const lista = mapa.get(entrada.dia);
      if (lista) lista.push(entrada);
      else mapa.set(entrada.dia, [entrada]);
    }

    return mapa;
  }, [visibles]);

  /**
   * Suelta una entrada en otro día y, en las rejillas por hora, en otra hora.
   *
   * `hora` solo llega desde semana y día. En la de mes no hay hora en la casilla
   * y se manda vacía, que es como se le dice al servidor "deja la que tenía".
   */
  function soltarEn(dia: string, hora?: string) {
    const entrada = arrastrada;
    setArrastrada(null);

    if (!entrada) return;
    if (entrada.dia === dia && (!hora || hora === entrada.hora?.slice(0, 5))) {
      return;
    }

    if (!entrada.editable) {
      setAviso(t("readOnly"));
      return;
    }

    const datos = new FormData();
    datos.set("origen", entrada.origen);
    datos.set("id", entrada.id);
    datos.set("dia", dia);
    datos.set("hora", hora ?? "");

    moverConTransicion(async () => {
      const resultado = await moverEntrada({ estado: "inicial" }, datos);
      setAviso(resultado.estado === "ok" ? t("moved") : t("moveError"));
    });
  }

  /**
   * Las flechas se mueven en la unidad de la vista: un mes, una semana o un día.
   *
   * Es lo que espera cualquiera que use un calendario, y sin esto la flecha en
   * la vista de día saltaba treinta días de golpe.
   */
  function navegar(paso: -1 | 1) {
    if (vista === "mes" || vista === "lista") {
      onCambiarMes(mesVecino(mes, paso));
      return;
    }

    const siguiente = diaVecino(focoEfectivo, paso * (vista === "semana" ? 7 : 1));

    setFoco(siguiente);
    if (!siguiente.startsWith(mes)) onCambiarMes(siguiente.slice(0, 7));
  }

  function irAHoy() {
    setFoco(hoy);
    if (!hoy.startsWith(mes)) onCambiarMes(hoy.slice(0, 7));
  }

  // El título dice dónde estás, y eso cambia con la vista: el mes, la semana que
  // se está mirando o el día entero con su nombre.
  const titulo =
    vista === "semana"
      ? t("weekOf", { dia: etiquetaCorta(dias[0]) })
      : vista === "dia"
        ? etiquetaDeDia(focoEfectivo)
        : etiquetaDeMes(mes);

  return (
    // `min-w-0` en la raíz: es hija de una columna flex y sin él el contenido
    // ancho de la rejilla la estira en vez de desbordar dentro de su hueco.
    <div className="flex min-w-0 flex-col gap-4">
      {/* ── Cabecera: mes, navegación y vistas ───────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold first-letter:uppercase sm:text-2xl">
            {titulo}
          </h2>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navegar(-1)}
              aria-label={t("previous")}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={irAHoy}
            >
              {t("today")}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navegar(1)}
              aria-label={t("next")}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* En móvil, un desplegable: cuatro botones no caben. */}
          <div className="sm:hidden">
            <Select value={vista} onValueChange={(v) => setVista(v as Vista)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">{t("view.month")}</SelectItem>
                <SelectItem value="semana">{t("view.week")}</SelectItem>
                <SelectItem value="dia">{t("view.day")}</SelectItem>
                <SelectItem value="lista">{t("view.list")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-background hidden items-center gap-1 rounded-lg border p-1 sm:flex">
            {(
              [
                ["mes", Calendar, t("view.month")],
                ["semana", Grid3x3, t("view.week")],
                ["dia", Clock, t("view.day")],
                ["lista", List, t("view.list")],
              ] as const
            ).map(([clave, Icono, etiqueta]) => (
              <Button
                key={clave}
                variant={vista === clave ? "secondary" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => setVista(clave as Vista)}
              >
                <Icono className="size-4" />
                <span className="ml-1 hidden md:inline">{etiqueta}</span>
              </Button>
            ))}
          </div>

          {puedeCrear && (
            <Button onClick={() => setCreando(focoEfectivo)} className="w-full sm:w-auto">
              <Plus className="size-4" />
              {t("newEvent.action")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Buscador y filtros ───────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
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
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              onClick={() => setBusqueda("")}
              aria-label={t("clear")}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <FiltroMenu
            etiqueta={t("filterByOrigin")}
            titulo={t("filterByOrigin")}
            opciones={[
              ["evento", t("origin.event")],
              ["tarea", t("origin.task")],
              ["asignacion", t("origin.assignment")],
              ["cita", t("origin.appointment")],
            ]}
            elegidas={origenes}
            onCambiar={setOrigenes}
          />

          <FiltroMenu
            etiqueta={t("filterByType")}
            titulo={t("filterByType")}
            opciones={TIPOS_EVENTO.map((tipo) => [tipo, t(`eventType.${tipo}`)])}
            elegidas={tipos}
            onCambiar={setTipos}
          />

          {hayFiltros && (
            <Button
              variant="ghost"
              size="sm"
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

      {/* Filtros puestos, cada uno con su cruz: con dos menús desplegables no se
          ve qué está filtrando sin abrirlos, y un calendario que esconde cosas
          sin decirlo se lee como un calendario vacío. */}
      {hayFiltros && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {t("activeFilters")}
          </span>

          {origenes.map((origen) => (
            <Chip
              key={origen}
              nombre={t(`origin.${LLAVE_ORIGEN[origen as Entrada["origen"]]}`)}
              onQuitar={() =>
                setOrigenes(origenes.filter((valor) => valor !== origen))
              }
            />
          ))}

          {tipos.map((tipo) => (
            <Chip
              key={tipo}
              nombre={t(`eventType.${tipo}`)}
              onQuitar={() => setTipos(tipos.filter((valor) => valor !== tipo))}
            />
          ))}
        </div>
      )}

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>{t("count", { n: visibles.length })}</span>
        {puedeCrear || puedeMoverCitas ? <span>· {t("moveHint")}</span> : null}
        {(aviso || moviendo) && (
          <span className="font-medium text-[#187a99]">
            · {moviendo ? t("saving") : aviso}
          </span>
        )}
      </div>

      {/* ── La vista elegida ─────────────────────────────────────── */}
      {vista === "mes" && (
        <VistaMes
          mes={mes}
          hoy={hoy}
          porDia={porDia}
          semana={t("weekday").split("·")}
          mas={(n) => t("more", { n })}
          onAbrir={setAbierta}
          onArrastrar={setArrastrada}
          onSoltar={soltarEn}
          onCrear={puedeCrear ? setCreando : undefined}
        />
      )}

      {vista === "semana" && (
        <VistaSemana
          dias={dias}
          hoy={hoy}
          porDia={porDia}
          textos={{ hora: t("time"), todoElDia: t("allDay") }}
          onAbrir={setAbierta}
          onArrastrar={setArrastrada}
          onSoltar={soltarEn}
        />
      )}

      {vista === "dia" && (
        <VistaDia
          dia={focoEfectivo}
          hoy={hoy}
          porDia={porDia}
          textos={{ todoElDia: t("allDay"), vacio: t("dayEmpty") }}
          onAbrir={setAbierta}
          onArrastrar={setArrastrada}
          onSoltar={soltarEn}
        />
      )}

      {vista === "lista" && (
        <VistaLista
          entradas={visibles}
          vacio={t("noResults")}
          onAbrir={setAbierta}
        />
      )}

      {/* ── Detalle / edición ────────────────────────────────────── */}
      <DialogoEntrada
        entrada={abierta}
        onCerrar={() => setAbierta(null)}
        puedeCrear={puedeCrear}
      />

      {/* ── Alta ─────────────────────────────────────────────────── */}
      <DialogoAlta dia={creando} onCerrar={() => setCreando(null)} />
    </div>
  );
}

/** Un filtro puesto, con su cruz para quitarlo. */
function Chip({
  nombre,
  onQuitar,
}: {
  nombre: string;
  onQuitar: () => void;
}) {
  return (
    <Badge className="gap-1 bg-[#2096BA]/15 text-[11px] text-[#187a99]">
      {nombre}
      {/* La X de quitar el filtro no tenía ninguna clase: quedaba en 12×12px,
          la diana más pequeña de todo el sistema y justo la que se usa con el
          dedo. `-mr-1` recupera el hueco que añade el padding para que la
          insignia no crezca. */}
      <button
        type="button"
        onClick={onQuitar}
        aria-label={nombre}
        className="-mr-1 flex size-6 items-center justify-center rounded-full transition-colors hover:bg-[#2096BA]/25"
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

/** Menú de filtro con casillas. */
function FiltroMenu({
  etiqueta,
  titulo,
  opciones,
  elegidas,
  onCambiar,
}: {
  etiqueta: string;
  titulo: string;
  opciones: readonly (readonly [string, string])[];
  elegidas: string[];
  onCambiar: (valores: string[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={etiqueta}>
          <Filter className="size-4" />
          <span>{etiqueta}</span>
          {elegidas.length > 0 && (
            <Badge className="ml-1 bg-[#2096BA]/15 px-1.5 text-[10px] text-[#187a99]">
              {elegidas.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{titulo}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {opciones.map(([valor, nombre]) => (
          <DropdownMenuCheckboxItem
            key={valor}
            checked={elegidas.includes(valor)}
            onCheckedChange={(marcada) =>
              onCambiar(
                marcada
                  ? [...elegidas, valor]
                  : elegidas.filter((v) => v !== valor),
              )
            }
          >
            {nombre}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Píldora de una entrada dentro de una casilla.
 *
 * Arrastrable solo si se puede mover. En la rejilla de mes lleva tarjeta al
 * pasar el ratón: en una casilla de mes no cabe más que el título, y ver la hora
 * y el lugar sin abrir el diálogo ahorra un clic por entrada. En las rejillas
 * por hora no hace falta, la casilla ya tiene sitio para las dos líneas.
 *
 * La tarjeta se coloca `fixed` con la posición del botón, y no `absolute` dentro
 * de la casilla, porque la rejilla recorta lo que se sale —tiene su propio
 * scroll— y una tarjeta a medio cortar es peor que ninguna.
 */
function Pildora({
  entrada,
  onAbrir,
  onArrastrar,
  variante = "compacta",
}: {
  entrada: Entrada;
  onAbrir: (entrada: Entrada) => void;
  onArrastrar: (entrada: Entrada) => void;
  variante?: "compacta" | "amplia";
}) {
  const t = useTranslations("calendar");
  const [caja, setCaja] = useState<{ top: number; left: number } | null>(null);

  const horas = entrada.hora ? franja(entrada.hora, entrada.horaFin) : t("allDay");

  return (
    <div className="relative">
      <button
        type="button"
        draggable={entrada.editable}
        onDragStart={() => onArrastrar(entrada)}
        onClick={() => onAbrir(entrada)}
        onMouseEnter={(evento) => {
          if (variante !== "compacta") return;

          const marco = evento.currentTarget.getBoundingClientRect();

          // Pegada al borde derecho de la pantalla se saldría: se corre hacia
          // dentro lo que haga falta.
          setCaja({
            top: marco.bottom + 6,
            left: Math.max(8, Math.min(marco.left, window.innerWidth - 256)),
          });
        }}
        onMouseLeave={() => setCaja(null)}
        className={cn(
          "block w-full rounded text-left font-medium transition-transform hover:scale-[1.02]",
          COLOR_ORIGEN[entrada.origen],
          entrada.editable && "cursor-grab active:cursor-grabbing",
          variante === "compacta"
            ? "truncate px-1.5 py-0.5 text-[10px]"
            : "px-1.5 py-1 text-[11px] leading-tight",
        )}
        title={`${entrada.titulo} · ${horas}`}
      >
        {variante === "compacta" ? (
          <>
            {/* La hora solo desde `sm`: en una casilla de móvil deja el título
                en "14:0…", que no dice nada. */}
            {entrada.hora && (
              <span className="hidden sm:inline">
                {entrada.hora.slice(0, 5)}{" "}
              </span>
            )}
            {entrada.titulo}
          </>
        ) : (
          <>
            <span className="block truncate">{entrada.titulo}</span>
            <span className="block truncate text-[10px] opacity-80">
              {entrada.ubicacion ?? horas}
            </span>
          </>
        )}
      </button>

      {caja && (
        <div
          className="pointer-events-none fixed z-50 w-60"
          style={{ top: caja.top, left: caja.left }}
        >
          <Card className="gap-2 p-3 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs leading-tight font-semibold">
                {entrada.titulo}
              </p>
              <span
                className={cn(
                  "mt-0.5 size-2.5 shrink-0 rounded-full",
                  COLOR_ORIGEN[entrada.origen],
                )}
              />
            </div>

            <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Clock className="size-3 shrink-0" />
              {horas}
            </p>

            {entrada.ubicacion && (
              <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <MapPin className="size-3 shrink-0" />
                {entrada.ubicacion}
              </p>
            )}

            <div className="flex flex-wrap gap-1">
              <Badge className="bg-[#2096BA]/15 text-[10px] text-[#187a99]">
                {t(`origin.${LLAVE_ORIGEN[entrada.origen]}`)}
              </Badge>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * Vista de mes: rejilla de siete columnas, lunes primero.
 *
 * Las seis semanas van completas, con los días del mes vecino en gris. Dejarlos
 * en blanco rompe la forma de la rejilla y esconde lo que cae en ellos, que es
 * justo lo que se busca cuando se mira el final o el principio de un mes; la
 * consulta ya los trae.
 */
function VistaMes({
  mes,
  hoy,
  porDia,
  semana,
  mas,
  onAbrir,
  onArrastrar,
  onSoltar,
  onCrear,
}: {
  mes: string;
  hoy: string;
  porDia: Map<string, Entrada[]>;
  semana: string[];
  mas: (n: number) => string;
  onAbrir: (entrada: Entrada) => void;
  onArrastrar: (entrada: Entrada) => void;
  onSoltar: (dia: string) => void;
  onCrear?: (dia: string) => void;
}) {
  return (
    <Card className="min-w-0 gap-0 p-0">
      <div className="grid grid-cols-7 border-b">
        {semana.map((inicial, indice) => (
          <p
            key={`${inicial}-${indice}`}
            className="text-muted-foreground border-r p-2 text-center text-[11px] font-semibold last:border-r-0"
          >
            {inicial}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {rejilla(mes).map(({ dia, delMes }) => {
          const delDia = porDia.get(dia) ?? [];

          return (
            <div
              key={dia}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={() => onSoltar(dia)}
              onDoubleClick={() => onCrear?.(dia)}
              className={cn(
                // En pantalla estrecha la casilla baja de alto y aprieta el
                // relleno: siete columnas en un móvil no dan para más.
                "hover:bg-accent/40 min-h-20 space-y-1 border-r border-b p-1 transition-colors last:border-r-0 sm:min-h-24 sm:p-1.5",
                !delMes && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs",
                  dia === hoy
                    ? "bg-[#2096BA] font-bold text-white"
                    : delMes
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50",
                )}
              >
                {Number(dia.slice(8, 10))}
              </span>

              <div className="space-y-0.5">
                {delDia.slice(0, 3).map((entrada) => (
                  <Pildora
                    key={`${entrada.origen}-${entrada.id}`}
                    entrada={entrada}
                    onAbrir={onAbrir}
                    onArrastrar={onArrastrar}
                  />
                ))}

                {delDia.length > 3 && (
                  <p className="text-muted-foreground px-1 text-[10px]">
                    {mas(delDia.length - 3)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Vista de semana: siete columnas de días por veinticuatro filas de hora.
 *
 * Es la rejilla de horas de verdad, no una lista por columnas: la posición
 * vertical ES la hora, que es lo único que se quiere ver de un vistazo cuando se
 * busca un hueco entre citas. Cada casilla recibe lo que se le suelte, así que
 * arrastrar aquí cambia el día y la hora de una sola vez.
 *
 * Las veinticuatro filas van en un marco con scroll propio, abierto a las 07:00:
 * la madrugada existe en la rejilla —una cita se puede mover ahí— pero no se
 * gasta la primera pantalla en horas vacías.
 */
function VistaSemana({
  dias,
  hoy,
  porDia,
  textos,
  onAbrir,
  onArrastrar,
  onSoltar,
}: {
  dias: readonly string[];
  hoy: string;
  porDia: Map<string, Entrada[]>;
  textos: { hora: string; todoElDia: string };
  onAbrir: (entrada: Entrada) => void;
  onArrastrar: (entrada: Entrada) => void;
  onSoltar: (dia: string, hora?: string) => void;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const fija = useRef<HTMLDivElement>(null);

  /*
   * Abre donde hay algo: en la hora de la primera entrada de la semana, y a las
   * 07:00 si la semana está vacía. Abrir siempre a las 07:00 dejaba la pantalla
   * en blanco cuando lo único de esa semana era a las 14:00, y parecía que no
   * había nada. Se descuenta la cabecera pegada, que si no tapa esa primera fila.
   */
  useEffect(() => {
    const horas = dias
      .flatMap((dia) => porDia.get(dia) ?? [])
      .map((entrada) => Number(entrada.hora?.slice(0, 2)))
      .filter((hora) => Number.isFinite(hora));

    const primera = horas.length > 0 ? Math.min(...horas) : 7;

    marco.current?.scrollTo({
      top: Math.max(0, primera * ALTO_HORA - (fija.current?.offsetHeight ?? 0)),
    });
  }, [dias, porDia]);

  const sinHora = dias.map((dia) =>
    (porDia.get(dia) ?? []).filter((entrada) => !entrada.hora),
  );

  const COLUMNAS = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

  return (
    <Card className="min-w-0 gap-0 overflow-hidden p-0">
      {/*
       * UN solo marco con scroll en los dos ejes, no dos anidados.
       *
       * Antes eran dos: uno horizontal por fuera y otro vertical por dentro.
       * Safari no los resuelve como Chromium —a un contenedor con scroll que es
       * hija de una columna flex le calcula el mínimo por su contenido, no cero,
       * así que las 46rem de la rejilla estiraban la tarjeta y rompían el ancho
       * de la página en vez de desbordar dentro— y encima la cabecera quedaba en
       * un contexto de scroll distinto que las horas. Con un marco y `min-w-0`
       * los dos motores hacen lo mismo.
       */}
      <div ref={marco} className="max-h-[32rem] min-w-0 overflow-auto">
        <div className="min-w-[46rem]">
          {/* Cabecera y franja de todo el día, pegadas arriba: al bajar por las
              horas hay que seguir sabiendo qué columna es qué día. */}
          <div ref={fija} className="bg-card sticky top-0 z-20">
            <div className={cn(COLUMNAS, "border-b")}>
              <p className="text-muted-foreground border-r p-2 text-[10px] font-semibold">
                {textos.hora}
              </p>

              {dias.map((dia) => (
                <div
                  key={dia}
                  className={cn(
                    "border-r p-2 text-center last:border-r-0",
                    dia === hoy && "bg-[#2096BA]/10",
                  )}
                >
                  <p className="text-[11px] font-semibold capitalize">
                    {nombreDeDia(dia)}
                  </p>
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      dia === hoy
                        ? "font-bold text-[#187a99]"
                        : "text-muted-foreground",
                    )}
                  >
                    {Number(dia.slice(8, 10))}
                  </p>
                </div>
              ))}
            </div>

            {/* Lo que no tiene hora no cabe en una fila de hora, y esconderlo
                sería perderlo. */}
            {sinHora.some((lista) => lista.length > 0) && (
              <div className={cn(COLUMNAS, "bg-muted/30 border-b")}>
                <p className="text-muted-foreground border-r p-1.5 text-[10px]">
                  {textos.todoElDia}
                </p>

                {dias.map((dia, indice) => (
                  <div
                    key={dia}
                    onDragOver={(evento) => evento.preventDefault()}
                    onDrop={() => onSoltar(dia)}
                    className="space-y-0.5 border-r p-1 last:border-r-0"
                  >
                    {sinHora[indice].map((entrada) => (
                      <Pildora
                        key={`${entrada.origen}-${entrada.id}`}
                        entrada={entrada}
                        onAbrir={onAbrir}
                        onArrastrar={onArrastrar}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {HORAS.map((hora) => (
            <div
              key={hora}
              className={cn(COLUMNAS, "border-b last:border-b-0")}
              style={{ minHeight: ALTO_HORA }}
            >
              <p className="text-muted-foreground border-r p-1 text-[10px] tabular-nums">
                {etiquetaHora(hora)}
              </p>

              {dias.map((dia) => (
                <div
                  key={dia}
                  onDragOver={(evento) => evento.preventDefault()}
                  onDrop={() => onSoltar(dia, etiquetaHora(hora))}
                  className={cn(
                    "hover:bg-accent/40 space-y-0.5 border-r p-1 transition-colors last:border-r-0",
                    dia === hoy && "bg-[#2096BA]/5",
                  )}
                >
                  {enLaHora(porDia.get(dia), hora).map((entrada) => (
                    <Pildora
                      key={`${entrada.origen}-${entrada.id}`}
                      entrada={entrada}
                      onAbrir={onAbrir}
                      onArrastrar={onArrastrar}
                      variante="amplia"
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Vista de día: las veinticuatro horas de un solo día.
 *
 * Misma rejilla que la semana con una columna, y también recibe lo que se le
 * suelte: es la vista donde se coloca una cita a una hora concreta.
 */
function VistaDia({
  dia,
  hoy,
  porDia,
  textos,
  onAbrir,
  onArrastrar,
  onSoltar,
}: {
  dia: string;
  hoy: string;
  porDia: Map<string, Entrada[]>;
  textos: { todoElDia: string; vacio: string };
  onAbrir: (entrada: Entrada) => void;
  onArrastrar: (entrada: Entrada) => void;
  onSoltar: (dia: string, hora?: string) => void;
}) {
  const marco = useRef<HTMLDivElement>(null);

  useEffect(() => {
    marco.current?.scrollTo({ top: 7 * ALTO_HORA });
  }, [dia]);

  const delDia = porDia.get(dia) ?? [];
  const sinHora = delDia.filter((entrada) => !entrada.hora);

  return (
    <Card className="min-w-0 gap-0 overflow-hidden p-0">
      {delDia.length === 0 && (
        <p className="text-muted-foreground border-b py-3 text-center text-xs">
          {textos.vacio}
        </p>
      )}

      {sinHora.length > 0 && (
        <div className="bg-muted/30 flex gap-2 border-b p-2">
          <p className="text-muted-foreground w-14 shrink-0 text-[10px]">
            {textos.todoElDia}
          </p>

          <div
            onDragOver={(evento) => evento.preventDefault()}
            onDrop={() => onSoltar(dia)}
            className="flex-1 space-y-1"
          >
            {sinHora.map((entrada) => (
              <Pildora
                key={`${entrada.origen}-${entrada.id}`}
                entrada={entrada}
                onAbrir={onAbrir}
                onArrastrar={onArrastrar}
                variante="amplia"
              />
            ))}
          </div>
        </div>
      )}

      <div ref={marco} className="max-h-[32rem] min-w-0 overflow-auto">
        {HORAS.map((hora) => (
          <div
            key={hora}
            onDragOver={(evento) => evento.preventDefault()}
            onDrop={() => onSoltar(dia, etiquetaHora(hora))}
            className="hover:bg-accent/40 flex border-b transition-colors last:border-b-0"
            style={{ minHeight: ALTO_HORA }}
          >
            <p
              className={cn(
                "text-muted-foreground w-14 shrink-0 border-r p-2 text-[11px] tabular-nums",
                dia === hoy && "bg-[#2096BA]/5",
              )}
            >
              {etiquetaHora(hora)}
            </p>

            <div className="flex-1 space-y-1 p-1.5">
              {enLaHora(delDia, hora).map((entrada) => (
                <Pildora
                  key={`${entrada.origen}-${entrada.id}`}
                  entrada={entrada}
                  onAbrir={onAbrir}
                  onArrastrar={onArrastrar}
                  variante="amplia"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Vista de lista: todo lo cargado, agrupado por día. */
function VistaLista({
  entradas,
  vacio,
  onAbrir,
}: {
  entradas: readonly Entrada[];
  vacio: string;
  onAbrir: (entrada: Entrada) => void;
}) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, Entrada[]>();

    for (const entrada of [...entradas].sort((a, b) =>
      a.dia === b.dia
        ? (a.hora ?? "").localeCompare(b.hora ?? "")
        : a.dia.localeCompare(b.dia),
    )) {
      const lista = mapa.get(entrada.dia);
      if (lista) lista.push(entrada);
      else mapa.set(entrada.dia, [entrada]);
    }

    return [...mapa.entries()];
  }, [entradas]);

  if (grupos.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground py-10 text-center text-sm">{vacio}</p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 space-y-5 p-4">
      {grupos.map(([dia, delDia]) => (
        <div key={dia} className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold first-letter:uppercase">
            {etiquetaDeDia(dia)}
          </p>
          <ul className="space-y-2">
            {delDia.map((entrada) => (
              <Fila
                key={`${entrada.origen}-${entrada.id}`}
                entrada={entrada}
                onAbrir={onAbrir}
              />
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

/** Una entrada en formato fila, para las vistas de día y lista. */
function Fila({
  entrada,
  onAbrir,
}: {
  entrada: Entrada;
  onAbrir: (entrada: Entrada) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onAbrir(entrada)}
        className="bg-muted/40 hover:bg-accent flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors"
      >
        <span
          className={cn(
            "mt-0.5 size-2.5 shrink-0 rounded-full",
            COLOR_ORIGEN[entrada.origen],
          )}
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {entrada.titulo}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {entrada.hora ? `${entrada.hora.slice(0, 5)} · ` : ""}
            {entrada.detalle ?? ""}
          </span>
          {entrada.ubicacion && (
            <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <MapPin className="size-3 shrink-0" />
              {entrada.ubicacion}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Detalle de una entrada, con edición y borrado si es un evento editable. */
function DialogoEntrada({
  entrada,
  onCerrar,
  puedeCrear,
}: {
  entrada: Entrada | null;
  onCerrar: () => void;
  puedeCrear: boolean;
}) {
  const t = useTranslations("calendar");
  const [guardando, transicion] = useTransition();

  if (!entrada) return null;

  const editableComoEvento = entrada.origen === "evento" && puedeCrear;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entrada.titulo}</DialogTitle>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-24 shrink-0">
              {t("event.date")}
            </dt>
            <dd>
              {entrada.dia}
              {entrada.hora ? ` · ${entrada.hora.slice(0, 5)}` : ` · ${t("allDay")}`}
              {entrada.horaFin ? `–${entrada.horaFin.slice(0, 5)}` : ""}
            </dd>
          </div>

          {entrada.detalle && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">
                {t("event.type")}
              </dt>
              <dd>{entrada.detalle}</dd>
            </div>
          )}

          {entrada.ubicacion && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">
                {t("event.place")}
              </dt>
              <dd>{entrada.ubicacion}</dd>
            </div>
          )}

          {entrada.descripcion && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-24 shrink-0">
                {t("event.description")}
              </dt>
              <dd className="min-w-0">{entrada.descripcion}</dd>
            </div>
          )}
        </dl>

        {editableComoEvento && (
          <FormularioEvento entrada={entrada} onTerminar={onCerrar} />
        )}

        <DialogFooter>
          {editableComoEvento && (
            <Button
              variant="destructive"
              size="sm"
              disabled={guardando}
              onClick={() => {
                if (!window.confirm(t("deleteConfirm"))) return;

                const datos = new FormData();
                datos.set("id", entrada.id);

                transicion(async () => {
                  await eliminarEvento({ estado: "inicial" }, datos);
                  onCerrar();
                });
              }}
            >
              <Trash2 className="size-3.5" />
              {guardando ? t("deleting") : t("deleteEvent")}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={onCerrar}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Alta de un evento en un día concreto. */
function DialogoAlta({
  dia,
  onCerrar,
}: {
  dia: string | null;
  onCerrar: () => void;
}) {
  const t = useTranslations("calendar");

  if (!dia) return null;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newEvent.title")}</DialogTitle>
        </DialogHeader>

        <FormularioEvento dia={dia} onTerminar={onCerrar} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Formulario de evento, para alta y para edición.
 *
 * Un `form` de verdad contra la Server Action: guardar no depende de que haya
 * JavaScript cargado, y el servidor vuelve a comprobar el permiso y el tipo.
 */
function FormularioEvento({
  entrada,
  dia,
  onTerminar,
}: {
  entrada?: Entrada;
  dia?: string;
  onTerminar: () => void;
}) {
  const t = useTranslations("calendar");
  const [guardando, transicion] = useTransition();
  const [error, setError] = useState(false);

  return (
    <form
      action={(datos) =>
        transicion(async () => {
          const resultado = await guardarEvento({ estado: "inicial" }, datos);

          if (resultado.estado === "ok") onTerminar();
          else setError(true);
        })
      }
      className="space-y-3 border-t pt-3"
    >
      <input type="hidden" name="id" value={entrada?.id ?? ""} />

      <div className="space-y-1.5">
        <Label htmlFor="ev-titulo">{t("event.title")}</Label>
        <Input
          id="ev-titulo"
          name="titulo"
          defaultValue={entrada?.titulo}
          placeholder={t("newEvent.titlePlaceholder")}
          required
          maxLength={160}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ev-fecha">{t("event.date")}</Label>
          <Input
            id="ev-fecha"
            name="fecha"
            type="date"
            defaultValue={entrada?.dia ?? dia}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-inicio">{t("event.start")}</Label>
          <Input
            id="ev-inicio"
            name="hora_inicio"
            type="time"
            defaultValue={entrada?.hora?.slice(0, 5) ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-fin">{t("event.end")}</Label>
          <Input
            id="ev-fin"
            name="hora_fin"
            type="time"
            defaultValue={entrada?.horaFin?.slice(0, 5) ?? ""}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">{t("newEvent.timeHint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ev-tipo">{t("event.type")}</Label>
          <select
            id="ev-tipo"
            name="tipo"
            defaultValue={entrada?.detalle ?? "otro"}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-card px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            {TIPOS_EVENTO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {t(`eventType.${tipo}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-lugar">{t("event.place")}</Label>
          <Input
            id="ev-lugar"
            name="ubicacion"
            defaultValue={entrada?.ubicacion ?? ""}
            maxLength={160}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-desc">{t("event.description")}</Label>
        <Textarea
          id="ev-desc"
          name="descripcion"
          defaultValue={entrada?.descripcion ?? ""}
          maxLength={600}
          rows={2}
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {t("newEvent.error")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={guardando}>
          <CalendarDays className="size-3.5" />
          {guardando ? t("saving") : t("saveEvent")}
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={onTerminar}>
          {t("newEvent.cancel")}
        </Button>
      </div>
    </form>
  );
}

/* ── Utilidades de fecha ──────────────────────────────────────────
 *
 * Todo con `Date.UTC`. Un `new Date("2026-08-01")` se interpreta en la zona del
 * navegador y en América ese día sale el 31 de julio.
 */

/**
 * Casillas de la rejilla del mes, lunes primero.
 *
 * Semanas completas: empieza en el lunes de la semana del día 1 y termina en el
 * domingo de la del último, y cada casilla dice si es del mes que se mira o de
 * un vecino, para pintarla en gris. La consulta trae la misma ventana, así que
 * esas casillas también tienen su contenido.
 */
function rejilla(mes: string): { dia: string; delMes: boolean }[] {
  const [anio, numero] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, numero - 1, 1));
  const ultimo = new Date(Date.UTC(anio, numero, 0));

  const inicio = new Date(primero);
  inicio.setUTCDate(primero.getUTCDate() - ((primero.getUTCDay() + 6) % 7));

  const fin = new Date(ultimo);
  fin.setUTCDate(ultimo.getUTCDate() + (6 - ((ultimo.getUTCDay() + 6) % 7)));

  const casillas: { dia: string; delMes: boolean }[] = [];

  for (const paso = new Date(inicio); paso <= fin; paso.setUTCDate(paso.getUTCDate() + 1)) {
    const dia = paso.toISOString().slice(0, 10);
    casillas.push({ dia, delMes: dia.startsWith(mes) });
  }

  return casillas;
}

/** Las entradas de una lista que caen en esa hora, en orden. */
function enLaHora(entradas: Entrada[] | undefined, hora: number): Entrada[] {
  return (entradas ?? [])
    .filter((entrada) => entrada.hora && Number(entrada.hora.slice(0, 2)) === hora)
    .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
}

/** `7` → `"07:00"`. También es lo que se manda al servidor al soltar. */
function etiquetaHora(hora: number): string {
  return `${String(hora).padStart(2, "0")}:00`;
}

/** `"09:00"` y `"11:30"` → `"09:00 – 11:30"`. Sin fin, solo el inicio. */
function franja(hora: string, horaFin: string | null): string {
  return horaFin
    ? `${hora.slice(0, 5)} – ${horaFin.slice(0, 5)}`
    : hora.slice(0, 5);
}

/** El día de al lado, a `paso` días. */
function diaVecino(dia: string, paso: number): string {
  const [anio, mes, numero] = dia.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, numero + paso));

  return fecha.toISOString().slice(0, 10);
}

/** Los siete días de la semana que contiene esa fecha, lunes primero. */
function semanaDe(dia: string): string[] {
  const [anio, mes, numero] = dia.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, numero));
  const lunes = new Date(fecha);
  lunes.setUTCDate(fecha.getUTCDate() - ((fecha.getUTCDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setUTCDate(lunes.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function mesVecino(mes: string, paso: number): string {
  const [anio, numero] = mes.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, numero - 1 + paso, 1));

  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

/*
 * Los nombres de mes y de día se componen con `Intl` a partir del idioma que ya
 * usa el documento, en vez de recibir doce y siete nombres traducidos por props.
 * `timeZone: "UTC"` en todos: las fechas se construyen en UTC y sin esto el
 * navegador las correría un día hacia atrás en América.
 */

function idiomaDelDocumento(): string {
  return typeof document === "undefined"
    ? "es"
    : document.documentElement.lang || "es";
}

function conFormato(dia: string, opciones: Intl.DateTimeFormatOptions): string {
  const [anio, mes, numero] = dia.split("-").map(Number);

  return new Intl.DateTimeFormat(idiomaDelDocumento(), {
    ...opciones,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(anio, mes - 1, numero)));
}

/** "agosto de 2026". */
function etiquetaDeMes(mes: string): string {
  return conFormato(`${mes}-01`, { month: "long", year: "numeric" });
}

/** "sábado, 22 de agosto de 2026". Título de la vista de día y de cada grupo. */
function etiquetaDeDia(dia: string): string {
  return conFormato(dia, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "22 de ago". Para el título de la vista de semana. */
function etiquetaCorta(dia: string): string {
  return conFormato(dia, { day: "numeric", month: "short" });
}

/** "sáb". Cabecera de columna en la vista de semana. */
function nombreDeDia(dia: string): string {
  return conFormato(dia, { weekday: "short" });
}
