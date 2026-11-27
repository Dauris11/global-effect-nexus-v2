"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { useToast } from "@/components/app/toaster";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "@/i18n/navigation";
import type { DatosDeClase } from "@/lib/clase-docente";
import type { MarcaDeAsistencia } from "@/lib/clases";
import { cn } from "@/lib/utils";
import { guardarAsistenciaDelDia } from "@/server/profesor/acciones-clase";

const MARCAS: readonly MarcaDeAsistencia[] = ["presente", "ausente", "tarde"];

/**
 * Pasar asistencia en un solo paso: la lista de estudiantes con Presente /
 * Ausente / Tarde, todos en Presente por defecto (o con la marca que ya tenían
 * hoy), y «Guardar asistencia». La sesión de hoy se crea al guardar: el docente
 * no programa fechas antes de poder pasar lista.
 */
export function PanelAsistencia({
  datos,
  abierto,
  onCambio,
}: {
  datos: DatosDeClase;
  abierto: boolean;
  onCambio: (abierto: boolean) => void;
}) {
  const t = useTranslations("teacherClasses");
  const router = useRouter();
  const avisar = useToast();
  const [marcas, setMarcas] = useState<Record<string, MarcaDeAsistencia>>(() =>
    Object.fromEntries(datos.roster.map((r) => [r.inscripcionId, r.marcaHoy ?? "presente"])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () => {
    if (!datos.periodoId) return;
    setError(null);
    iniciar(async () => {
      const res = await guardarAsistenciaDelDia({
        origen: datos.origen,
        claseId: datos.id,
        periodoId: datos.periodoId as string,
        marcas: datos.roster.map((r) => ({ inscripcionId: r.inscripcionId, marca: marcas[r.inscripcionId] })),
      });

      if (res.estado === "ok") {
        avisar({ titulo: t("attendance.saved") });
        router.refresh();
        onCambio(false);
      } else {
        setError(t(`attendance.err.${res.estado}` as never));
      }
    });
  };

  const todos = (marca: MarcaDeAsistencia) =>
    setMarcas(Object.fromEntries(datos.roster.map((r) => [r.inscripcionId, marca])));

  return (
    <Sheet open={abierto} onOpenChange={onCambio}>
      <SheetContent>
        <header className="space-y-1 border-b border-linea px-6 pt-6 pb-4 pr-16">
          <SheetTitle className="text-section">{t("attendance.title")}</SheetTitle>
          <SheetDescription className="text-meta">{datos.nombre}</SheetDescription>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {datos.roster.length === 0 ? (
            <p className="text-body">{t("attendance.noRoster")}</p>
          ) : (
            <>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => todos("presente")}>
                  {t("attendance.allPresent")}
                </Button>
              </div>
              <ul className="divide-y divide-linea rounded-card border border-linea">
                {datos.roster.map((r) => (
                  <li key={r.inscripcionId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-body min-w-0 truncate font-medium">{r.nombre}</span>
                    <div role="radiogroup" aria-label={r.nombre} className="flex overflow-hidden rounded-control border border-linea-fuerte">
                      {MARCAS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={marcas[r.inscripcionId] === m}
                          onClick={() => setMarcas((previas) => ({ ...previas, [r.inscripcionId]: m }))}
                          className={cn(
                            "min-h-9 px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            marcas[r.inscripcionId] === m ? "bg-marca-500 text-white" : "bg-card text-tinta-2 hover:bg-muted",
                          )}
                        >
                          {t(`attendance.marks.${m}`)}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && (
            <p role="alert" className="text-body flex items-start gap-2 rounded-control bg-tinta p-3 text-background">
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-linea bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetClose asChild>
            <Button type="button" variant="ghost">
              {t("common.cancel")}
            </Button>
          </SheetClose>
          <Button type="button" cargando={pendiente} disabled={datos.roster.length === 0} onClick={guardar}>
            <Save aria-hidden />
            {t("attendance.save")}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
