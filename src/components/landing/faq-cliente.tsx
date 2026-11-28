"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Mejora progresiva de las preguntas frecuentes.
 *
 * Todas las preguntas ya vienen en el HTML del servidor (se leen sin JS y las
 * ve un buscador). Aquí solo se oculta y se muestra lo que ya existe: por eso el
 * filtro manipula el DOM de la lista en vez de recibir las preguntas por props;
 * si las recibiera, tendría que serializarlas dos veces.
 */

/** Sin acentos ni mayúsculas: «contrasena» tiene que encontrar «contraseña». */
function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function FiltroFaq({
  categorias,
  etiquetaTodas,
  etiquetaBuscar,
  placeholder,
}: {
  categorias: readonly { id: string; etiqueta: string }[];
  etiquetaTodas: string;
  etiquetaBuscar: string;
  placeholder: string;
}) {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const montado = useRef(false);

  useEffect(() => {
    const lista = document.getElementById("faq-lista");
    const vacio = document.getElementById("faq-vacio");
    if (!lista) return;

    // Sin filtro activo no se toca nada: el estado del servidor ya es el correcto.
    if (!montado.current) {
      montado.current = true;
      if (!texto && categoria === "todas") return;
    }

    const busqueda = normalizar(texto.trim());
    let visibles = 0;

    lista.querySelectorAll<HTMLElement>("[data-faq]").forEach((pregunta) => {
      const coincideCategoria = categoria === "todas" || pregunta.dataset.categoria === categoria;
      const coincideTexto = !busqueda || normalizar(pregunta.dataset.texto ?? "").includes(busqueda);
      const mostrar = coincideCategoria && coincideTexto;

      pregunta.hidden = !mostrar;
      if (mostrar) visibles += 1;
    });

    if (vacio) vacio.hidden = visibles > 0;
  }, [texto, categoria]);

  return (
    <div className="mt-6 space-y-4">
      <label className="relative block">
        <span className="sr-only">{etiquetaBuscar}</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta-3" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-control border border-input bg-card pr-3 pl-10 text-sm text-tinta outline-none transition-shadow duration-[160ms] placeholder:text-tinta-3 focus-visible:border-marca-500 focus-visible:ring-3 focus-visible:ring-marca-500/25"
        />
      </label>

      <div className="flex flex-wrap gap-2" role="group" aria-label={etiquetaBuscar}>
        {[{ id: "todas", etiqueta: etiquetaTodas }, ...categorias].map((c) => {
          const activa = categoria === c.id;

          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={activa}
              onClick={() => setCategoria(c.id)}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                activa
                  ? "border-tinta bg-tinta text-background"
                  : "border-linea text-tinta-2 hover:border-linea-fuerte hover:text-tinta",
              )}
            >
              {c.etiqueta}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Acordeón y ancla de las preguntas, por delegación sobre `#faq-lista`.
 *
 * Las preguntas son de servidor y no se vuelven a serializar: este componente solo pone y quita
 * `data-abierta` en cada pregunta, y el CSS (`landing.css`) despliega la respuesta con
 * `grid-template-rows` 0fr -> 1fr. Sin JavaScript no hay clase `js`, nada se pliega y todas las
 * respuestas están a la vista.
 *
 * Una respuesta cerrada lleva `inert`: sigue en el DOM (la leen los buscadores) pero su enlace no
 * recibe foco ni la anuncia un lector de pantalla. Abrir con el enlace compartido
 * (`/#faq-olvide-contrasena`) también despliega la pregunta y la resalta.
 */
function fijarAbierta(pregunta: HTMLElement, abierta: boolean) {
  pregunta.dataset.abierta = String(abierta);
  pregunta.querySelector("[data-faq-boton]")?.setAttribute("aria-expanded", String(abierta));
  pregunta.querySelector<HTMLElement>("[data-faq-contenido]")?.toggleAttribute("inert", !abierta);
}

export function AcordeonFaq() {
  useEffect(() => {
    const lista = document.getElementById("faq-lista");
    if (!lista) return;

    // Estado de partida: lo cerrado queda inerte. Se hace aquí y no en el HTML para que sin JS
    // todas las respuestas sigan siendo alcanzables.
    lista.querySelectorAll<HTMLElement>("[data-faq]").forEach((p) => fijarAbierta(p, p.dataset.abierta === "true"));

    const alPulsar = (evento: Event) => {
      const boton = (evento.target as HTMLElement).closest("[data-faq-boton]");
      const pregunta = boton?.closest<HTMLElement>("[data-faq]");
      if (!pregunta) return;

      fijarAbierta(pregunta, pregunta.dataset.abierta !== "true");
    };

    lista.addEventListener("click", alPulsar);

    let temporizador: ReturnType<typeof setTimeout> | undefined;

    function abrirDesdeHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("faq-")) return;

      const pregunta = document.getElementById(id);
      if (!pregunta?.matches("[data-faq]")) return;

      // Si un filtro la había ocultado, el enlace compartido manda.
      pregunta.hidden = false;
      fijarAbierta(pregunta, true);
      pregunta.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      pregunta.setAttribute("data-resaltada", "");

      clearTimeout(temporizador);
      temporizador = setTimeout(() => pregunta.removeAttribute("data-resaltada"), 2400);
    }

    abrirDesdeHash();
    window.addEventListener("hashchange", abrirDesdeHash);

    return () => {
      lista.removeEventListener("click", alPulsar);
      window.removeEventListener("hashchange", abrirDesdeHash);
      clearTimeout(temporizador);
    };
  }, []);

  return null;
}
