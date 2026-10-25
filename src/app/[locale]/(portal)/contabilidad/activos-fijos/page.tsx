import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { VistaActivosFijos } from "@/components/contabilidad/activos-fijos/vista-activos-fijos";
import { requerirPermiso } from "@/lib/auth";
import {
  listarActivosFijos,
  listarDepreciacionesMensuales,
  listarCategoriasActivos,
} from "@/server/contabilidad/activos-fijos/consultas";
import { listarCentrosCosto } from "@/server/contabilidad/centros-costo/consultas";
import { consultar } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contab.activosFijos");
  return { title: `${t("titulo")} | Global Effect Nexus` };
}

export default async function PaginaActivosFijos() {
  await requerirPermiso("contabilidad.leer");
  const t = await getTranslations("contab.activosFijos");

  const [activos, depreciaciones, categorias, centrosCosto, activosFisicos] = await Promise.all([
    listarActivosFijos(),
    listarDepreciacionesMensuales(),
    listarCategoriasActivos(),
    listarCentrosCosto(),
    consultar<{ id: string; codigo: string; nombre: string }>(
      `SELECT id, codigo, nombre FROM public.inventario_activo ORDER BY codigo ASC`,
    ),
  ]);

  const centrosFormateados = centrosCosto.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
  }));

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        antetitulo={t("antetitulo")}
        titulo={t("titulo")}
        subtitulo={t("subtitulo")}
      />

      <VistaActivosFijos
        activos={activos}
        depreciaciones={depreciaciones}
        categorias={categorias}
        centrosCosto={centrosFormateados}
        activosFisicos={activosFisicos}
      />
    </div>
  );
}
