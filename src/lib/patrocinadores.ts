/**
 * Tipos de patrocinador (el ENUM `tipo_patrocinador` de la migración 0004). Viven en `lib/`
 * y no en el componente del panel: un valor exportado desde un archivo `"use client"` llega
 * al servidor como referencia, no como arreglo, y `.includes()` revienta.
 */
export const TIPOS_PATROCINADOR = ["persona", "empresa", "iglesia", "ong", "otro"] as const;

export type TipoPatrocinador = (typeof TIPOS_PATROCINADOR)[number];
