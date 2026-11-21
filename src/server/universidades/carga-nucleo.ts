import { registrar } from "@/lib/auditoria";
import { claveCodigo, CONFIANZA_MINIMA, emparejarEstudiante, filasDeRespuesta, resolverLetra, resolverMateria, type FilaLeida, type MateriaPensum, type ProblemaFila } from "@/lib/carga-calificaciones";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { calcularIndice, type ReglasIndice } from "@/lib/indice-academico";
import { leerDocumento, MAXIMO_DOCUMENTO_OCR, TIPOS_DOCUMENTO_OCR } from "@/lib/ia";
import { umbralDeIndice } from "@/server/academico/indice";

/**
 * Carga guiada de calificaciones: leer el listado, emparejar cada fila con su
 * estudiante y su materia, guardar el borrador y, cuando una persona lo
 * confirma, escribir los resultados.
 *
 * Tres reglas que no se negocian:
 *  1. Nada llega a `resultado_materia` sin confirmación humana.
 *  2. Una fila que no se pueda emparejar con certeza queda marcada; no se adivina.
 *  3. Cada estudiante es todo o nada: si una sola de sus filas tiene problema, no
 *     se le escribe ninguna (igual que `registrarCalificaciones`), y el resto de
 *     la carga sí se aplica.
 */

type UniversidadCarga = {
  id: string;
  siglas: string;
  nombre: string;
  regimen: string;
  puntos_por_letra: Record<string, number>;
  retirada_cuenta_en_divisor: boolean;
  redondeo_indice: "truncar" | "redondear";
  indice_minimo_periodo: number | null;
  indice_minimo_acumulado: number | null;
  indice_maximo: number | null;
};

export const universidadDeCarga = (id: string) =>
  consultarUna<UniversidadCarga>(
    `SELECT id, siglas, nombre, regimen, puntos_por_letra, retirada_cuenta_en_divisor, redondeo_indice,
            indice_minimo_periodo::float8 AS indice_minimo_periodo, indice_minimo_acumulado::float8 AS indice_minimo_acumulado,
            indice_maximo::float8 AS indice_maximo
       FROM universidad WHERE id = $1 AND activa`,
    [id],
  );

const BLOQUEANTES = (p: readonly string[]) => p.some((x) => x !== "confianza_baja");

function instrucciones(u: UniversidadCarga): string {
  return [
    `Eres un lector de listados de calificaciones de ${u.nombre} (${u.siglas}), régimen por ${u.regimen}.`,
    "Transcribes lo que VES. No completas, no corriges, no adivinas, no calculas.",
    "Responde SOLO con un objeto JSON, sin texto alrededor y sin bloque de código:",
    '{"filas":[{"matricula":"…","nombre":"…","codigo":"…","materia":"…","letra":"…","nota":"…","confianza":0}]}',
    "Una fila por estudiante y materia. Si el documento es el acta de UNA materia con varios estudiantes, repite el código y la materia en cada fila.",
    "Si el documento es el récord de UN estudiante con varias materias, repite su nombre y matrícula en cada fila.",
    '"matricula" y "nombre" tal como aparecen (null si no aparecen). "codigo" y "materia" tal como aparecen (null si falta alguno de los dos).',
    '"letra" es la calificación literal (A, B, C, D, F, R de retirada, P). "nota" es la numérica si la hay, o null.',
    '"confianza" es un entero de 0 a 100: tu certeza de haber leído bien ESA fila.',
    'Si el documento no es un listado de calificaciones o no se lee, devuelve {"filas":[]}.',
  ].join("\n");
}

export type LecturaFilas =
  | { estado: "ok"; filas: FilaLeida[] }
  | { estado: "tipo_no_admitido" | "demasiado_grande" | "sin_clave" | "ilegible" | "sin_filas" | "error" };

/** PDF o foto → filas, con las mismas comprobaciones previas que el OCR de identidad. */
export async function leerFilasDeArchivo(archivo: { mime: string; base64: string; bytes: number }, u: UniversidadCarga): Promise<LecturaFilas> {
  if (!(TIPOS_DOCUMENTO_OCR as readonly string[]).includes(archivo.mime)) return { estado: "tipo_no_admitido" };
  if (archivo.bytes > MAXIMO_DOCUMENTO_OCR) return { estado: "demasiado_grande" };

  const lectura = await leerDocumento(
    { mime: archivo.mime, base64: archivo.base64 },
    instrucciones(u),
    "Lee este listado y devuelve el JSON con todas las filas.",
    { maxTokens: 8000 },
  );

  if (lectura.estado === "sin_clave") return { estado: "sin_clave" };
  if (lectura.estado === "ilegible" || lectura.estado === "rechazada") return { estado: "ilegible" };
  if (lectura.estado !== "ok") return { estado: "error" };

  const filas = filasDeRespuesta(lectura.datos);

  return filas.length === 0 ? { estado: "sin_filas" } : { estado: "ok", filas };
}

