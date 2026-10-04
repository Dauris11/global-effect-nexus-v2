import { Clock, MapPin, User } from "lucide-react";

import { visualDeInscripcion } from "@/components/estudiante/prematricula-estado";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { InscripcionDelEstudiante } from "@/server/estudiantes/academico";

/**
 * Las materias de un período de la matrícula: tabla limpia en escritorio y
 * tarjetas en el teléfono (docs/09-sistema-visual.md §4.6).
 *
 * Sale de la página para que la página quede por debajo de 300 líneas. Recibe
 * los textos ya traducidos: la página tiene el único `t` del espacio
 * `studentPortal`, y el estado de cada fila llega traducido en `estados`.
 */
export type PeriodoMatricula = {
  id: string;
  nombre: string;
  estado: string;
  fechaInicio: string | null;
  filas: InscripcionDelEstudiante[];
};

export type TextosPeriodo = {
  activo: string;
  resumen: string;
  inicio: string | null;
  columnas: {
    materia: string;
    horario: string;
    aula: string;
    profesor: string;
    creditos: string;
    estado: string;
  };
  /** "4 cr." por fila, ya traducido. */
  creditos: (n: number) => string;
  /** El estado de la inscripción, ya traducido. */
  estado: (estado: string) => string;
};

export function PeriodoInscripciones({
  periodo,
  textos,
}: {
  periodo: PeriodoMatricula;
  textos: TextosPeriodo;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="texto-titulo-tarjeta text-lg">{periodo.nombre}</h3>
        {periodo.estado === "activo" && (
          <Badge variant="marca">{textos.activo}</Badge>
        )}
        <span className="texto-meta md:ml-auto">{textos.resumen}</span>
      </div>

      {/* El contenedor se desplaza de lado si una columna no cabe (un nombre
          de profesor larguísimo en una tableta), en vez de empujar la página. */}
      <div className="sin-barra hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="texto-meta border-b border-linea text-left">
              <th className="h-10 pr-4 font-medium">
                {textos.columnas.materia}
              </th>
              <th className="h-10 pr-4 font-medium">
                {textos.columnas.horario}
              </th>
              <th className="h-10 pr-4 font-medium">{textos.columnas.aula}</th>
              <th className="h-10 pr-4 font-medium">
                {textos.columnas.profesor}
              </th>
              <th className="h-10 pr-4 text-right font-medium">
                {textos.columnas.creditos}
              </th>
              <th className="h-10 text-right font-medium">
                {textos.columnas.estado}
              </th>
            </tr>
          </thead>
          <tbody>
            {periodo.filas.map((fila) => (
              <tr
                key={fila.id}
                className="h-14 border-b border-linea transition-colors hover:bg-muted/50"
              >
                <td className="py-2 pr-4">
                  <p className="font-medium text-tinta">{fila.materia}</p>
                  {fila.codigo && <p className="texto-meta">{fila.codigo}</p>}
                </td>
                <td className="py-2 pr-4 text-tinta-2">
                  {fila.horario ?? "—"}
                </td>
                <td className="py-2 pr-4 text-tinta-2">{fila.aula ?? "—"}</td>
                <td className="py-2 pr-4 text-tinta-2">
                  {fila.profesor ?? "—"}
                </td>
                <td className="py-2 pr-4 text-right text-tinta-2 tabular-nums">
                  {fila.creditos ?? "—"}
                </td>
                <td className="py-2 text-right">
                  <Estado
                    estado={fila.estado}
                    etiqueta={textos.estado(fila.estado)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {periodo.filas.map((fila) => (
          <li key={fila.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="texto-titulo-tarjeta">{fila.materia}</p>
                  <p className="texto-meta">
                    {[
                      fila.codigo,
                      fila.creditos !== null
                        ? textos.creditos(fila.creditos)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Estado
                  estado={fila.estado}
                  etiqueta={textos.estado(fila.estado)}
                />
              </div>

              {/* Horario, aula y profesor solo si existen: la materia los tiene
                  como opcionales y una línea con guiones no informa de nada. */}
              {(fila.horario || fila.aula || fila.profesor) && (
                <div className="mt-3 flex flex-col gap-1.5 text-sm text-tinta-2">
                  {fila.horario && <Dato icono={Clock}>{fila.horario}</Dato>}
                  {fila.aula && <Dato icono={MapPin}>{fila.aula}</Dato>}
                  {fila.profesor && <Dato icono={User}>{fila.profesor}</Dato>}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {textos.inicio && <p className="texto-meta">{textos.inicio}</p>}
    </section>
  );
}

function Estado({ estado, etiqueta }: { estado: string; etiqueta: string }) {
  const visual = visualDeInscripcion(estado);
  const Icono = visual.icono;

  return (
    <Badge className={visual.clases}>
      <Icono aria-hidden />
      {etiqueta}
    </Badge>
  );
}

function Dato({
  icono: Icono,
  children,
}: {
  icono: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icono className="size-4 shrink-0 text-tinta-3" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
