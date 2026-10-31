"use client";

import { useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useOcultos } from "@/components/layout/visibilidad";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Link, useRouter } from "@/i18n/navigation";
import { itemsDeArea, menuDe } from "@/lib/nav";
import type { Rol } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * Buscador de comandos (Cmd/Ctrl+K): escribe y salta a una pantalla.
 *
 * Busca sobre `menuDe(rol)` —el mismo menú de la barra lateral, ya filtrado por
 * permiso—, así que nunca ofrece una puerta que el servidor vaya a cerrar.
 * Cada resultado dice además en qué área vive, porque "Calificaciones" está en
 * Académico y quien busca no tiene por qué saberlo.
 *
 * Flechas para moverse, Enter para ir. La lista sigue siendo de enlaces de
 * verdad: con Tab y un lector de pantalla funciona igual.
 */
export function BuscadorComandos({
  abierto,
  onCambiar,
  rol,
}: {
  abierto: boolean;
  onCambiar: (abierto: boolean) => void;
  rol: Rol;
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [termino, setTermino] = useState("");
  const [elegido, setElegido] = useState(0);

  const ocultos = useOcultos();
  const todos = menuDe(rol, ocultos).flatMap((area) =>
    itemsDeArea(area).map((item) => ({ ...item, area: area.etiqueta })),
  );
  const buscado = normalizar(termino);
  const resultados = todos.filter(
    (item, indice) =>
      // Un mismo destino puede salir en dos áreas; se ofrece una vez.
      todos.findIndex((otro) => otro.href === item.href) === indice &&
      (!buscado ||
        normalizar(t(item.etiqueta)).includes(buscado) ||
        normalizar(t(item.area)).includes(buscado)),
  );

  const cerrar = (valor: boolean) => {
    onCambiar(valor);
    if (!valor) {
      setTermino("");
      setElegido(0);
    }
  };

  const ir = (href: string) => {
    cerrar(false);
    router.push(href);
  };

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      {/*
        Sin animación en escritorio: es la paleta de ⌘K y se abre decenas de
        veces al día desde el teclado. Cualquier entrada, por corta que sea, se
        siente como esperar. En móvil se abre con el dedo y sí sube.
      */}
      <DialogContent
        className="gap-0 p-0 md:max-w-xl md:pt-0 md:data-[state=open]:animate-none md:data-[state=closed]:animate-none"
        mostrarCerrar={false}
      >
        <DialogTitle className="sr-only">{t("commandOpen")}</DialogTitle>

        <div className="flex items-center gap-3 border-b border-linea px-5">
          <Search className="size-5 shrink-0 text-tinta-2" />
          <input
            autoFocus
            value={termino}
            onChange={(evento) => {
              setTermino(evento.target.value);
              setElegido(0);
            }}
            onKeyDown={(evento) => {
              if (evento.key === "ArrowDown") {
                evento.preventDefault();
                setElegido((i) => Math.min(i + 1, resultados.length - 1));
              } else if (evento.key === "ArrowUp") {
                evento.preventDefault();
                setElegido((i) => Math.max(i - 1, 0));
              } else if (evento.key === "Enter" && resultados[elegido]) {
                evento.preventDefault();
                ir(resultados[elegido].href);
              }
            }}
            placeholder={t("commandPlaceholder")}
            aria-label={t("commandPlaceholder")}
            className="h-16 min-w-0 flex-1 bg-transparent text-base text-tinta outline-none placeholder:text-tinta-3"
          />
        </div>

        <ul className="max-h-[60dvh] overflow-y-auto p-2">
          {resultados.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-tinta-2">{t("commandEmpty")}</li>
          )}
          {resultados.map((item, indice) => {
            const Icono = item.icono;
            const activo = indice === elegido;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => cerrar(false)}
                  onMouseEnter={() => setElegido(indice)}
                  className={cn(
                    "flex h-14 items-center gap-3 rounded-control px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activo && "bg-muted",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-tinta">
                    <Icono className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-tinta">
                      {t(item.etiqueta)}
                    </span>
                    <span className="texto-meta block truncate">{t(item.area)}</span>
                  </span>
                  {activo && <CornerDownLeft className="size-4 shrink-0 text-tinta-3" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Minúsculas y sin tildes: "academico" encuentra "Académico". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
