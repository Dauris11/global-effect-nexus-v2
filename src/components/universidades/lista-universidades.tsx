"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusBadge } from "@/components/app/status-badge";
import { LogoUniversidad } from "@/components/universidades/logo-universidad";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { UniversidadCatalogo } from "@/server/universidades/consultas";

/**
 * Catálogo de universidades como tabla densa (≥ md) y filas compactas (móvil). Un clic en
 * la fila abre el resumen en un panel lateral; la edición y las carreras viven en la
 * ficha de la universidad, a un clic de «Ver detalle completo».
 */
export function ListaUniversidades({ universidades }: { universidades: UniversidadCatalogo[] }) {
  const t = useTranslations("catalog");
  const tl = useTranslations("listas");
  const [seleccionada, setSeleccionada] = useState<UniversidadCatalogo | null>(null);

  const estado = (u: UniversidadCatalogo) => (u.activa ? "activa" : "inactiva");

  return (
    <>
      <div className="overflow-hidden rounded-card border border-linea bg-card shadow-card">
        <table className="hidden w-full text-sm md:table">
          <thead className="border-b border-linea text-left texto-meta">
            <tr>
              <th className="px-4 py-3 font-medium">{t("title")}</th>
              <th className="px-4 py-3 font-medium">{t("university.status")}</th>
              <th className="px-4 py-3 font-medium">{t("university.regime")}</th>
              <th className="px-4 py-3 font-medium">{t("career.title")}</th>
              <th className="px-4 py-3 font-medium">{tl("universidades.estudiantes")}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{tl("universidades.abrir")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {universidades.map((u) => (
              <tr key={u.id} className="group relative h-[52px] transition-colors hover:bg-muted/50">
                <td className="px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setSeleccionada(u)}
                    title={tl("universidades.abrir")}
                    aria-label={`${tl("universidades.abrir")}: ${u.siglas}`}
                    className="flex min-w-0 items-center gap-3 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogoUniversidad siglas={u.siglas} url={u.logo} className="size-9" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{u.siglas}</span>
                      <span className="text-meta block max-w-72 truncate">{u.nombre}</span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-1.5">
                  <StatusBadge status={estado(u)} />
                </td>
                <td className="text-meta px-4 py-1.5">{t(`regime.${u.regimen}`)}</td>
                <td className="text-meta px-4 py-1.5 tabular-nums">{u.carreras}</td>
                <td className="text-meta px-4 py-1.5 tabular-nums">{u.estudiantes}</td>
                <td className="relative z-10 w-16 px-2 py-1.5 text-right">
                  <span className="inline-flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <Button asChild variant="ghost" size="icon" aria-label={tl("universidades.verDetalle")}>
                      <Link href={`/academico/universidades/${u.id}`}><Eye /></Link>
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="divide-y divide-linea md:hidden">
          {universidades.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSeleccionada(u)}
                aria-label={`${tl("universidades.abrir")}: ${u.siglas}`}
                className="flex w-full items-center gap-3 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogoUniversidad siglas={u.siglas} url={u.logo} className="size-12" />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="block font-semibold">{u.siglas}</span>
                  <span className="text-meta block truncate">{u.nombre}</span>
                  <StatusBadge status={estado(u)} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={seleccionada !== null} onOpenChange={(abierto) => !abierto && setSeleccionada(null)}>
        <SheetContent>
          {seleccionada && (
            <>
              <header className="border-b border-linea px-6 pt-6 pr-16 pb-4">
                <div className="flex items-center gap-4">
                  <LogoUniversidad siglas={seleccionada.siglas} url={seleccionada.logo} className="size-16" />
                  <div className="min-w-0 space-y-2">
                    <SheetTitle className="text-section">{seleccionada.siglas}</SheetTitle>
                    <SheetDescription className="sr-only">{tl("universidades.resumen")}</SheetDescription>
                    <StatusBadge status={estado(seleccionada)} />
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 text-sm sm:grid-cols-2">
                  <Dato etiqueta={t("university.name")} valor={seleccionada.nombre} ancho />
                  <Dato etiqueta={t("university.regime")} valor={t(`regime.${seleccionada.regimen}`)} />
                  <Dato etiqueta={t("career.title")} valor={String(seleccionada.carreras)} />
                  <Dato etiqueta={tl("universidades.estudiantes")} valor={String(seleccionada.estudiantes)} />
                </dl>
              </div>

              <footer className="flex justify-end gap-2 border-t border-linea px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button asChild>
                  <Link href={`/academico/universidades/${seleccionada.id}`}>
                    <Eye className="size-4" />
                    {tl("universidades.verDetalle")}
                  </Link>
                </Button>
              </footer>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Dato({ etiqueta, valor, ancho = false }: { etiqueta: string; valor: string; ancho?: boolean }) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-meta">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
