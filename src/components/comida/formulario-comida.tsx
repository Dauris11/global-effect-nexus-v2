"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  inscribirseAComida,
  type EstadoComida,
} from "@/server/comida/acciones";

/**
 * Formulario de inscripción al almuerzo.
 *
 * Los cuatro resultados posibles llegan como estado desde la Server Action, no
 * como excepción: "ya estás inscrito" y "cerró la inscripción" son respuestas
 * normales del sistema, no errores.
 *
 * Los textos vienen por props para no arrastrar el espacio `comida` al
 * navegador.
 */
export function FormularioComida({
  abierto,
  textos,
}: {
  /** Calculado en el servidor con la hora de la base. */
  abierto: boolean;
  textos: {
    nombre: string;
    enviar: string;
    ok: string;
    duplicado: string;
    fueraDeHora: string;
    invalido: string;
    cerrado: string;
  };
}) {
  const [estado, enviar, enviando] = useActionState<EstadoComida, FormData>(
    inscribirseAComida,
    { estado: "inicial" },
  );

  if (estado.estado === "ok") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#2096BA]/30 bg-[#2096BA]/10 p-4">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#187a99]" />
        <p className="text-sm font-semibold text-[#171A1D]">{textos.ok}</p>
      </div>
    );
  }

  const mensaje =
    estado.estado === "duplicado"
      ? textos.duplicado
      : estado.estado === "fuera_de_hora"
        ? textos.fueraDeHora
        : estado.estado === "invalido"
          ? textos.invalido
          : null;

  return (
    <form action={enviar} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="nombre">{textos.nombre}</Label>
        <Input
          id="nombre"
          name="nombre"
          required
          minLength={3}
          autoComplete="name"
          placeholder={textos.nombre}
          disabled={!abierto}
          aria-invalid={mensaje !== null || undefined}
        />
      </div>

      {mensaje && (
        <p
          role="alert"
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-medium",
            estado.estado === "duplicado"
              ? "bg-[#2096BA]/10 text-[#0a6a8a]"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {mensaje}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={enviando || !abierto}>
        {enviando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UtensilsCrossed className="size-4" />
        )}
        {abierto ? textos.enviar : textos.cerrado}
      </Button>
    </form>
  );
}