type Candidato = { id: string; nombre: string; matricula: string | null; pensum_id: string | null };

type Contexto = {
  letras: string[];
  candidatos: Candidato[];
  pensums: Map<string, MateriaPensum[]>;
};

async function contextoDe(u: UniversidadCarga): Promise<Contexto> {
  const candidatos = await consultar<Candidato>(
    `SELECT id, nombre, matricula, pensum_id FROM estudiante WHERE universidad_id = $1`,
    [u.id],
  );
  const ids = [...new Set(candidatos.flatMap((c) => (c.pensum_id ? [c.pensum_id] : [])))];
  const materias = ids.length
    ? await consultar<{ pensum_id: string; codigo: string; nombre: string; creditos: number }>(
        `SELECT pensum_id, codigo, nombre, creditos FROM pensum_materia WHERE pensum_id = ANY($1::uuid[])`,
        [ids],
      )
    : [];
  const pensums = new Map<string, MateriaPensum[]>();

  for (const m of materias) pensums.set(m.pensum_id, [...(pensums.get(m.pensum_id) ?? []), { codigo: m.codigo, nombre: m.nombre, creditos: m.creditos }]);

  return { letras: Object.keys(u.puntos_por_letra), candidatos, pensums };
}

type FilaEvaluada = { estudianteId: string | null; por: "matricula" | "nombre" | "manual" | null; codigo: string | null; letra: string | null; problemas: ProblemaFila[] };

function evaluar(
  fila: FilaLeida,
  est: Candidato | null,
  por: "matricula" | "nombre" | "manual" | null,
  ctx: Contexto,
  motivo?: "sin_candidato" | "ambiguo" | "matricula_otra_persona",
): FilaEvaluada {
  const problemas: ProblemaFila[] = [];
  const letra = resolverLetra(fila.letra, ctx.letras);

  if (!est) {
    problemas.push(motivo === "ambiguo" ? "ambiguo" : motivo === "matricula_otra_persona" ? "matricula_otra_persona" : "sin_estudiante");

    return { estudianteId: null, por: null, codigo: null, letra: letra ?? fila.letra, problemas };
  }

  const pensum = est.pensum_id ? ctx.pensums.get(est.pensum_id) : undefined;
  let codigo: string | null = null;

  if (!pensum) problemas.push("sin_pensum");
  else {
    codigo = resolverMateria(fila, pensum)?.codigo ?? null;
    if (!codigo) problemas.push("materia_fuera_del_pensum");
  }

  if (!letra) problemas.push("letra_invalida");
  if (fila.confianza !== null && fila.confianza < CONFIANZA_MINIMA) problemas.push("confianza_baja");

  return { estudianteId: est.id, por, codigo, letra: letra ?? fila.letra, problemas };
}

export type ResumenBorrador = { cargaId: string; filas: number; sinEmparejar: number; conProblemas: number; estudiantes: number };

