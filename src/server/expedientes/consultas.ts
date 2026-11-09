import { consultar, consultarUna } from "@/lib/db";
import { FAMILIA_FIJA, type EstadoEstudiante } from "@/lib/expedientes";

/**
 * Lista de expedientes para el módulo del equipo.
 *
 * Esto es la cara interna de `estudiante`: aquí sí se ve todo, al revés de
 * `server/estudiantes/portal.ts`, donde el propio joven solo lee lo que ya sabe
 * de sí mismo. La puerta es el permiso `expedientes.leer`, que tienen
 * administración y `super_admin`.
 *
 * El expediente completo vive repartido en seis tablas —`estudiante` más los
 * perfiles de la migración 0005—, no en una fila ancha como en
 * el prototipo. La lista solo necesita la cabecera de cada uno, así que aquí no
 * se hace ningún JOIN con los perfiles: se traen al abrir el detalle.
 */

export type FilaExpediente = {
  id: string;
  nombre: string;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  estado: string;
  programa: string | null;
  universidad: string | null;
  fecha_ingreso: string | null;
  /** Ruta dentro del bucket `avatares`, o `null` si no tiene foto. */
  foto_url: string | null;
  /** Índice acumulado del historial, o `null` si aún no tiene notas. */
  indice: number | null;
  /** Número de evaluaciones en el historial, para saber si el índice es fiable. */
  evaluaciones: number;
};

/**
 * Expedientes con filtro por estado y búsqueda.
 *
 * Los dos filtros van como parámetros anulables dentro del WHERE, no armando
 * el SQL a trozos: la consulta es siempre la misma cadena y no hay ninguna rama
 * por la que un valor pueda acabar concatenado.
 *
 * La búsqueda cubre nombre, cédula y programa: es lo que promete el
 * placeholder del filtro (`filters.searchPlaceholder`), aunque hasta ahora la
 * consulta solo miraba nombre y cédula.
 *
 * El índice sale de `historial_calificacion`, que es donde se guarda el GPA ya
 * calculado por materia (ver el comentario de la migración 0006: la escala de
 * conversión puede cambiar de un año a otro, así que se guarda escrito y no se
 * recalcula).
 */
export async function listaExpedientes({
  busqueda = null,
  estado = null,
  porPagina = 20,
  pagina = 1,
}: {
  busqueda?: string | null;
  estado?: EstadoEstudiante | null;
  /** Filas por página. */
  porPagina?: number;
  /** 1-indexado, como se ve en la URL (`?pagina=2`). */
  pagina?: number;
} = {}): Promise<FilaExpediente[]> {
  const salto = (Math.max(1, pagina) - 1) * porPagina;

  return consultar<FilaExpediente>(
    `SELECT e.id,
            e.nombre,
            e.cedula,
            e.email::text AS email,
            e.telefono,
            e.estado::text AS estado,
            e.programa,
            e.universidad,
            e.fecha_ingreso::text AS fecha_ingreso,
            e.foto_url,
            h.indice,
            coalesce(h.evaluaciones, 0) AS evaluaciones
       FROM estudiante e
       LEFT JOIN (
              SELECT estudiante_id,
                     round(avg(gpa), 2)::float8 AS indice,
                     count(*)::int AS evaluaciones
                FROM historial_calificacion
               GROUP BY estudiante_id
            ) h ON h.estudiante_id = e.id
      WHERE ($1::text IS NULL OR e.nombre ILIKE '%' || $1 || '%'
                              OR e.cedula ILIKE '%' || $1 || '%'
                              OR e.programa ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR e.estado::text = $2)
      ORDER BY e.nombre
      LIMIT $3 OFFSET $4`,
    [busqueda, estado, porPagina, salto],
  );
}

/**
 * Cuántos expedientes hay con estos filtros, para la paginación.
 *
 * Mismo WHERE que `listaExpedientes`, aparte y no como `count(*) over()` en la
 * misma consulta: con la página vacía (fuera de rango) esa variante no
 * devuelve ninguna fila y se pierde el total, justo cuando más hace falta para
 * poder volver atrás.
 */
