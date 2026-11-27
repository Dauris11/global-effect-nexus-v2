"use client";

import { useSearchParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Selector de mes del encabezado: escribe `?mes=YYYY-MM` en la URL al elegir (filtro en vivo, sin botón
 * «Aplicar»). Conserva el resto de parámetros salvo la página.
 */
export function SelectorMes({ meses, valor, etiqueta }: { meses: readonly string[]; valor: string; etiqueta: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();

  return (
    <label className="text-label flex items-center gap-2">
      <span className="sr-only md:not-sr-only">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => {
          const nuevos = new URLSearchParams(parametros.toString());
          nuevos.set("mes", e.target.value);
          nuevos.delete("pagina");
          router.replace(`${ruta}?${nuevos}`, { scroll: false });
        }}
        className="h-9 rounded-control border border-linea-fuerte bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {meses.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}
