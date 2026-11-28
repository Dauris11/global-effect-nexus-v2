"use client";

import { Check, Copy, Map as IconoMapa } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * «Copiar dirección» → «Copiada ✓» durante 1,6 s. El botón es la región `aria-live="polite"`:
 * existe desde el primer pintado y solo cambia su texto, que es lo que un lector de pantalla
 * anuncia (una región creada junto con el mensaje no se anuncia de forma fiable).
 */
export function BotonCopiar({
  texto,
  etiqueta,
  etiquetaCopiada,
}: {
  texto: string;
  etiqueta: string;
  etiquetaCopiada: string;
}) {
  const [copiada, setCopiada] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin permiso del portapapeles no hay nada útil que mostrar: no se finge que se copió.
      return;
    }
    setCopiada(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiada(false), 1600);
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copiar} aria-live="polite">
      {copiada ? <Check /> : <Copy />}
      {copiada ? etiquetaCopiada : etiqueta}
    </Button>
  );
}

/**
 * El iframe de Google Maps pesa varios cientos de KB y rastrea: solo se carga
 * si la persona lo pide. El mapa propio ya responde a «¿dónde queda?».
 */
export function MapaInteractivo({
  latitud,
  longitud,
  etiqueta,
  titulo,
}: {
  latitud: number;
  longitud: number;
  etiqueta: string;
  titulo: string;
}) {
  const [cargado, setCargado] = useState(false);

  if (!cargado) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setCargado(true)}>
        <IconoMapa />
        {etiqueta}
      </Button>
    );
  }

  return (
    <iframe
      title={titulo}
      src={`https://www.google.com/maps?q=${latitud},${longitud}&z=15&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="h-72 w-full rounded-card border border-linea"
    />
  );
}
