"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Save, X } from "lucide-react";
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
import { crearActivoAction, editarActivoAction } from "@/server/inventario/acciones";

interface FormularioActivoProps {
  activo?: ActivoInventario;
  usuarios: { id: string; nombre: string }[];
}

export function FormularioActivo({ activo, usuarios }: FormularioActivoProps) {
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !ubicacion.trim()) {
      setError("Nombre y ubicación física son obligatorios.");
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
      setError(err instanceof Error ? err.message : "Error al procesar la solicitud.");
      setGuardando(false);
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
        <h2 className="text-sm font-bold text-tinta">Datos Generales del Activo</h2>
        <p className="text-xs text-tinta-2">Información descriptiva para identificación y control</p>

        <div className="mt-4 space-y-6">
        <PasoFormulario titulo={tPasos("identificacion")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Nombre */}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-tinta">
              Nombre descriptivo del activo <span className="font-bold text-marca-600">*</span>
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Taladro Percutor Industrial Dewalt 20V Max"
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="text-xs font-semibold text-tinta">
              Categoría patrimonial <span className="font-bold text-marca-600">*</span>
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaActivo)}
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs capitalize outline-none focus:border-marca-500"
            >
              {CATEGORIAS_ACTIVO.map((cat) => (
                <option key={cat} value={cat} className="capitalize">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Estado Físico */}
          <div>
            <label className="text-xs font-semibold text-tinta">
              Estado operativo <span className="font-bold text-marca-600">*</span>
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoActivo)}
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs capitalize outline-none focus:border-marca-500"
            >
              {ESTADOS_ACTIVO.map((est) => (
                <option key={est} value={est} className="capitalize">
                  {est}
                </option>
              ))}
            </select>
          </div>

          {/* Ubicación Física */}
          <div>
            <label className="text-xs font-semibold text-tinta">
              Ubicación física <span className="font-bold text-marca-600">*</span>
            </label>
            <input
              type="text"
              required
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej: Taller Casa de Herramientas / Aula 2"
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
            />
          </div>

        </div>
        </PasoFormulario>

        <PasoFormulario titulo={tPasos("control")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Custodio / Responsable */}
          <div>
            <label className="text-xs font-semibold text-tinta">Custodio asignado</label>
            <select
              value={responsableId}
              onChange={(e) => setResponsableId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
            >
              <option value="">(Sin custodio asignado)</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Valor Estimado */}
          <div>
            <label className="text-xs font-semibold text-tinta">Valor estimado (RD$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorEstimado}
              onChange={(e) => setValorEstimado(e.target.value)}
              placeholder="Ej: 14500.00"
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs font-mono outline-none focus:border-marca-500"
            />
          </div>

          {/* Número de Serie */}
          <div>
            <label className="text-xs font-semibold text-tinta">Número de Serie (S/N)</label>
            <input
              type="text"
              value={numeroSerie}
              onChange={(e) => setNumeroSerie(e.target.value)}
              placeholder="Ej: DW-9921884"
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs font-mono outline-none focus:border-marca-500"
            />
          </div>

          {/* Marca y Modelo */}
          <div>
            <label className="text-xs font-semibold text-tinta">Marca y Modelo</label>
            <input
              type="text"
              value={marcaModelo}
              onChange={(e) => setMarcaModelo(e.target.value)}
              placeholder="Ej: DeWalt DCD996B"
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
            />
          </div>

        </div>
        </PasoFormulario>

        <PasoFormulario titulo={tPasos("detalle")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* URL de Fotografía */}
          <div>
            <label className="text-xs font-semibold text-tinta">URL de Fotografía</label>
            <input
              type="url"
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
            />
          </div>

          {/* Notas */}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-tinta">Notas y especificaciones</label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Accesorios incluidos, condiciones físicas o advertencias de uso..."
              className="mt-1 w-full rounded-xl border border-linea bg-background px-3 py-2 text-xs outline-none focus:border-marca-500"
            />
          </div>
        </div>
        </PasoFormulario>
        </div>
      </div>

      {/* Botones de Guardar / Cancelar */}
      <AccionesFormulario>
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={guardando}
          className="text-xs"
        >
          <X className="size-4" />
          <span>Cancelar</span>
        </Button>

        <Button
          type="submit"
          disabled={guardando}
          className="flex items-center gap-2 bg-marca-600 hover:bg-marca-700 text-xs"
        >
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          <span>{esEdicion ? "Guardar Cambios" : "Crear Activo y Generar QR"}</span>
        </Button>
      </div>
      </AccionesFormulario>
      </FormularioGuiado>
    </form>
  );
}