/** Evalúa las filas y guarda el borrador para que una persona lo revise. */
export async function guardarBorrador(args: {
  universidad: UniversidadCarga;
  anio: number;
  ronda: number;
  medio: "pdf" | "imagen" | "lista";
  filas: FilaLeida[];
  usuarioId: string;
}): Promise<ResumenBorrador> {
  const ctx = await contextoDe(args.universidad);
  const vistas = new Set<string>();
  const evaluadas = args.filas.map((f) => {
    const emp = emparejarEstudiante(f, ctx.candidatos);
    const est = emp.estado === "emparejado" ? (ctx.candidatos.find((c) => c.id === emp.estudianteId) ?? null) : null;
    const ev = evaluar(f, est, emp.estado === "emparejado" ? emp.por : null, ctx, emp.estado === "sin_emparejar" ? emp.motivo : undefined);

    // La misma materia del mismo estudiante dos veces en el mismo listado: ninguna de las dos se da por buena.
    if (ev.estudianteId && ev.codigo) {
      const clave = `${ev.estudianteId}|${claveCodigo(ev.codigo)}`;

      if (vistas.has(clave)) ev.problemas.push("repetida");
      vistas.add(clave);
    }

    return { f, ev };
  });

  const cargaId = await enTransaccion(async (c) => {
    const r = await c.query<{ id: string }>(
      `INSERT INTO carga_calificaciones (universidad_id, anio, ronda, medio, creado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [args.universidad.id, args.anio, args.ronda, args.medio, args.usuarioId],
    );
    const id = r.rows[0].id;

    for (const [i, { f, ev }] of evaluadas.entries()) {
      await c.query(
        `INSERT INTO carga_calificaciones_fila
           (carga_id, orden, matricula, nombre_leido, codigo_leido, materia_leida, letra, nota, confianza, estudiante_id, codigo, emparejado_por, problemas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [id, i + 1, f.matricula, f.nombre, f.codigo, f.materia, ev.letra, f.nota, f.confianza, ev.estudianteId, ev.codigo, ev.por, ev.problemas],
      );
    }

    return id;
  });

  await registrar({
    usuarioId: args.usuarioId,
    accion: "calificaciones.carga_creada",
    entidad: "carga_calificaciones",
    entidadId: cargaId,
    datos: { universidad: args.universidad.siglas, periodo: `${args.anio}-${args.ronda}`, medio: args.medio, filas: evaluadas.length },
  });

  return {
    cargaId,
    filas: evaluadas.length,
    sinEmparejar: evaluadas.filter((e) => !e.ev.estudianteId).length,
    conProblemas: evaluadas.filter((e) => BLOQUEANTES(e.ev.problemas)).length,
    estudiantes: new Set(evaluadas.flatMap((e) => (e.ev.estudianteId ? [e.ev.estudianteId] : []))).size,
  };
}

/** Asignar a mano una fila sin emparejar (o corregir un emparejamiento): se vuelve a evaluar contra el pénsum de esa persona. */
export async function asignarEstudianteAFila(filaId: string, estudianteId: string): Promise<"ok" | "no_encontrada" | "estudiante_de_otra_universidad"> {
  const fila = await consultarUna<{ carga_id: string; matricula: string | null; nombre_leido: string | null; codigo_leido: string | null; materia_leida: string | null; letra: string | null; nota: string | null; confianza: number | null; universidad_id: string; estado: string }>(
    `SELECT f.carga_id, f.matricula, f.nombre_leido, f.codigo_leido, f.materia_leida, f.letra, f.nota::text, f.confianza, c.universidad_id, c.estado
       FROM carga_calificaciones_fila f JOIN carga_calificaciones c ON c.id = f.carga_id WHERE f.id = $1`,
    [filaId],
  );

  if (!fila || fila.estado !== "borrador") return "no_encontrada";

  const u = await universidadDeCarga(fila.universidad_id);

  if (!u) return "no_encontrada";

  const ctx = await contextoDe(u);
  const est = ctx.candidatos.find((c) => c.id === estudianteId);

  if (!est) return "estudiante_de_otra_universidad";

  const ev = evaluar(
    { matricula: fila.matricula, nombre: fila.nombre_leido, codigo: fila.codigo_leido, materia: fila.materia_leida, letra: fila.letra, nota: fila.nota === null ? null : Number(fila.nota), confianza: fila.confianza },
    est,
    "manual",
    ctx,
  );

  await consultar(`UPDATE carga_calificaciones_fila SET estudiante_id = $2, codigo = $3, letra = $4, emparejado_por = 'manual', problemas = $5 WHERE id = $1`, [filaId, ev.estudianteId, ev.codigo, ev.letra, ev.problemas]);

  return "ok";
}

export type AlertaDeCarga = { estudianteId: string; nombre: string; tipo: "periodo" | "acumulado"; indice: number; umbral: number };

export type ResultadoConfirmacion =
  | { estado: "ok"; estudiantesEscritos: number; notasEscritas: number; estudiantesOmitidos: number; filasSinEstudiante: number; alertas: AlertaDeCarga[] }
  | { estado: "no_encontrada" | "error" };

