import { consultar } from "@/lib/db";

/**
 * Lo que queda de las consultas de la portada.
 *
 * La portada ya no lee la base para nada más que los parámetros del comedor: es
 * la puerta del portal y no muestra cifras, eventos ni noticias. Solo sobrevive
 * lo que usa la pantalla de administración de anuncios (`/configuracion/landing`)
 * y la etiqueta de caché que sus acciones invalidan.
 */
export const TAG_LANDING = "landing";

export type DiapositivaLanding = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  texto: string | null;
  imagen_url: string | null;
  cta_texto: string | null;
  cta_enlace: string | null;
};

/** La misma fila, más lo que solo importa dentro del panel. */
export type DiapositivaAdmin = DiapositivaLanding & {
  orden: number;
  activo: boolean;
};

/**
 * Todos los anuncios, activos y ocultos, para el panel de administración.
 *
 * Sin caché a propósito: es la pantalla desde la que se edita, y ver ahí un
 * cambio propio con retraso es peor que consultar de más. La versión pública sí
 * va cacheada, y las acciones tiran esa caché al guardar.
 */
export async function diapositivasParaAdmin(): Promise<DiapositivaAdmin[]> {
  return consultar<DiapositivaAdmin>(
    `SELECT id, titulo, subtitulo, texto, imagen_url, cta_texto, cta_enlace,
            orden, activo
       FROM landing_slide
      ORDER BY activo DESC, orden, created_at`,
  );
}
