"use client";

import { Check, LayoutList, ListOrdered, Moon, PanelLeft, Palette, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { useModoFormulario } from "@/components/ui/formulario-guiado";
import { MODOS_FORMULARIO } from "@/lib/modo-formulario";

import {
  ACENTOS,
  BARRAS,
  COLORES_ACENTO,
  COLORES_MINIATURA,
  TEMAS,
  type Barra,
  type Tema,
} from "@/lib/apariencia";
import { cn } from "@/lib/utils";

import { useApariencia } from "./usar-apariencia";

/**
 * Elegir cómo se ve el portal: tema y barra lateral. Cada opción es una
 * miniatura de lo que va a pasar, porque "barra negra" dice menos que verla.
 */
export function SelectorApariencia() {
  const t = useTranslations("profile.appearance");
  const { tema, barra, acento, cambiar } = useApariencia();
  const { modo: modoFormulario, cambiar: cambiarModo } = useModoFormulario();

  return (
    <div className="space-y-6">
      <Grupo titulo={t("theme")}>
        {TEMAS.map((valor) => (
          <Opcion
            key={valor}
            activa={tema === valor}
            etiqueta={t(`themes.${valor}`)}
            icono={valor === "claro" ? Sun : Moon}
            onElegir={() => cambiar({ tema: valor })}
          >
            <Miniatura tema={valor} barra={barra} />
          </Opcion>
        ))}
      </Grupo>

      <Grupo titulo={t("accent")}>
        {ACENTOS.map((valor) => (
          <Opcion
            key={valor}
            activa={acento === valor}
            etiqueta={t(`accents.${valor}`)}
            icono={Palette}
            onElegir={() => cambiar({ acento: valor })}
          >
            <span
              aria-hidden
              className="flex h-20 items-center justify-center rounded-control border border-linea bg-background"
            >
              <span
                className="size-10 rounded-full"
                style={{ background: COLORES_ACENTO[valor] }}
              />
            </span>
          </Opcion>
        ))}
      </Grupo>

      <Grupo titulo={t("sidebar")}>
        {BARRAS.map((valor) => (
          <Opcion
            key={valor}
            activa={barra === valor}
            etiqueta={t(`sidebars.${valor}`)}
            icono={PanelLeft}
            onElegir={() => cambiar({ barra: valor })}
          >
            <Miniatura tema={tema} barra={valor} />
          </Opcion>
        ))}
      </Grupo>

      <Grupo titulo={t("forms")}>
        {MODOS_FORMULARIO.map((valor) => (
          <Opcion
            key={valor}
            activa={modoFormulario === valor}
            etiqueta={t(`formModes.${valor}`)}
            icono={valor === "guiado" ? ListOrdered : LayoutList}
            onElegir={() => cambiarModo(valor)}
          >
            <MiniaturaFormulario guiado={valor === "guiado"} />
          </Opcion>
        ))}
      </Grupo>
    </div>
  );
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{titulo}</legend>
      <div className="mt-3 grid grid-cols-2 gap-3">{children}</div>
    </fieldset>
  );
}

function Opcion({
  activa,
  etiqueta,
  icono: Icono,
  onElegir,
  children,
}: {
  activa: boolean;
  etiqueta: string;
  icono: typeof Sun;
  onElegir: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={activa}
      className={cn(
        "rounded-card border p-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        activa ? "border-marca-500 ring-1 ring-marca-500" : "border-linea hover:border-linea-fuerte",
      )}
    >
      {children}

      <span className="mt-2 flex items-center gap-2 px-1 text-sm font-medium">
        <Icono className={cn("size-4", activa ? "text-marca-500" : "text-tinta-2")} />
        <span className="flex-1">{etiqueta}</span>
        {activa && <Check className="text-marca-500 size-4" />}
      </span>
    </button>
  );
}

/**
 * Maqueta de un formulario: todos los campos apilados, o uno solo con la barra
 * de pasos encima. Con tokens, porque enseña el tema vigente.
 */
function MiniaturaFormulario({ guiado }: { guiado: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-20 flex-col justify-center gap-1.5 rounded-control border border-linea bg-background px-3"
    >
      {guiado ? (
        <>
          <span className="flex gap-1">
            <span className="h-1 flex-1 rounded-full bg-marca-500" />
            <span className="h-1 flex-1 rounded-full bg-linea" />
            <span className="h-1 flex-1 rounded-full bg-linea" />
          </span>
          <span className="h-3 rounded-full border border-linea-fuerte" />
          <span className="ml-auto h-2.5 w-8 rounded-full bg-marca-500" />
        </>
      ) : (
        <>
          <span className="h-2.5 rounded-full border border-linea-fuerte" />
          <span className="h-2.5 rounded-full border border-linea-fuerte" />
          <span className="h-2.5 rounded-full border border-linea-fuerte" />
        </>
      )}
    </span>
  );
}

/**
 * Maqueta de la pantalla. Pinta con `COLORES_MINIATURA` y no con los tokens: los
 * tokens cambian con el tema vigente, y la miniatura "oscuro" tiene que verse
 * oscura aunque ahora mismo estés en claro.
 */
function Miniatura({ tema, barra }: { tema: Tema; barra: Barra }) {
  const c = COLORES_MINIATURA[tema];
  const negra = barra === "negra";

  return (
    <span
      aria-hidden
      className="flex h-20 overflow-hidden rounded-control border"
      style={{ background: c.lienzo, borderColor: c.trazo }}
    >
      <span
        className="flex w-1/4 flex-col gap-1.5 border-r p-2"
        style={{
          background: negra ? c.lateralNegra : c.lienzo,
          borderColor: negra ? c.trazoNegra : c.trazo,
        }}
      >
        <span className="bg-marca-500 h-1.5 rounded-full" />
        <span className="h-1.5 rounded-full" style={{ background: negra ? c.textoNegra : c.texto }} />
        <span className="h-1.5 rounded-full" style={{ background: negra ? c.textoNegra : c.texto }} />
      </span>

      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-2 w-1/2 rounded-full" style={{ background: c.texto }} />
        <span className="h-6 rounded-md" style={{ background: c.trazo }} />
      </span>
    </span>
  );
}