export async function contarExpedientes({
  busqueda = null,
  estado = null,
}: {
  busqueda?: string | null;
  estado?: EstadoEstudiante | null;
} = {}): Promise<number> {
  const fila = await consultarUna<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM estudiante e
      WHERE ($1::text IS NULL OR e.nombre ILIKE '%' || $1 || '%'
                              OR e.cedula ILIKE '%' || $1 || '%'
                              OR e.programa ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR e.estado::text = $2)`,
    [busqueda, estado],
  );

  return fila?.total ?? 0;
}

export type CifrasExpedientes = {
  total: number;
  activos: number;
  en_proceso: number;
  graduados: number;
};

/**
 * Las cuatro cifras de la cabecera.
 *
 * "En proceso" son los cuatro estados del embudo de reclutamiento: quien todavía
 * no está cursando. Es la cifra que dice cuánta gente hay esperando entrar, y no
 * se puede sacar de "total menos activos" porque ahí caerían también los
 * graduados y los suspendidos.
 *
 * "Graduados" ocupa el sitio que tenía "Becados": desde la 0047 todo
 * estudiante es becado, así que esa cifra era el total repetido.
 */
export async function cifrasExpedientes(): Promise<CifrasExpedientes> {
  const fila = await consultarUna<CifrasExpedientes>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE estado = 'activo')::int AS activos,
            count(*) FILTER (WHERE estado IN ('reclutado', 'postulado',
                                              'academia_liderazgo',
                                              'standby_tecnico'))::int AS en_proceso,
            count(*) FILTER (WHERE estado = 'graduado')::int AS graduados
       FROM estudiante`,
  );

  return fila ?? { total: 0, activos: 0, en_proceso: 0, graduados: 0 };
}

/** Un bloque fijo de familia, con sus cuatro campos. */
export type FamiliarFijo = {
  nombre: string | null;
  edad: number | null;
  telefono: string | null;
  profesion: string | null;
};

/**
 * El expediente completo, para abrir la pantalla de edición.
 *
 * Aplana las seis tablas en un solo objeto cuyas claves son los `name` de los
 * campos del formulario: así la pantalla de edición pasa este objeto directo
 * como valor inicial de cada campo, sin una capa intermedia que traduzca de un
 * lado a otro y se pueda desincronizar.
 */
export type ExpedienteCompleto = {
  id: string;
  nombre: string;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  nacionalidad: string | null;
  genero: string | null;
  sexo_documento: string | null;
  religion: string | null;
  foto_url: string | null;
  estado: string;
  programa: string | null;
  donde_estudia: string | null;
  universidad: string | null;
  fecha_ingreso: string | null;
  centro_educativo: string | null;
  director_centro: string | null;
  facilitador_habitudes: string | null;
  breve_historia_habitudes: string | null;
  con_quien_vive: string | null;
  por_que_vive_con_esa_persona: string | null;
  hermanos_cantidad: number | null;
  casa_propia: string | null;
  tipo_casa: string | null;
  bano_dentro: string | null;
  habitaciones: number | null;
  camas: number | null;
  quienes_duermen_cama: string | null;
  direccion: string | null;
  comunidad: string | null;
  ciudad_residencia: string | null;
  municipio?: string | null;
  distrito_municipal?: string | null;
  sector?: string | null;
  calle?: string | null;
  numero_casa?: string | null;
  referencia_ubicacion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  enfermedades: string | null;
  alergias: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  historia_de_vida: string | null;
  situacion_familiar: string | null;
  situacion_economica: string | null;
  motivo_beca: string | null;
  metas_academicas: string | null;
  envio_correo_patrocinador: string | null;
  asistio_reunion_mensual: string | null;
  amonestaciones: string | null;
  solicitudes_pendientes: string | null;
  notas_adicionales: string | null;
  familiares: Partial<Record<(typeof FAMILIA_FIJA)[number], FamiliarFijo>>;
};

/**
 * El expediente completo de un estudiante, para la pantalla de detalle/edición.
 *
 * Tres consultas y no un solo JOIN gigante: `perfil_vivienda`, `perfil_salud` y
 * `perfil_socioeconomico` son 1:1 y sí se pueden unir en una fila, pero
 * `familiar` es 1:N y mezclarla ahí multiplicaría la fila del estudiante por
 * cada familiar. `null` si el id no existe.
 */
