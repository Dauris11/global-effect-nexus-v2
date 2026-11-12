"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  AccionesFormulario,
  FormularioGuiado,
  PasoFormulario,
} from "@/components/ui/formulario-guiado";
import { useRouter } from "@/i18n/navigation";
import {
  CATEGORIAS_ACTIVO,
  ESTADOS_ACTIVO,
  type ActivoInventario,
  type CategoriaActivo,
  type EstadoActivo,
} from "@/lib/inventario";
import {
  crearActivoAction,
  editarActivoAction,
  eliminarActivoAction,
} from "@/server/inventario/acciones";

interface FormularioActivoProps {
  activo?: ActivoInventario;
  usuarios: { id: string; nombre: string }[];
  puedeEliminar?: boolean;
}

export function FormularioActivo({
  activo,
  usuarios,
  puedeEliminar = false,
}: FormularioActivoProps) {
  const router = useRouter();
  const t = useTranslations("admin.activoFormulario");
  const tInv = useTranslations("admin.inventario");
  const tPasos = useTranslations("admin.activoFormulario.pasos");
  const esEdicion = Boolean(activo);

  const [nombre, setNombre] = useState(activo?.nombre ?? "");
  const [categoria, setCategoria] = useState<CategoriaActivo>(activo?.categoria ?? "herramientas");
  const [ubicacion, setUbicacion] = useState(activo?.ubicacion ?? "");
  const [estado, setEstado] = useState<EstadoActivo>(activo?.estado ?? "operativo");
  const [responsableId, setResponsableId] = useState(activo?.responsableId ?? "");
  const [valorEstimado, setValorEstimado] = useState(activo?.valorEstimado ? String(activo.valorEstimado) : "");
  const [numeroSerie, setNumeroSerie] = useState(activo?.numeroSerie ?? "");
  const [marcaModelo, setMarcaModelo] = useState(activo?.marcaModelo ?? "");
  const [fotoUrl, setFotoUrl] = useState(activo?.fotoUrl ?? "");
  const [notas, setNotas] = useState(activo?.notas ?? "");

  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !ubicacion.trim()) {
      setError(t("errorObligatorios"));
      return;
    }

    try {
      setGuardando(true);

      const valorNumerico = valorEstimado ? Number(valorEstimado) : null;

      if (esEdicion && activo) {
        await editarActivoAction({
          id: activo.id,
          nombre,
          categoria,
          ubicacion,
          estado,
          responsableId: responsableId || null,
          valorEstimado: valorNumerico,
          numeroSerie: numeroSerie || null,
          marcaModelo: marcaModelo || null,
          fotoUrl: fotoUrl || null,
          notas: notas || null,
        });
        router.push(`/administrativo/inventario/${activo.id}`);
      } else {
        const res = await crearActivoAction({
          nombre,
          categoria,
          ubicacion,
          estado,
          responsableId: responsableId || null,
          valorEstimado: valorNumerico,
          numeroSerie: numeroSerie || null,
          marcaModelo: marcaModelo || null,
          fotoUrl: fotoUrl || null,
          notas: notas || null,
        });
        router.push(`/administrativo/inventario/${res.id}`);
      }
    } catch (err: unknown) {
      console.error("Error al guardar activo:", err);
      setError(err instanceof Error ? err.message : t("errorGenerico"));
      setGuardando(false);
    }
  };

  const manejarEliminar = async () => {
    if (!activo) return;
    const confirmado = window.confirm(
      tInv("confirmarEliminar", { code: activo.codigo, name: activo.nombre })
    );
    if (!confirmado) return;

    try {
      setError(null);
      setEliminando(true);
      await eliminarActivoAction(activo.id);
      router.push("/administrativo/inventario");
    } catch (err) {
      setError(err instanceof Error ? err.message : tInv("errorEliminar"));
      setEliminando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-linea-fuerte bg-muted p-3 text-xs font-semibold text-tinta">
          <AlertCircle className="size-4 shrink-0 text-tinta" />
          <span>{error}</span>
        </div>
      )}

      <FormularioGuiado>
        <div className="rounded-2xl border border-linea bg-card p-5 shadow-xs">
          <h2 className="text-sm font-bold text-tinta">{t("tituloSeccion")}</h2>
          <p className="text-xs text-tinta-2">{t("subtituloSeccion")}</p>

          <div className="mt-4 space-y-6">
            <PasoFormulario titulo={tPasos("identificacion")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Nombre */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-tinta">
                    {t("nombreLabel")} <span className="font-bold text-marca-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder={t("nombrePlaceholder")}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="text-xs font-semibold text-tinta">
                    {t("categoriaLabel")} <span className="font-bold text-marca-600">*</span>
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as CategoriaActivo)}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  >
                    {CATEGORIAS_ACTIVO.map((cat) => (
                      <option key={cat} value={cat}>
                        {tInv(`categorias.${cat}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado Físico */}
                <div>
                  <label className="text-xs font-semibold text-tinta">
                    {t("estadoLabel")} <span className="font-bold text-marca-600">*</span>
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoActivo)}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  >
                    {ESTADOS_ACTIVO.map((est) => (
                      <option key={est} value={est}>
                        {tInv(`estados.${est}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ubicación Física */}
                <div>
                  <label className="text-xs font-semibold text-tinta">
                    {t("ubicacionLabel")} <span className="font-bold text-marca-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    placeholder={t("ubicacionPlaceholder")}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  />
                </div>
              </div>
            </PasoFormulario>

            <PasoFormulario titulo={tPasos("control")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Custodio / Responsable */}
                <div>
                  <label className="text-xs font-semibold text-tinta">{t("custodioLabel")}</label>
                  <select
                    value={responsableId}
                    onChange={(e) => setResponsableId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  >
                    <option value="">{t("sinCustodio")}</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valor Estimado */}
                <div>
                  <label className="text-xs font-semibold text-tinta">{t("valorLabel")}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorEstimado}
                    onChange={(e) => setValorEstimado(e.target.value)}
                    placeholder={t("valorPlaceholder")}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs font-mono outline-none focus:border-marca-500"
                  />
                </div>

                {/* Número de Serie */}
                <div>
                  <label className="text-xs font-semibold text-tinta">{t("serieLabel")}</label>
                  <input
                    type="text"
                    value={numeroSerie}
                    onChange={(e) => setNumeroSerie(e.target.value)}
                    placeholder={t("seriePlaceholder")}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs font-mono outline-none focus:border-marca-500"
                  />
                </div>

                {/* Marca y Modelo */}
                <div>
                  <label className="text-xs font-semibold text-tinta">{t("marcaLabel")}</label>
                  <input
                    type="text"
                    value={marcaModelo}
                    onChange={(e) => setMarcaModelo(e.target.value)}
                    placeholder={t("marcaPlaceholder")}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  />
                </div>
              </div>
            </PasoFormulario>

            <PasoFormulario titulo={tPasos("detalle")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* URL de Fotografía */}
                <div>
                  <label className="text-xs font-semibold text-tinta">{t("fotoLabel")}</label>
                  <input
                    type="url"
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    placeholder={t("fotoPlaceholder")}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  />
                </div>

                {/* Notas */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-tinta">{t("notasLabel")}</label>
                  <textarea
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder={t("notasPlaceholder")}
                    className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
                  />
                </div>
              </div>
            </PasoFormulario>
          </div>
        </div>

        {/* Botones de Guardar / Cancelar / Eliminar */}
        <AccionesFormulario>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {esEdicion && activo && puedeEliminar && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void manejarEliminar()}
                  disabled={guardando || eliminando}
                  className="text-xs"
                >
                  {eliminando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  <span>{t("eliminarActivo")}</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={guardando || eliminando}
                className="text-xs"
              >
                <X className="size-4" />
                <span>{t("cancelar")}</span>
              </Button>

              <Button
                type="submit"
                disabled={guardando || eliminando}
                className="flex items-center gap-2 bg-marca-600 text-xs hover:bg-marca-700"
              >
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                <span>{esEdicion ? t("guardarCambios") : t("crearActivo")}</span>
              </Button>
            </div>
          </div>
        </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
