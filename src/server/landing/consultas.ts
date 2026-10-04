import { unstable_cache } from "next/cache";

import { consultar, consultarUna } from "@/lib/db";

/**
 * Datos públicos de la página de inicio.
 *
 * Todo lo de aquí lo lee gente sin sesión, así que las consultas solo piden
 * columnas que se pueden mostrar en abierto: ni un nombre de estudiante, ni un
 * dato de contacto, ni nada de un expediente. Las cifras salen agregadas.
 *
 * Las consultas filtran lo no publicado en SQL, no en el componente: es lo que
 * evita que un borrador se cuele por descuido en un `map`.
 */

/**
 * Etiqueta de caché de todo lo público de la portada.
 *
 * La landing es la página más visitada y la única que cualquiera abre sin
 * sesión. Sin caché, cada visita disparaba cinco consultas al pooler para
 * devolver exactamente lo mismo que a la anterior. Ahora las respuestas se
 * guardan y se tiran de golpe cuando administración publica algo, llamando a
 * `revalidateTag(TAG_LANDING)` desde las acciones.
 *
 * El `revalidate` de cada consulta es el tope por si el dato cambia por fuera
 * del panel —una fila tocada a mano, un evento importado— y va acorde a lo
 * rápido que cada cosa envejece.
 */
export const TAG_LANDING = "landing";

/** Cinco minutos: lo que tarda en importar que una cifra esté vieja. */
const VIDA_NORMAL = 300;

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
 * Anuncios del hero que administración haya publicado y dejado activos.
 *
 * Cuando no hay ninguno, el hero usa el contenido de `messages`, que sí está
 * traducido a los dos idiomas. Estas filas son texto libre en un solo idioma,
 * así que solo deben mandar cuando alguien las publique de verdad.
 */
export const diapositivasLanding = unstable_cache(
  async (): Promise<DiapositivaLanding[]> =>
    consultar<DiapositivaLanding>(
      `SELECT id, titulo, subtitulo, texto, imagen_url, cta_texto, cta_enlace
         FROM landing_slide
        WHERE activo
        ORDER BY orden, created_at`,
    ),
  ["landing-diapositivas"],
  { tags: [TAG_LANDING], revalidate: VIDA_NORMAL },
);

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

export type EventoPublico = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  fecha: string;
  hora_inicio: string | null;
  ubicacion: string | null;
};

/**
 * Eventos que aún no han pasado.
 *
 * `fecha::text` en lugar de la fecha cruda: `pg` convierte DATE a un Date de
 * JavaScript en la zona del servidor, y un evento del día 15 puede acabar
 * mostrándose como el 14. Como texto `YYYY-MM-DD` no hay nada que desplazar.
 *
 * Se excluyen los cancelados: siguen en la tabla para el historial interno,
 * pero anunciar en público algo cancelado sería peor que no anunciarlo.
 */
export const eventosPublicos = unstable_cache(
  async (limite = 12): Promise<EventoPublico[]> =>
    consultar<EventoPublico>(
      `SELECT id, titulo, descripcion, tipo, fecha::text AS fecha, hora_inicio, ubicacion
         FROM evento
        WHERE fecha >= CURRENT_DATE
          AND estado <> 'cancelado'
        ORDER BY fecha, hora_inicio NULLS LAST
        LIMIT $1`,
      [limite],
    ),
  ["landing-eventos"],
  { tags: [TAG_LANDING], revalidate: VIDA_NORMAL },
);

export type NoticiaPublica = {
  id: string;
  titulo: string;
  resumen: string | null;
  imagen_url: string | null;
  fecha: string;
  autor: string | null;
};

/** Noticias publicadas, de la más reciente a la más antigua. */
export const noticiasPublicas = unstable_cache(
  async (limite = 6): Promise<NoticiaPublica[]> =>
    consultar<NoticiaPublica>(
      `SELECT id, titulo, resumen, imagen_url, fecha::text AS fecha, autor
         FROM noticia
        WHERE publicada
        ORDER BY fecha DESC
        LIMIT $1`,
      [limite],
    ),
  ["landing-noticias"],
  { tags: [TAG_LANDING], revalidate: VIDA_NORMAL },
);

/**
 * Cuántas personas se han inscrito hoy al almuerzo.
 *
 * Solo el número. La portada no muestra nombres: quién come es asunto de quien
 * organiza el comedor, no de quien visita la web.
 *
 * Un minuto de caché y no cinco: es la única cifra que se mueve mientras la
 * ventana está abierta, de 6:00 a 8:30, y verla clavada media hora se notaría.
 */
export const inscritosComidaHoy = unstable_cache(
  async (): Promise<number> => {
    const fila = await consultarUna<{ n: number }>(
      `SELECT count(*)::int AS n FROM inscripcion_comida WHERE fecha = CURRENT_DATE`,
    );

    return fila?.n ?? 0;
  },
  ["landing-comida-hoy"],
  { tags: [TAG_LANDING], revalidate: 60 },
);
