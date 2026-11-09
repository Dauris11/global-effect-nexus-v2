"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronLeft, ChevronRight, LayoutList, ListOrdered } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  CLAVE_MODO_FORMULARIO,
  MODO_FORMULARIO_INICIAL,
  leerModoFormulario,
  type ModoFormulario,
} from "@/lib/modo-formulario";
import { cn } from "@/lib/utils";

/**
 * Un formulario que se llena de dos maneras, a elección de quien lo usa:
 * "normal" (todo a la vista) o "guiado" (un paso a la vez, con Anterior y
 * Siguiente).
 *
 * Se usa DENTRO del `<form>` y sin tocar cómo guarda:
 *
 *   <form action={…}>
 *     <FormularioGuiado>
 *       <PasoFormulario titulo={t("datos")}>…campos…</PasoFormulario>
 *       <PasoFormulario titulo={t("contacto")}>…campos…</PasoFormulario>
 *       <AccionesFormulario>…Cancelar / Guardar…</AccionesFormulario>
 *     </FormularioGuiado>
 *   </form>
 *
 * LOS PASOS OCULTOS SIGUEN MONTADOS. En modo guiado un paso que no toca se
 * esconde con `hidden`, no se desmonta: así el `FormData` que llega a la
 * acción es el mismo en los dos modos, los campos no controlados no pierden lo
 * escrito al ir y volver, y ningún formulario tiene que cambiar su envío.
 *
 * Como los `required` de un paso escondido no se pueden señalar, se validan al
 * pulsar Siguiente; por eso solo se avanza con el botón (o con Enter) y solo se
 * puede saltar hacia atrás, a pasos ya revisados.
 */

const oyentes = new Set<() => void>();

function suscribir(aviso: () => void) {
  oyentes.add(aviso);
  // `storage` trae el cambio hecho en otra pestaña del mismo navegador.
  window.addEventListener("storage", aviso);

  return () => {
    oyentes.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
}

// Sin almacenamiento (navegación privada, datos bloqueados) la elección vale
// solo mientras siga abierta la página.
let respaldo: ModoFormulario | null = null;

const instantanea = () => respaldo ?? leerModoFormulario();

/** Preferencia vigente y la función para cambiarla en todo el portal. */
export function useModoFormulario() {
  const modo = useSyncExternalStore(
    suscribir,
    instantanea,
    () => MODO_FORMULARIO_INICIAL,
  );

  const cambiar = useCallback((nuevo: ModoFormulario) => {
    try {
      localStorage.setItem(CLAVE_MODO_FORMULARIO, nuevo);
      respaldo = null;
    } catch {
      respaldo = nuevo;
    }
    oyentes.forEach((aviso) => aviso());
  }, []);

  return { modo, cambiar };
}

type Contexto = {
  guiado: boolean;
  actual: number;
  total: number;
  ir: (destino: number) => void;
  raiz: React.RefObject<HTMLDivElement | null>;
};

const ContextoGuiado = createContext<Contexto | null>(null);

const SELECTOR_PASO = "[data-paso-formulario]";

/** Pasos de ESTE formulario, en orden de pantalla (no los de uno anidado). */
function pasosDe(raiz: HTMLElement | null): HTMLElement[] {
  if (!raiz) return [];

  return Array.from(raiz.querySelectorAll<HTMLElement>(SELECTOR_PASO)).filter(
    (paso) => paso.closest("[data-formulario-guiado]") === raiz,
  );
}

/** Marca el primer campo inválido del paso y dice si se puede seguir. */
function pasoValido(paso: HTMLElement | undefined) {
  if (!paso) return true;

  const campos = paso.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("input, select, textarea");

  for (const campo of campos) {
    if (!campo.checkValidity()) {
      campo.reportValidity();
      return false;
    }
  }

  return true;
}

export function FormularioGuiado({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common.formularioGuiado");
  const { modo, cambiar } = useModoFormulario();
  const raiz = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  // Los títulos se leen del DOM y se guardan unidos en un texto: un arreglo
  // nuevo en cada lectura haría que el efecto se repitiera sin fin.
  const [titulos, setTitulos] = useState("");

  const guiado = modo === "guiado";
  const lista = titulos ? titulos.split("\u0000") : [];
  const total = lista.length;

  // Sin dependencias a propósito: un paso condicional puede aparecer en
  // cualquier render; los `set` con el mismo valor no vuelven a pintar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const pasos = pasosDe(raiz.current);
    setTitulos(pasos.map((paso) => paso.dataset.titulo ?? "").join("\u0000"));
    // Si un paso condicional desaparece, no quedarse apuntando a la nada.
    if (pasos.length > 0 && actual > pasos.length - 1) setActual(pasos.length - 1);
  });

  const ir = useCallback(
    (destino: number) => {
      const pasos = pasosDe(raiz.current);
      if (destino > actual && !pasoValido(pasos[actual])) return;

      const siguiente = Math.max(0, Math.min(destino, pasos.length - 1));
      setActual(siguiente);

      // Llevar el foco al paso nuevo: quien usa teclado o lector de pantalla
      // no tiene por qué buscar dónde quedó.
      requestAnimationFrame(() => {
        pasos[siguiente]
          ?.querySelector<HTMLElement>("input, select, textarea, button")
          ?.focus({ preventScroll: true });
        pasos[siguiente]?.scrollIntoView({ block: "nearest" });
      });
    },
    [actual],
  );

  // Enter en un campo de texto envía el formulario; a mitad del recorrido lo
  // esperable es pasar al siguiente paso.
  const alPulsar = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    if (!guiado || actual >= total - 1 || evento.key !== "Enter") return;
    const objetivo = evento.target as HTMLElement;
    if (objetivo.tagName !== "INPUT") return;

    evento.preventDefault();
    ir(actual + 1);
  };

  // Con un solo paso no hay nada que guiar: el selector solo estorbaría.
  const conSelector = total > 1;

  return (
    <ContextoGuiado.Provider value={{ guiado: guiado && conSelector, actual, total, ir, raiz }}>
      <div
        ref={raiz}
        data-formulario-guiado=""
        onKeyDown={alPulsar}
        className={cn("space-y-5", className)}
      >
        {conSelector && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="radiogroup"
              aria-label={t("modo")}
              className="inline-flex rounded-full border border-linea p-1"
            >
              <BotonModo
                activo={!guiado}
                icono={LayoutList}
                etiqueta={t("normal")}
                onElegir={() => cambiar("normal")}
              />
              <BotonModo
                activo={guiado}
                icono={ListOrdered}
                etiqueta={t("guiado")}
                onElegir={() => cambiar("guiado")}
              />
            </div>

            {guiado && (
              <p className="texto-meta" aria-live="polite">
                {t("paso", { actual: actual + 1, total, titulo: lista[actual] ?? "" })}
              </p>
            )}
          </div>
        )}

        {guiado && conSelector && (
          <ol className="flex gap-1.5" aria-hidden>
            {lista.map((titulo, i) => (
              <li key={`${i}-${titulo}`} className="flex-1">
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={i >= actual}
                  onClick={() => ir(i)}
                  className={cn(
                    "block h-1.5 w-full rounded-full transition-colors duration-(--duracion-media)",
                    i <= actual ? "bg-marca-500" : "bg-linea",
                    i < actual && "cursor-pointer hover:bg-marca-600",
                  )}
                />
              </li>
            ))}
          </ol>
        )}

        {children}
      </div>
    </ContextoGuiado.Provider>
  );
}

