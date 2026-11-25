import { AlertTriangle, CheckCircle2, GraduationCap, HeartHandshake, Users, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { claveMes } from "@/lib/fechas";
import { INSIGNIA_SEMAFORO } from "@/lib/paleta";
import { cn } from "@/lib/utils";
import type { CondicionMes } from "@/server/estudiantes/portal";

type Nivel = "dentro" | "advertencia" | "alerta";

const ICONO_NIVEL: Record<Nivel, LucideIcon> = {
  dentro: CheckCircle2,
  advertencia: AlertTriangle,
  alerta: XCircle,
};

/**
 * ¿Mi beca está en riesgo? Tres cosas deciden si el estudiante la conserva —el
 * índice contra el mínimo, el servicio del mes y la reunión mensual— y antes
 * estaban en tres pantallas distintas. Aquí se ven juntas, con un veredicto.
 *
 * El nivel va siempre con su icono: el color solo no debe cargar el significado.
 * El mes en curso no puede estar «en alerta» por no tener todavía el servicio:
 * aún hay tiempo, así que es «pendiente» (advertencia) hasta que el mes cierre.
 */
export async function SemaforoBeca({
  indice,
  minimo,
  condicion,
}: {
  indice: number | null;
  minimo: number;
  condicion: readonly CondicionMes[];
}) {
  const t = await getTranslations("studentPortal.scholarship");
  const mes = claveMes();
  const delMes = condicion.find((m) => m.mes === mes);

  const nivelIndice: Nivel = indice === null ? "advertencia" : indice >= minimo ? "dentro" : "alerta";
  const nivelServicio: Nivel = delMes?.hizo_servicio ? "dentro" : "advertencia";
  const nivelReunion: Nivel = delMes?.asistio_reunion ? "dentro" : "advertencia";

  const niveles = [nivelIndice, nivelServicio, nivelReunion];
  const global: Nivel = niveles.includes("alerta") ? "alerta" : niveles.includes("advertencia") ? "advertencia" : "dentro";
  const IconoGlobal = ICONO_NIVEL[global];

  const criterios: { clave: string; icono: LucideIcon; nivel: Nivel; valor: string; detalle: string }[] = [
    {
      clave: "index",
      icono: GraduationCap,
      nivel: nivelIndice,
      valor: indice === null ? "—" : indice.toFixed(2),
      detalle: indice === null ? t("indexNone") : t("indexMin", { min: minimo.toFixed(2) }),
    },
    {
      clave: "service",
      icono: HeartHandshake,
      nivel: nivelServicio,
      valor: delMes?.hizo_servicio ? t("done") : t("pending"),
      detalle: t("serviceMonth"),
    },
    {
      clave: "meeting",
      icono: Users,
      nivel: nivelReunion,
      valor: delMes?.asistio_reunion ? t("done") : t("pending"),
      detalle: t("meetingMonth"),
    },
  ];

  return (
    <Card className="gap-4 p-5" aria-labelledby="semaforo-beca-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="semaforo-beca-titulo" className="texto-titulo-tarjeta">
          {t("title")}
        </h2>
        <Badge className={cn("inline-flex items-center gap-1 text-xs font-semibold", INSIGNIA_SEMAFORO[global])}>
          <IconoGlobal className="size-3.5" aria-hidden />
          {t(`verdict.${global}`)}
        </Badge>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {criterios.map(({ clave, icono: Icono, nivel, valor, detalle }) => {
          const IconoNivel = ICONO_NIVEL[nivel];
          return (
            <li key={clave} className="flex items-center gap-3 rounded-control border border-linea p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-muted text-tinta-2">
                <Icono className="size-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg leading-tight font-semibold text-tinta">{valor}</p>
                <p className="texto-meta truncate">{detalle}</p>
              </div>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", INSIGNIA_SEMAFORO[nivel])}>
                <IconoNivel className="size-4" aria-label={t(`level.${nivel}`)} />
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
