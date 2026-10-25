/**
 * Corte de un documento en fragmentos para la base de conocimiento.
 *
 * Se corta por párrafos y no por un número fijo de caracteres: un fragmento que
 * empieza a media frase se cita mal y se recupera peor. Los párrafos se juntan
 * hasta `OBJETIVO` caracteres; uno solo más largo que `MAXIMO` se parte por
 * frases. Sin solapamiento: los títulos de sección viajan en `titulo`, que es lo
 * que da contexto a cada trozo.
 */

const OBJETIVO = 900;
const MAXIMO = 1600;

export function trocear(texto: string): string[] {
  const parrafos = texto
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap(partirLargo);

  const trozos: string[] = [];
  let actual = "";

  for (const parrafo of parrafos) {
    if (actual && actual.length + parrafo.length + 2 > OBJETIVO) {
      trozos.push(actual);
      actual = parrafo;
    } else {
      actual = actual ? `${actual}\n\n${parrafo}` : parrafo;
    }
  }

  if (actual) trozos.push(actual);

  return trozos;
}

function partirLargo(parrafo: string): string[] {
  if (parrafo.length <= MAXIMO) return [parrafo];

  const frases = parrafo.split(/(?<=[.!?])\s+/);
  const partes: string[] = [];
  let actual = "";

  for (const frase of frases) {
    if (actual && actual.length + frase.length + 1 > MAXIMO) {
      partes.push(actual);
      actual = frase;
    } else {
      actual = actual ? `${actual} ${frase}` : frase;
    }
  }

  if (actual) partes.push(actual);

  // Una "frase" sin puntos que sigue siendo enorme se corta en seco.
  return partes.flatMap((p) =>
    p.length <= MAXIMO
      ? [p]
      : (p.match(new RegExp(`.{1,${MAXIMO}}`, "gs")) ?? [p]),
  );
}

/*
 * El plazo de «norma sin revisar» (90 días por defecto) es el parámetro
 * `asistente.dias_sin_verificar`: se cambia en `/configuracion/parametros`.
 */

/** Los siete agentes (ver `ia-agentes.ts`). Aquí por no importar el RBAC en el cliente. */
export const AGENTES_CLAVES = [
  "agente_estudiante",
  "agente_docente",
  "agente_contabilidad",
  "agente_admin",
  "agente_habitudes",
  "agente_direccion",
  "agente_colaborador",
] as const;
