import { CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import type { FilaPatrocinadorMes } from "@/server/correos/consultas";

const VISUAL = {
  cumplio: { icono: CheckCircle2, variante: "marca" },
  en_revision: { icono: Clock, variante: "neutra" },
  tardia: { icono: AlertCircle, variante: "solida" },
  no_envio: { icono: XCircle, variante: "solida" },
  no_aplica: { icono: Clock, variante: "neutra" },
} as const;

/**
 * Cada patrocinador con sus becados y el estado de la carta del mes. Un
 * patrocinador puede tener varios estudiantes: se agrupan bajo su nombre.
 */
export async function ResumenPorPatrocinador({ filas }: { filas: readonly FilaPatrocinadorMes[] }) {
  const t = await getTranslations("sponsorMail");

  const grupos = new Map<string, { nombre: string; idioma: string; filas: FilaPatrocinadorMes[] }>();

  for (const fila of filas) {
    const grupo = grupos.get(fila.patrocinador_id) ?? {
      nombre: fila.patrocinador,
      idioma: fila.idioma,
      filas: [],
    };

    grupo.filas.push(fila);
    grupos.set(fila.patrocinador_id, grupo);
  }

  return (
    <div className="space-y-4">
      {[...grupos.entries()].map(([id, grupo]) => (
        <div key={id} className="rounded-card border border-linea p-4">
          <p className="text-[15px] font-semibold">
            {grupo.nombre} <span className="texto-meta font-normal">· {grupo.idioma.toUpperCase()}</span>
          </p>
          <ul className="mt-2 divide-y divide-linea">
            {grupo.filas.map((fila) => {
              const { icono: Icono, variante } = VISUAL[fila.correo];

              return (
                <li key={fila.estudiante_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{fila.estudiante}</span>
                  <Badge variant={variante} className="gap-1 shrink-0">
                    <Icono className="size-3" />
                    {t(`letterStatus.${fila.correo}`)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