export async function obtenerExpediente(
  id: string,
): Promise<ExpedienteCompleto | null> {
  const fila = await consultarUna<
    Omit<ExpedienteCompleto, "familiares">
  >(
    `SELECT e.id,
            e.nombre,
            e.cedula,
            e.email::text AS email,
            e.telefono,
            e.fecha_nacimiento::text AS fecha_nacimiento,
            e.lugar_nacimiento,
            e.nacionalidad,
            e.genero::text AS genero,
            e.sexo_documento,
            e.religion,
            e.foto_url,
            e.estado::text AS estado,
            e.programa,
            e.donde_estudia,
            e.universidad,
            e.fecha_ingreso::text AS fecha_ingreso,
            e.centro_educativo,
            e.director_centro,
            e.facilitador_habitudes,
            e.breve_historia_habitudes,
            v.con_quien_vive,
            v.por_que_vive_con_esa_persona,
            v.hermanos_cantidad,
            v.casa_propia,
            v.tipo_casa,
            v.bano_dentro,
            v.habitaciones,
            v.camas,
            v.quienes_duermen_cama,
            v.direccion,
            v.comunidad,
            v.ciudad_residencia,
            v.municipio,
            v.distrito_municipal,
            v.sector,
            v.calle,
            v.numero_casa,
            v.referencia_ubicacion,
            v.latitud::float AS latitud,
            v.longitud::float AS longitud,
            s.enfermedades,
            s.alergias,
            s.contacto_emergencia_nombre,
            s.contacto_emergencia_telefono,
            o.historia_de_vida,
            o.situacion_familiar,
            o.situacion_economica,
            o.motivo_beca,
            o.metas_academicas,
            e.envio_correo_patrocinador,
            e.asistio_reunion_mensual,
            e.amonestaciones,
            e.solicitudes_pendientes,
            e.notas_adicionales
       FROM estudiante e
       LEFT JOIN perfil_vivienda      v ON v.estudiante_id = e.id
       LEFT JOIN perfil_salud         s ON s.estudiante_id = e.id
       LEFT JOIN perfil_socioeconomico o ON o.estudiante_id = e.id
      WHERE e.id = $1`,
    [id],
  );

  if (!fila) return null;

  const familiares = await consultar<{
    parentesco: (typeof FAMILIA_FIJA)[number];
    nombre: string | null;
    edad: number | null;
    telefono: string | null;
    profesion: string | null;
  }>(
    `SELECT parentesco::text AS parentesco, nombre, edad, telefono, profesion
       FROM familiar
      WHERE estudiante_id = $1
        AND parentesco = ANY($2::parentesco[])`,
    [id, FAMILIA_FIJA],
  );

  return {
    ...fila,
    familiares: Object.fromEntries(
      familiares.map((f) => [
        f.parentesco,
        {
          nombre: f.nombre,
          edad: f.edad,
          telefono: f.telefono,
          profesion: f.profesion,
        },
      ]),
    ),
  };
}

export type CuentaVinculada = {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  ultimo_acceso: Date | null;
};

/**
 * La cuenta del portal con la que entra el estudiante de este expediente.
 *
 * El vínculo es `estudiante.usuario_id` (0005): sin él, el estudiante puede
 * tener expediente pero su portal no ve ni sus materias ni sus tareas, porque
 * todo el portal filtra por el estudiante de la sesión.
 */
export async function cuentaVinculada(
  estudianteId: string,
): Promise<CuentaVinculada | null> {
  return consultarUna<CuentaVinculada>(
    `SELECT u.id, u.nombre, u.email::text AS email, u.activo, u.ultimo_acceso
       FROM estudiante e
       JOIN usuario u ON u.id = e.usuario_id
      WHERE e.id = $1`,
    [estudianteId],
  );
}

export type CuentaSinVincular = { id: string; nombre: string; email: string };

/**
 * Cuentas con rol `estudiante` que todavía no están atadas a ningún
 * expediente: las únicas que se pueden ofrecer, porque `usuario_id` es UNIQUE
 * y una cuenta solo puede ser de una persona.
 */
export async function cuentasEstudianteSinVincular(): Promise<CuentaSinVincular[]> {
  return consultar<CuentaSinVincular>(
    `SELECT u.id, u.nombre, u.email::text AS email
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre = 'estudiante'
        AND u.activo
        AND NOT EXISTS (SELECT 1 FROM estudiante e WHERE e.usuario_id = u.id)
      ORDER BY u.nombre
      LIMIT 500`,
  );
}
