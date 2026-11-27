"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";

export type CampoUrl = { param: string; label: string; tipo: "date" | "text" | "number" };

const RETARDO_MS = 400;

/**
 * Campos libres para «Más filtros» (fechas, montos, número): escriben en la
 * URL al cambiar, sin botón «Aplicar». La fecha se aplica al instante; el
 * texto, 400 ms después de la última tecla. Va dentro del popover de
 * `FilterBar`, que ya está en un `<Suspense>`.
 */
export function CamposUrl({ campos }: { campos: readonly CampoUrl[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  // Solo se guarda lo que se está escribiendo; lo demás se lee de la URL, así
  // «Quitar filtros» vacía los campos sin sincronizar estado a mano.
  const [edicion, setEdicion] = useState<Record<string, string>>({});
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const escribir = (param: string, valor: string) => {
    const nuevos = new URLSearchParams(parametros.toString());

    if (valor) nuevos.set(param, valor);
    else nuevos.delete(param);
    nuevos.delete("pagina");
    router.replace(`${pathname}${nuevos.size ? `?${nuevos}` : ""}`, { scroll: false });
    setEdicion(({ [param]: _omitido, ...resto }) => resto);
  };

  const cambiar = (campo: CampoUrl, valor: string) => {
    setEdicion((v) => ({ ...v, [campo.param]: valor }));
    if (temporizador.current) clearTimeout(temporizador.current);
    if (campo.tipo === "date") escribir(campo.param, valor);
    else temporizador.current = setTimeout(() => escribir(campo.param, valor.trim()), RETARDO_MS);
  };

  return (
    <>
      {campos.map((c) => (
        <label key={c.param} className="text-label block space-y-1.5">
          {c.label}
          <Input
            type={c.tipo === "number" ? "text" : c.tipo}
            inputMode={c.tipo === "number" ? "decimal" : undefined}
            value={edicion[c.param] ?? parametros.get(c.param) ?? ""}
            onChange={(e) => cambiar(c, e.target.value)}
            className="h-9 text-sm"
          />
        </label>
      ))}
    </>
  );
}