function BotonModo({
  activo,
  icono: Icono,
  etiqueta,
  onElegir,
}: {
  activo: boolean;
  icono: typeof LayoutList;
  etiqueta: string;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onElegir}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        activo ? "bg-tinta text-background" : "text-tinta-2 hover:text-tinta",
      )}
    >
      <Icono className="size-4" />
      {etiqueta}
    </button>
  );
}

/**
 * Un tramo del formulario. En modo normal es una sección con su título; en
 * guiado, una pantalla del recorrido.
 */
export function PasoFormulario({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  const contexto = useContext(ContextoGuiado);
  const propio = useRef<HTMLElement>(null);
  const [indice, setIndice] = useState(0);

  // El índice sale del DOM y no de una prop: así los pasos condicionales
  // (`{tipo === "x" && <PasoFormulario …>}`) se renumeran solos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!contexto || !propio.current) return;
    const posicion = pasosDe(contexto.raiz.current).indexOf(propio.current);
    if (posicion !== -1) setIndice(posicion);
  });

  const escondido = Boolean(contexto?.guiado) && indice !== contexto?.actual;

  return (
    <section
      ref={propio}
      data-paso-formulario=""
      data-titulo={titulo}
      hidden={escondido}
      aria-label={titulo}
      className={cn("space-y-4", className)}
    >
      <h3 className="text-sm font-semibold text-tinta">{titulo}</h3>
      {children}
    </section>
  );
}

/**
 * Los botones finales (Cancelar, Guardar…). En modo guiado se cambian por
 * Anterior / Siguiente hasta el último paso, donde aparecen junto a Anterior.
 */
export function AccionesFormulario({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("common.formularioGuiado");
  const contexto = useContext(ContextoGuiado);

  if (!contexto?.guiado) return <>{children}</>;

  const { actual, total, ir } = contexto;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-t border-linea pt-4", className)}>
      {actual > 0 && (
        <Button type="button" variant="outline" onClick={() => ir(actual - 1)}>
          <ChevronLeft className="size-4" />
          {t("anterior")}
        </Button>
      )}

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {actual >= total - 1 ? (
          children
        ) : (
          <Button type="button" onClick={() => ir(actual + 1)}>
            {t("siguiente")}
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
