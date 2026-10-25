"use client";

import { Check, Moon, PanelLeft, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { BARRAS, COLORES_MINIATURA, TEMAS, type Barra, type Tema } from "@/lib/apariencia";
import { cn } from "@/lib/utils";

import { useApariencia } from "./usar-apariencia";

/**
 * Elegir cómo se ve el portal: tema y barra lateral. Cada opción es una
 * miniatura de lo que va a pasar, porque "barra negra" dice menos que verla.
 */
export function SelectorApariencia() {
  const t = useTranslations("profile.appearance");
  const { tema, barra, cambiar } = useApariencia();

  return (
    <div className="space-y-6">
      <Grupo titulo={t("theme")} ayuda={t("themeHint")}>
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

      <Grupo titulo={t("sidebar")} ayuda={t("sidebarHint")}>
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
    </div>
  );
}

function Grupo({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{titulo}</legend>
      <p className="texto-meta mt-0.5">{ayuda}</p>
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
