"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { SELECT } from "@/components/contabilidad/comun";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OpcionCuenta } from "@/server/contabilidad/libros/consultas";

/**
 * Cuenta del mayor: un buscador que estrecha un `<select>` nativo. Nativo
 * porque el formulario es GET y debe funcionar sin hidratar; el buscador
 * solo filtra, y la cuenta elegida queda siempre en la lista para que
 * escribir no la deseleccione.
 *
 * Las cuentas de grupo se listan también: su mayor agrega el de sus hijas.
 */
export function SelectorCuenta({ cuentas, valor }: { cuentas: OpcionCuenta[]; valor: string | null }) {
  const t = useTranslations("contab.libros.filtros");
  const [texto, setTexto] = useState("");
  const [elegida, setElegida] = useState(valor ?? "");

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return cuentas;
    return cuentas.filter(
      (c) => c.id === elegida || c.codigo.startsWith(q) || c.nombre.toLowerCase().includes(q),
    );
  }, [cuentas, texto, elegida]);

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label htmlFor="libros-buscar-cuenta" className="text-sm font-medium text-tinta">
        {t("cuenta")}
      </label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Input
          id="libros-buscar-cuenta"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t("buscarCuenta")}
          aria-controls="libros-cuenta"
        />
        <select
          id="libros-cuenta"
          name="cuenta"
          value={elegida}
          onChange={(e) => setElegida(e.target.value)}
          aria-label={t("cuenta")}
          className={cn(SELECT, "h-12")}
        >
          <option value="">{t("elegirCuenta")}</option>
          {visibles.map((c) => (
            <option key={c.id} value={c.id}>
              {/* Sangría con espacios duros: un <option> no admite estilos de margen. */}
              {`${"  ".repeat(c.nivel)}${c.codigo} · ${c.nombre}${c.admiteMovimiento ? "" : ` (${t("grupo")})`}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