/** Escribe los resultados de la carga: por estudiante, todo o nada, y calcula las alertas resultantes. */
export async function confirmarCarga(cargaId: string, usuarioId: string): Promise<ResultadoConfirmacion> {
  const carga = await consultarUna<{ universidad_id: string; anio: number; ronda: number }>(
    `SELECT universidad_id, anio, ronda FROM carga_calificaciones WHERE id = $1 AND estado = 'borrador'`,
    [cargaId],
  );

  if (!carga) return { estado: "no_encontrada" };

  const filas = await consultar<{ estudiante_id: string | null; codigo: string | null; letra: string | null; nota: string | null; problemas: string[] }>(
    `SELECT estudiante_id, codigo, letra, nota::text, problemas FROM carga_calificaciones_fila WHERE carga_id = $1 ORDER BY orden`,
    [cargaId],
  );
  const sinEstudiante = filas.filter((f) => !f.estudiante_id).length;
  const porEstudiante = new Map<string, typeof filas>();

  for (const f of filas) if (f.estudiante_id) porEstudiante.set(f.estudiante_id, [...(porEstudiante.get(f.estudiante_id) ?? []), f]);

  // Un estudiante se escribe solo si TODAS sus filas están limpias (la confianza baja no bloquea: la revisó una persona).
  const escribibles = [...porEstudiante.entries()].filter(([, fs]) => fs.every((f) => f.codigo && f.letra && !BLOQUEANTES(f.problemas)));
  const omitidos = porEstudiante.size - escribibles.length;

  try {
    let notas = 0;

    await enTransaccion(async (c) => {
      for (const [estudianteId, fs] of escribibles) {
        for (const f of fs) {
          const r = await c.query(
            `INSERT INTO resultado_materia (estudiante_id, codigo, nombre, creditos, anio, ronda, letra, nota_numerica, fuente)
             SELECT $1, pm.codigo, pm.nombre, pm.creditos, $3, $4, $5, $6, 'carga'
               FROM estudiante e JOIN pensum_materia pm ON pm.pensum_id = e.pensum_id AND pm.codigo = $2
              WHERE e.id = $1
             ON CONFLICT (estudiante_id, codigo, anio, ronda)
             DO UPDATE SET letra = EXCLUDED.letra, nota_numerica = EXCLUDED.nota_numerica, fuente = 'carga'`,
            [estudianteId, f.codigo, carga.anio, carga.ronda, f.letra, f.nota],
          );

          notas += r.rowCount ?? 0;
        }
      }

      await c.query(
        `UPDATE carga_calificaciones SET estado = 'confirmada', confirmada_por = $2, confirmada_at = now(), escritas = $3 WHERE id = $1`,
        [cargaId, usuarioId, notas],
      );
    });

    await registrar({
      usuarioId,
      accion: "calificaciones.carga_confirmada",
      entidad: "carga_calificaciones",
      entidadId: cargaId,
      datos: { estudiantes: escribibles.length, notas, omitidos },
    });

    const alertas = await alertasDeCarga(carga.universidad_id, carga.anio, carga.ronda, escribibles.map(([id]) => id));

    return { estado: "ok", estudiantesEscritos: escribibles.length, notasEscritas: notas, estudiantesOmitidos: omitidos, filasSinEstudiante: sinEstudiante, alertas };
  } catch (error) {
    console.error("[academico] no se pudo confirmar la carga de calificaciones", error);

    return { estado: "error" };
  }
}

/** Índice del período recién cargado y acumulado de cada estudiante escrito, contra los umbrales de su universidad. */
async function alertasDeCarga(universidadId: string, anio: number, ronda: number, estudiantes: string[]): Promise<AlertaDeCarga[]> {
  if (estudiantes.length === 0) return [];

  const u = await universidadDeCarga(universidadId);

  if (!u) return [];

  const global = await umbralDeIndice();
  const reglas: ReglasIndice = { puntosPorLetra: u.puntos_por_letra, retiradaCuentaEnDivisor: u.retirada_cuenta_en_divisor, redondeo: u.redondeo_indice };
  const umbralAcumulado = u.indice_minimo_acumulado ?? global;
  const umbralPeriodo = u.indice_minimo_periodo ?? umbralAcumulado;
  const filas = await consultar<{ id: string; nombre: string; creditos: number; letra: string; acumulado: number | null }>(
    `SELECT e.id, e.nombre, r.creditos, r.letra, indice_estudiante(e.id)::float8 AS acumulado
       FROM estudiante e JOIN resultado_materia r ON r.estudiante_id = e.id AND r.anio = $2 AND r.ronda = $3
      WHERE e.id = ANY($1::uuid[])`,
    [estudiantes, anio, ronda],
  );
  const alertas: AlertaDeCarga[] = [];

  for (const id of estudiantes) {
    const propias = filas.filter((f) => f.id === id);

    if (propias.length === 0) continue;

    const periodo = calcularIndice(propias.map((f) => ({ creditos: f.creditos, resultado: f.letra })), reglas).indice;

    if (periodo !== null && periodo < umbralPeriodo) alertas.push({ estudianteId: id, nombre: propias[0].nombre, tipo: "periodo", indice: periodo, umbral: umbralPeriodo });
    if (propias[0].acumulado !== null && propias[0].acumulado < umbralAcumulado) alertas.push({ estudianteId: id, nombre: propias[0].nombre, tipo: "acumulado", indice: propias[0].acumulado, umbral: umbralAcumulado });
  }

  return alertas;
}
