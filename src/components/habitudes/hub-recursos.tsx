"use client";

import { useState, useTransition } from "react";
import {
  BookOpen,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Image,
  Loader2,
  Plus,
  Presentation,
  Search,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoriaHabitudes, HabitudesRecurso } from "@/lib/habitudes";
import { cn } from "@/lib/utils";
import {
  incrementarDescargaRecursoAction,
  subirRecursoHabitudesAction,
} from "@/server/habitudes/acciones";

interface HubRecursosProps {
  recursosIniciales: HabitudesRecurso[];
  puedeSubir: boolean;
}

const ICONO_CATEGORIA = {
  diapositiva: Presentation,
  guia_facilitador: BookOpen,
  infografia_didactica: Image,
  dinamica_taller: FileText,
  evaluacion: FileCheck,
};

export function HubRecursos({
  recursosIniciales,
  puedeSubir,
}: HubRecursosProps) {
  const t = useTranslations("habitudes");

  const [recursos, setRecursos] = useState(recursosIniciales);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");
  const [modalSubirAbierto, setModalSubirAbierto] = useState<boolean>(false);

  // Formulario de subida
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const recursosFiltrados = recursos.filter((rec) => {
    const coincideCategoria =
      categoriaFiltro === "todas" || rec.categoria === categoriaFiltro;
    const coincideTexto =
      !busqueda ||
      rec.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (rec.descripcion &&
        rec.descripcion.toLowerCase().includes(busqueda.toLowerCase())) ||
      rec.formato.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCategoria && coincideTexto;
  });

  const manejarDescarga = (recurso: HabitudesRecurso) => {
    // Actualización optimista de conteo
    setRecursos((prev) =>
      prev.map((r) =>
        r.id === recurso.id
          ? { ...r, descargas_conteo: r.descargas_conteo + 1 }
          : r,
      ),
    );
    incrementarDescargaRecursoAction(recurso.id);
  };

  const manejarEnvioRecurso = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorValidacion(null);
    setMensajeExito(null);

    if (!archivoSeleccionado) {
      setErrorValidacion(t("errFileRequired"));
      return;
    }

    const formData = new FormData(e.currentTarget);
    const tamanoMb = (archivoSeleccionado.size / (1024 * 1024)).toFixed(2);
    const ext = archivoSeleccionado.name.split(".").pop()?.toLowerCase() ?? "bin";

    formData.set("archivo_nombre", archivoSeleccionado.name);
    formData.set("formato", ext);
    formData.set("tamano_mb", tamanoMb);
    formData.set(
      "archivo_url",
      `https://storage.globaleffect.org/habitudes/${formData.get("categoria")}/${Date.now()}_${archivoSeleccionado.name}`,
    );

    startTransition(async () => {
      const res = await subirRecursoHabitudesAction(formData);
      if (res.ok) {
        setMensajeExito(res.mensaje ?? t("resourceUploadedSuccess"));
        // Agregar optimista
        const nuevoRecurso: HabitudesRecurso = {
          id: res.id ?? `temp-${Date.now()}`,
          titulo: String(formData.get("titulo")),
          descripcion: String(formData.get("descripcion") || null),
          categoria: formData.get("categoria") as CategoriaHabitudes,
          formato: ext,
          archivo_url: String(formData.get("archivo_url")),
          archivo_nombre: archivoSeleccionado.name,
          tamano_mb: parseFloat(tamanoMb),
          subido_por_id: null,
          subido_por_nombre: "Tú",
          descargas_conteo: 0,
          creado_en: new Date().toISOString(),
        };
        setRecursos((prev) => [nuevoRecurso, ...prev]);
        setTimeout(() => {
          setModalSubirAbierto(false);
          setMensajeExito(null);
          setArchivoSeleccionado(null);
        }, 1200);
      } else {
        setErrorValidacion(res.mensaje ?? t("resourceUploadError"));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra superior de búsqueda, filtros y acción */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tinta/40" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-10 h-11"
          />
        </div>

        {puedeSubir && (
          <Button
            onClick={() => setModalSubirAbierto(true)}
            className="min-h-11 gap-2 active:scale-95"
          >
            <Plus className="size-4" />
            <span>{t("uploadResourceButton")}</span>
          </Button>
        )}
      </div>

      {/* Chips de Categorías */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {[
          { id: "todas", etiqueta: t("catAll") },
          { id: "diapositiva", etiqueta: t("catSlides") },
          { id: "guia_facilitador", etiqueta: t("catGuides") },
          { id: "dinamica_taller", etiqueta: t("catWorkshops") },
          { id: "infografia_didactica", etiqueta: t("catInfographics") },
          { id: "evaluacion", etiqueta: t("catEvaluations") },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoriaFiltro(cat.id)}
            className={cn(
              "inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95",
              categoriaFiltro === cat.id
                ? "bg-marca-600 text-white shadow-xs"
                : "border border-linea-fuerte bg-card text-tinta-2 hover:bg-muted/60",
            )}
          >
            {cat.etiqueta}
          </button>
        ))}
      </div>

      {/* Rejilla de Recursos Pedagógicos */}
      {recursosFiltrados.length === 0 ? (
        <Card className="border-dashed border-2 py-12 text-center">
          <CardContent className="space-y-2">
            <Presentation className="mx-auto size-8 text-tinta/30" />
            <p className="font-semibold text-tinta">{t("emptyResourcesTitle")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recursosFiltrados.map((rec) => {
            const Icono =
              ICONO_CATEGORIA[rec.categoria as keyof typeof ICONO_CATEGORIA] ??
              Presentation;
            return (
              <Card
                key={rec.id}
                className="flex flex-col justify-between border-linea-fuerte bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-marca-50 text-marca-700">
                      <Icono className="size-5" />
                    </span>
                    <Badge variant="neutra" className="uppercase font-mono text-[10px]">
                      .{rec.formato} · {rec.tamano_mb} MB
                    </Badge>
                  </div>

                  <h3 className="mt-3 font-semibold text-sm leading-snug text-tinta line-clamp-2">
                    {rec.titulo}
                  </h3>

                  {rec.descripcion && (
                    <p className="mt-1.5 text-xs text-tinta-2 line-clamp-2 leading-relaxed">
                      {rec.descripcion}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-linea pt-3 text-xs text-tinta/60">
                  <span className="truncate">
                    {rec.subido_por_nombre ?? t("anonymousAuthor")}
                  </span>

                  <a
                    href={rec.archivo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => manejarDescarga(rec)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-linea-fuerte bg-muted/30 px-3 font-semibold text-marca-700 hover:bg-marca-50 active:scale-95"
                  >
                    <Download className="size-3.5" />
                    <span>{rec.descargas_conteo}</span>
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Subida de Material al Repositorio */}
      <Dialog open={modalSubirAbierto} onOpenChange={setModalSubirAbierto}>
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UploadCloud className="size-5 text-marca-600" />
              <span>{t("uploadModalTitle")}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={manejarEnvioRecurso} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">{t("resourceTitleLabel")}</Label>
              <Input
                id="titulo"
                name="titulo"
                required
                placeholder={t("resourceTitlePlaceholder")}
                maxLength={160}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="categoria">{t("categoryLabel")}</Label>
                <select
                  id="categoria"
                  name="categoria"
                  defaultValue="diapositiva"
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                >
                  <option value="diapositiva">{t("catSlides")}</option>
                  <option value="guia_facilitador">{t("catGuides")}</option>
                  <option value="dinamica_taller">{t("catWorkshops")}</option>
                  <option value="infografia_didactica">{t("catInfographics")}</option>
                  <option value="evaluacion">{t("catEvaluations")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("fileLabel")}</Label>
                <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-linea-fuerte bg-muted/40 px-3 text-xs font-semibold text-tinta hover:bg-muted truncate">
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pptx,.pdf,.docx,.png,.jpg,.xlsx"
                    onChange={(e) => setArchivoSeleccionado(e.target.files?.[0] ?? null)}
                  />
                  {archivoSeleccionado
                    ? archivoSeleccionado.name
                    : t("selectFileButton")}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descripcion">{t("descriptionLabel")}</Label>
              <Textarea
                id="descripcion"
                name="descripcion"
                rows={2}
                placeholder={t("resourceDescriptionPlaceholder")}
                maxLength={600}
              />
            </div>

            {errorValidacion && (
              <p className="rounded-lg bg-marca-50 p-2.5 text-xs font-medium text-tinta">
                {errorValidacion}
              </p>
            )}

            {mensajeExito && (
              <p className="rounded-lg bg-marca-50 p-2.5 text-xs font-semibold text-marca-700">
                {mensajeExito}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalSubirAbierto(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="gap-2 min-h-11 px-5 active:scale-95"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                <span>{t("publishResourceButton")}</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
