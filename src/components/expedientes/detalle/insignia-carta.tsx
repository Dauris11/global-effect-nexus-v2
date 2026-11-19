import { AlertCircle, CheckCircle2, Clock, Minus, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import type { EstadoCarta } from "@/lib/correos-patrocinador";

const VISUAL = {
  cumplio: { icono: CheckCircle2, variante: "marca" },
  en_revision: { icono: Clock, variante: "neutra" },
  tardia: { icono: AlertCircle, variante: "solida" },
  no_envio: { icono: XCircle, variante: "solida" },
  no_aplica: { icono: Minus, variante: "neutra" },
} as const;

/** Estado de la carta al patrocinador, con icono y texto (no depende del color). */
export async function InsigniaCarta({ estado }: { estado: EstadoCarta }) {
  const t = await getTranslations("sponsorMail.letterStatus");
  const { icono: Icono, variante } = VISUAL[estado];

  return (
    <Badge variant={variante} className="gap-1">
      <Icono className="size-3" />
      {t(estado)}
    </Badge>
  );
}
