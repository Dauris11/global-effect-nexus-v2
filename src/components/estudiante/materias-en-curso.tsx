import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  EnlaceSeccion,
  FILA,
  ICONO_FILA,
  Seccion,
} from "@/components/estudiante/seccion";
import { Badge } from "@/components/ui/badge";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { MateriaInscrita } from "@/server/estudiantes/portal";

/** Materias en curso del inicio del portal: una fila por materia. */
export async function MateriasEnCurso({
  materias,
}: {
  materias: readonly MateriaInscrita[];
}) {
  const t = await getTranslations("studentPortal");

  return (
    <Seccion
      titulo={t("subjectsTitle")}
      accion={
        <EnlaceSeccion
          href="/portal/estudiante/prematricula"
          texto={t("viewCatalog")}
        />
      }
    >
      {materias.length === 0 ? (
        <EstadoVacio
          icono={BookOpen}
          titulo={t("subjectsEmpty")}
          texto={t("subjectsEmptyHint")}
        />
      ) : (
        <ul>
          {materias.map((materia) => (
            <li key={materia.id} className={FILA}>
              <span className={ICONO_FILA}>
                <BookOpen className="size-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{materia.nombre}</p>
                <p className="truncate text-sm text-tinta-2">
                  {[materia.codigo, materia.horario, materia.profesor]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {materia.creditos !== null && (
                <Badge variant="neutra">
                  {t("creditsShort", { count: materia.creditos })}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}
