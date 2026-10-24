import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Monto } from "@/components/contabilidad/comun";
import type { TotalesLibro } from "@/server/contabilidad/libros/consultas";

/**
 * Lo que comparten los tres libros: la fila de totales y el aviso de
 * descuadre. El aviso va ARRIBA y en tinta, no al pie: si debe ≠ haber, la
 * base se tocó por fuera de la partida doble y nada de lo que sigue en la
 * pantalla es confiable.
 */
export async function AvisoDescuadre({ totales }: { totales: TotalesLibro }) {
  if (totales.diferencia === "0.00") return null;
  const t = await getTranslations("contab.libros");

  return (
    <div role="alert" className="flex items-start gap-3 rounded-card bg-tinta p-4 text-background">
      <AlertCircle className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">
          {t("descuadre.titulo")}{" "}
          <Monto valor={totales.diferencia} moneda="DOP" />
        </p>
        <p className="mt-1 text-sm opacity-90">{t("descuadre.texto")}</p>
      </div>
    </div>
  );
}

export function ResumenTotales({
  celdas,
}: {
  celdas: { clave: string; etiqueta: string; valor: string; nota?: string }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {celdas.map((c) => (
        <div key={c.clave} className="rounded-card border border-linea bg-card p-4 shadow-card">
          <dt className="texto-meta">{c.etiqueta}</dt>
          <dd className="mt-1 text-lg font-semibold text-tinta sm:text-xl">
            <Monto valor={c.valor} moneda="DOP" />
          </dd>
          {c.nota && <dd className="texto-meta">{c.nota}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Celda de monto de tabla: vacía si es cero, como en un libro en papel. */
export function CeldaMonto({ valor, className }: { valor: string; className?: string }) {
  if (/^-?0+(\.0+)?$/.test(valor)) return <td className={className} />;
  return (
    <td className={className}>
      <Monto valor={valor} moneda="DOP" />
    </td>
  );
}
