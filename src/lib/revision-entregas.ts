/**
 * Tipos de la revisión de entregas. Viven en `lib` y no en el servidor porque
 * los usa el revisor, que es componente cliente (de `server/**` solo se
 * importan tipos, y aquí no hay driver que arrastrar).
 */
export type TipoAdjunto = "pdf" | "imagen" | "otro";

export type EntregaRevisable = {
  id: string;
  estudiante: string;
  /** `entregado`, `tarde` o `calificado`. */
  estado: string;
  fechaEntrega: string | null;
  textoRespuesta: string | null;
  /** Enlace firmado y con caducidad: el bucket es privado. */
  enlace: string | null;
  tipoAdjunto: TipoAdjunto | null;
  calificacion: number | null;
  comentario: string | null;
};

export type TareaRevisable = {
  id: string;
  titulo: string;
  unidad: string;
  puntajeMaximo: number;
  entregas: EntregaRevisable[];
};

/** Lo que se ve del adjunto lo decide la extensión, que la fija el servidor al subirlo. */
export function tipoDeAdjunto(ruta: string | null): TipoAdjunto | null {
  if (!ruta) return null;
  const extension = ruta.split("?")[0].split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "pdf";
  if (extension === "jpg" || extension === "jpeg" || extension === "png") return "imagen";

  return "otro";
}
