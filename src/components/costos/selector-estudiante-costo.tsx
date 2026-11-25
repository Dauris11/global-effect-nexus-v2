"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import type { EstudianteParaCosto } from "@/server/costos/consultas";

const SELECTOR =
  "border-linea-fuerte rounded-control h-12 w-full border bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta sm:text-[15px] sm:max-w-md";

/** Elige a qué becado se le registra el costo; la elección vive en la URL (`?estudiante=`) para poder enlazarla. */
export function SelectorEstudianteCosto({
  estudiantes,
  seleccionado,
}: {
  estudiantes: EstudianteParaCosto[];
  seleccionado: string | null;
}) {
  const t = useTranslations("costs.register");
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="costo-estudiante">{t("student")}</Label>
      <select
        id="costo-estudiante"
        className={SELECTOR}
        value={seleccionado ?? ""}
        disabled={pendiente}
        onChange={(e) => {
          const id = e.target.value;
          iniciar(() => router.push(id ? `?estudiante=${encodeURIComponent(id)}` : "?"));
        }}
      >
        <option value="">{t("chooseStudent")}</option>
        {estudiantes.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
            {e.dias_transporte > 0 ? ` · ${t("usesTransport")}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
