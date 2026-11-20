/**
 * Lectura de las calificaciones de un cuatrimestre pegadas desde una hoja o un
 * listado: una materia por línea, `CÓDIGO ; LETRA ; NOTA` (la nota numérica es
 * opcional). Sirve ; tabulador o | como separador. Lo que no se pueda leer no se
 * adivina: la línea se devuelve como rechazada para que se corrija.
 */

export type CalificacionLeida = { codigo: string; letra: string; nota: number | null };

export type LecturaCalificaciones = { items: CalificacionLeida[]; rechazadas: number[] };

const MAX = 80;

export function leerCalificaciones(texto: string): LecturaCalificaciones {
  const items: CalificacionLeida[] = [];
  const rechazadas: number[] = [];
  const vistos = new Set<string>();

  texto.split(/\r?\n/).forEach((linea, i) => {
    if (!linea.trim() || linea.trimStart().startsWith("#")) return;

    const [codigo, letra, notaTxt] = linea.split(/[;\t|]/).map((c) => c.trim());
    const cod = (codigo ?? "").toUpperCase().replace(/\s+/g, "");
    const let_ = (letra ?? "").toUpperCase();
    const hayNota = notaTxt !== undefined && notaTxt !== "";
    const nota = hayNota ? Number(notaTxt.replace(",", ".")) : null;

    const valida =
      /^[A-Z]{3}\d{3}$/.test(cod) && /^[A-Z][+-]?$/.test(let_) && !vistos.has(cod) &&
      (nota === null || (Number.isFinite(nota) && nota >= 0 && nota <= 100));

    if (!valida || items.length >= MAX) {
      rechazadas.push(i + 1);

      return;
    }

    vistos.add(cod);
    items.push({ codigo: cod, letra: let_, nota });
  });

  return { items, rechazadas };
}
