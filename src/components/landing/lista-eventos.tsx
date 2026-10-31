"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  GraduationCap,
  Handshake,
  LayoutGrid,
  MapPin,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  CabeceraIcono,
  Carrusel,
  ElementoCarrusel,
  TarjetaAnuncio,
} from "@/components/landing/piezas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipFiltro } from "@/components/ui/chip-filtro";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { FilaChips } from "@/components/ui/fila-chips";
import { Input } from "@/components/ui/input";

/**
 * Lista de eventos con buscador y filtro por tipo.
 *
 * El texto de "cuándo" —Hoy, Mañana, En N días— llega ya resuelto desde el
 * servidor. Calcularlo aquí obligaría a comparar con la fecha del navegador y
 * el primer render discordaría con el del servidor; además así no hay que
 * mandar los mensajes de plural al cliente.
 *
 * Filtrar y buscar sí es cosa del cliente: son pocos eventos y responder al
 * teclear sin ir al servidor es justo lo que se espera.
 */

export type EventoListado = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  tipoEtiqueta: string;
  ubicacion: string | null;
  fechaTexto: string;
  cuando: string;
};

/**
 * Icono por tipo de evento, para la fila de chips y la cabecera de la tarjeta.
 *
 * Antes cada tipo tenía su color y eran cuatro matices fuera de marca en la
 * página más visitada. Ahora el tipo lo dicen la palabra y el icono, y el
 * color es siempre el de la Fundación.
 */
const ICONO_POR_TIPO: Record<string, LucideIcon> = {
  academico: GraduationCap,
  administrativo: Briefcase,
  social: Users,
  reunion: Handshake,
  otro: CalendarDays,
};

export function ListaEventos({
  eventos,
  textos,
}: {
  eventos: readonly EventoListado[];
  textos: {
    buscar: string;
    todos: string;
    etiquetaFiltro: string;
    sinResultados: string;
    limpiar: string;
    /** Plantilla con `{n}` y `{total}`. */
    cuenta: string;
  };
}) {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);

  // Los tipos que de verdad aparecen, no los cinco del catálogo: un filtro que
  // siempre da vacío es ruido.
  const tipos = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const evento of eventos) vistos.set(evento.tipo, evento.tipoEtiqueta);
    return [...vistos];
  }, [eventos]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return eventos.filter((evento) => {
      if (tipo && evento.tipo !== tipo) return false;
      if (!texto) return true;

      return (
        evento.titulo.toLowerCase().includes(texto) ||
        (evento.ubicacion ?? "").toLowerCase().includes(texto)
      );
    });
  }, [eventos, busqueda, tipo]);

  return (
    <div className="mt-6">
      <FilaChips etiqueta={textos.etiquetaFiltro}>
        <ChipFiltro
          icono={LayoutGrid}
          etiqueta={textos.todos}
          activo={tipo === null}
          onClick={() => setTipo(null)}
        />
        {tipos.map(([valor, etiqueta]) => (
          <ChipFiltro
            key={valor}
            icono={ICONO_POR_TIPO[valor] ?? CalendarDays}
            etiqueta={etiqueta}
            activo={tipo === valor}
            onClick={() => setTipo(valor)}
          />
        ))}
      </FilaChips>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-tinta-3" />
          <Input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder={textos.buscar}
            aria-label={textos.buscar}
            className="rounded-full pl-10"
          />
        </div>

        <p className="texto-meta" aria-live="polite">
          {textos.cuenta
            .replace("{n}", String(visibles.length))
            .replace("{total}", String(eventos.length))}
        </p>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio
          icono={CalendarDays}
          titulo={textos.sinResultados}
          className="mt-6"
          accion={
            <Button
              variant="secondary"
              onClick={() => {
                setTipo(null);
                setBusqueda("");
              }}
            >
              {textos.limpiar}
            </Button>
          }
        />
      ) : (
        <div className="mt-6">
          <Carrusel>
            {visibles.map((evento) => (
              <ElementoCarrusel key={evento.id}>
                <TarjetaAnuncio
                  cabecera={
                    <CabeceraIcono icono={ICONO_POR_TIPO[evento.tipo] ?? CalendarDays} />
                  }
                  insignia={<Badge variant="solida">{evento.cuando}</Badge>}
                  titulo={evento.titulo}
                  lineas={[`${evento.fechaTexto} · ${evento.tipoEtiqueta}`]}
                  pie={
                    evento.ubicacion && (
                      <p className="flex items-center gap-1.5 text-sm text-tinta-2">
                        <MapPin className="size-4 shrink-0 text-marca-600" />
                        <span className="truncate">{evento.ubicacion}</span>
                      </p>
                    )
                  }
                />
              </ElementoCarrusel>
            ))}
          </Carrusel>
        </div>
      )}
    </div>
  );
}
