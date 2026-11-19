import { cn } from "@/lib/utils";

/** Una sección de la ficha: título y, debajo, sus datos. */
export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 space-y-3">
      <h2 className="texto-titulo-seccion">{titulo}</h2>
      <div className="rounded-card border border-linea bg-card p-5">{children}</div>
    </section>
  );
}

export type FilaFicha = {
  etiqueta: string;
  valor: React.ReactNode;
  /** Texto largo: ocupa todo el ancho y respeta los saltos de línea. */
  largo?: boolean;
};

const VACIO = "—";

/**
 * Datos en lista de definición. Un dato sin valor se enseña con una raya y no se
 * esconde: en un expediente, «no hay» también es información (y se nota qué falta).
 */
export function Filas({ filas }: { filas: readonly FilaFicha[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {filas.map((f) => {
        const vacio = f.valor === null || f.valor === undefined || f.valor === "";

        return (
          <div key={f.etiqueta} className={cn("min-w-0", f.largo && "sm:col-span-2")}>
            <dt className="texto-meta font-medium">{f.etiqueta}</dt>
            <dd className={cn("mt-0.5 text-[15px] break-words", f.largo && "whitespace-pre-wrap", vacio && "text-tinta-3")}>
              {vacio ? VACIO : f.valor}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card border border-linea bg-card p-4 text-sm text-tinta-2">{children}</p>;
}
