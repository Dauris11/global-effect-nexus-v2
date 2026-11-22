"use client";

import { useState, useTransition } from "react";
import {
  BookOpen,
  Download,
  Eye,
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

  // La lista sale de las props: al subir, la acción revalida /habitudes y el
  // recurso llega ya con su enlace firmado. Solo el conteo de descargas se
  // adelanta en el cliente.
  const [descargasExtra, setDescargasExtra] = useState<Record<string, number>>({});
  const recursos = recursosIniciales.map((r) =>
    descargasExtra[r.id]
      ? { ...r, descargas_conteo: r.descargas_conteo + descargasExtra[r.id] }
      : r,
  );
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");
  const [modalSubirAbierto, setModalSubirAbierto] = useState<boolean>(false);
  const [vistazoDe, setVistazoDe] = useState<HabitudesRecurso | null>(null);

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
    setDescargasExtra((prev) => ({ ...prev, [recurso.id]: (prev[recurso.id] ?? 0) + 1 }));
    void incrementarDescargaRecursoAction(recurso.id);
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

    formData.set("archivo", archivoSeleccionado);
    formData.set("archivo_nombre", archivoSeleccionado.name);
    formData.set("formato", ext);
    formData.set("tamano_mb", tamanoMb);

    startTransition(async () => {
      const res = await subirRecursoHabitudesAction(formData);
      if (res.ok) {
        setMensajeExito(res.mensaje ?? t("resourceUploadedSuccess"));
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
                className="flex flex-col justify-between overflow-hidden border-linea-fuerte bg-card p-0 shadow-xs transition-shadow hover:shadow-md"
              >
                {/* Portada: lo primero que se ve, para reconocer el material sin abrirlo. */}
                <button
                  type="button"
                  onClick={() => setVistazoDe(rec)}
                  aria-label={t("previewOpen", { title: rec.titulo })}
                  className="group relative block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PortadaRecurso rec={rec} Icono={Icono} etiquetaCategoria={t(`cat_${rec.categoria}`)} />
                  <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-tinta px-3 py-1.5 text-xs font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Eye className="size-3.5" />
                    {t("previewButton")}
                  </span>
                </button>

                <div className="p-5 pb-0">
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

                <div className="m-5 mt-4 flex items-center justify-between border-t border-linea pt-3 text-xs text-tinta/60">
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

      <VistazoDialogo rec={vistazoDe} onCerrar={() => setVistazoDe(null)} alDescargar={manejarDescarga} />

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
                cargando={isPending}
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

/**
 * Portada de un material. Con la imagen real del archivo, esa; sin ella (archivo que no
 * se pudo leer o aún sin generar) se dibuja una página con la categoría, el formato y las
 * primeras líneas del contenido o de la descripción, para que cada tarjeta se distinga.
 */
function PortadaRecurso({
  rec,
  Icono,
  etiquetaCategoria,
}: {
  rec: HabitudesRecurso;
  Icono: React.ComponentType<{ className?: string }>;
  etiquetaCategoria: string;
}) {
  if (rec.portada_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- enlace firmado de vida corta: no pasa por el optimizador
      <img src={rec.portada_url} alt="" className="aspect-[16/10] w-full bg-muted object-cover object-top" loading="lazy" />
    );
  }

  const resumen = rec.vistazo?.puntos?.length ? rec.vistazo.puntos.slice(0, 3).join(" · ") : (rec.vistazo?.texto || rec.descripcion || "");

  return (
    <div className="flex aspect-[16/10] w-full flex-col justify-between bg-marca-50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-background text-marca-700">
          <Icono className="size-5" />
        </span>
        <span className="rounded-full bg-background px-2.5 py-0.5 font-mono text-[10px] font-semibold text-marca-700 uppercase">.{rec.formato}</span>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold tracking-wide text-marca-700 uppercase">{etiquetaCategoria}</p>
        <p className="line-clamp-3 text-xs leading-relaxed text-tinta-2">{resumen}</p>
      </div>
    </div>
  );
}

/** Vistazo ampliado: portada grande, qué trae el material y sus primeras líneas, con el botón para abrirlo. */
function VistazoDialogo({
  rec,
  onCerrar,
  alDescargar,
}: {
  rec: HabitudesRecurso | null;
  onCerrar: () => void;
  alDescargar: (r: HabitudesRecurso) => void;
}) {
  const t = useTranslations("habitudes");
  const Icono = rec ? (ICONO_CATEGORIA[rec.categoria as keyof typeof ICONO_CATEGORIA] ?? Presentation) : Presentation;
  const v = rec?.vistazo;
  const unidad = rec?.formato === "pptx" ? "slides" : rec?.formato === "xlsx" ? "sheets" : "pages";

  return (
    <Dialog open={rec !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] max-w-2xl overflow-y-auto p-0">
        {rec && (
          <>
            <div className="overflow-hidden rounded-t-hoja">
              <PortadaRecurso rec={rec} Icono={Icono} etiquetaCategoria={t(`cat_${rec.categoria}`)} />
            </div>
            <div className="space-y-4 px-6 pb-6">
              <DialogHeader>
                <DialogTitle className="text-lg leading-snug">{rec.titulo}</DialogTitle>
              </DialogHeader>

              <p className="texto-meta">
                .{rec.formato.toUpperCase()} · {rec.tamano_mb} MB
                {v?.paginas ? ` · ${t(`${unidad}Count`, { count: v.paginas })}` : ""}
                {rec.subido_por_nombre ? ` · ${rec.subido_por_nombre}` : ""}
              </p>

              {rec.descripcion && <p className="text-sm text-tinta-2">{rec.descripcion}</p>}

              {v?.puntos && v.puntos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">{t("previewContents")}</h4>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-tinta-2">
                    {v.puntos.map((p, i) => (
                      <li key={`${i}-${p}`}>{p}</li>
                    ))}
                  </ol>
                </div>
              )}

              {v?.texto && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">{t("previewFirstLines")}</h4>
                  <p className="rounded-control bg-muted p-3 text-sm leading-relaxed text-tinta-2">{v.texto}</p>
                </div>
              )}

              {!v?.texto && !(v?.puntos && v.puntos.length > 0) && !rec.portada_url && (
                <p className="texto-meta">{t("previewNone")}</p>
              )}

              <Button asChild className="w-full sm:w-auto">
                <a href={rec.archivo_url} target="_blank" rel="noopener noreferrer" onClick={() => alDescargar(rec)}>
                  <Download className="size-4" />
                  {t("previewOpenFile")}
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
