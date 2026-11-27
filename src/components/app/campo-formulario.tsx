"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de formulario con la etiqueta SIEMPRE visible (el placeholder es solo un ejemplo
 * de formato) y validación al salir del campo (blur): el error aparece al perder el foco y
 * se limpia en cuanto se corrige. `validar` devuelve el texto del error o `null`.
 */
export function CampoFormulario({
  etiqueta,
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  requerido = false,
  validar,
  className,
  mono = false,
  maxLength,
}: {
  etiqueta: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (valor: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  requerido?: boolean;
  validar?: (valor: string) => string | null;
  className?: string;
  mono?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const comprobar = (valor: string) => (validar ? validar(valor.trim()) : null);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-label text-tinta">
        {etiqueta}
        {requerido && <span aria-hidden className="text-tinta-3"> *</span>}
      </label>
      <Input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={requerido}
        maxLength={maxLength}
        placeholder={placeholder}
        {...(value !== undefined ? { value } : { defaultValue })}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn("h-10 text-sm", mono && "font-mono")}
        onChange={(e) => {
          onChange?.(e.target.value);
          // El error se limpia al corregir, sin esperar al siguiente blur.
          if (error && !comprobar(e.target.value)) setError(null);
        }}
        onBlur={(e) => setError(comprobar(e.target.value))}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-meta text-status-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
