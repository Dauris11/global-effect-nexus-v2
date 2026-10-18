/**
 * Constantes y tipos compartidos del Módulo 30: Inventario de Activos con QR.
 *
 * Vive en `src/lib/` para que los componentes cliente (`"use client"`) puedan
 * importar valores y tipos sin arrastrar `pg` ni la capa servidor.
 */

export const CATEGORIAS_ACTIVO = [
  "herramientas",
  "tecnologia",
  "mobiliario",
  "electrodomesticos",
  "vehiculos",
  "otros",
] as const;

export type CategoriaActivo = (typeof CATEGORIAS_ACTIVO)[number];

export const ESTADOS_ACTIVO = [
  "operativo",
  "mantenimiento",
  "prestado",
  "baja",
] as const;

export type EstadoActivo = (typeof ESTADOS_ACTIVO)[number];

export interface ActivoInventario {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaActivo;
  ubicacion: string;
  estado: EstadoActivo;
  fotoUrl: string | null;
  codigoQr: string;
  responsableId: string | null;
  responsableNombre: string | null;
  responsableEmail: string | null;
  valorEstimado: number | null;
  numeroSerie: string | null;
  marcaModelo: string | null;
  notas: string | null;
  creadoPor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistorialActivo {
  id: string;
  activoId: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  accion:
    | "creacion"
    | "movimiento_ubicacion"
    | "cambio_custodio"
    | "cambio_estado"
    | "auditoria_qr"
    | "mantenimiento"
    | "edicion";
  ubicacionAnterior: string | null;
  ubicacionNueva: string | null;
  responsableAnteriorNombre: string | null;
  responsableNuevoNombre: string | null;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  notas: string | null;
  createdAt: string;
}

export interface MetricasInventario {
  totalActivos: number;
  operativos: number;
  enMantenimiento: number;
  enPrestamo: number;
  deBaja: number;
  valorTotalEstimado: number;
  porCategoria: { categoria: string; cantidad: number }[];
}
