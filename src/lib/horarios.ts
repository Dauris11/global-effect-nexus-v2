/**
 * Utilidades para análisis de horarios recurrentes y proyección de clases en calendarios.
 *
 * Convierte un texto descriptivo de horario ("Viernes 08:00 - 10:00", "Lunes y Miércoles 14:00 - 16:00")
 * en fechas concretas dentro del rango activo del cuatrimestre para mostrar en la agenda y calendario.
 */

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

export type HorarioParseado = {
  dias: DiaSemana[];
  horaInicio: string | null;
  horaFin: string | null;
};

/**
 * Extrae los días de la semana a partir de una cadena de horario en español.
 * Ejemplos: "Viernes 08:00 - 10:00", "Lunes y Miércoles 14:00 - 16:00", "Sábados 9 AM"
 */
export function diasDeHorario(horario: string | null | undefined): DiaSemana[] {
  if (!horario) return [];

  const normalizado = horario
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const dias: Set<DiaSemana> = new Set();

  // Rangos tipo "lunes a viernes"
  if (/lunes\s*(?:a|hasta)\s*viernes/.test(normalizado)) {
    return [1, 2, 3, 4, 5];
  }
  if (/lunes\s*(?:a|hasta)\s*jueves/.test(normalizado)) {
    return [1, 2, 3, 4];
  }
  if (/lunes\s*(?:a|hasta)\s*sabado/.test(normalizado)) {
    return [1, 2, 3, 4, 5, 6];
  }

  // Días individuales
  if (/\bdom(?:ingo|ingos)?\b/.test(normalizado)) dias.add(0);
  if (/\blun(?:es)?\b/.test(normalizado)) dias.add(1);
  if (/\bmar(?:tes)?\b/.test(normalizado)) dias.add(2);
  if (/\bmie(?:rcoles)?\b/.test(normalizado)) dias.add(3);
  if (/\bjue(?:ves)?\b/.test(normalizado)) dias.add(4);
  if (/\bvie(?:rnes)?\b/.test(normalizado)) dias.add(5);
  if (/\bsab(?:ado|ados)?\b/.test(normalizado)) dias.add(6);

  return Array.from(dias).sort((a, b) => a - b);
}

/**
 * Extrae la hora de inicio y fin en formato "HH:MM" (24h) a partir de una cadena de horario.
 */
export function horasDeHorario(horario: string | null | undefined): {
  inicio: string | null;
  fin: string | null;
} {
  if (!horario) return { inicio: null, fin: null };

  const normalizado = horario
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const rangoRegex =
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:[-–a]|hasta)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const matchRango = normalizado.match(rangoRegex);

  if (matchRango) {
    let h1 = parseInt(matchRango[1], 10);
    const m1 = matchRango[2] ?? "00";
    const ampm1 = matchRango[3]?.toLowerCase();

    let h2 = parseInt(matchRango[4], 10);
    const m2 = matchRango[5] ?? "00";
    const ampm2 = matchRango[6]?.toLowerCase();

    if (ampm1 === "pm" && h1 < 12) h1 += 12;
    if (ampm1 === "am" && h1 === 12) h1 = 0;
    if (ampm2 === "pm" && h2 < 12) h2 += 12;
    if (ampm2 === "am" && h2 === 12) h2 = 0;

    const inicio = `${String(h1).padStart(2, "0")}:${m1}`;
    const fin = `${String(h2).padStart(2, "0")}:${m2}`;
    return { inicio, fin };
  }

  const simpleRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const matchSimple = normalizado.match(simpleRegex);
  if (matchSimple) {
    let h = parseInt(matchSimple[1], 10);
    const m = matchSimple[2] ?? "00";
    const ampm = matchSimple[3]?.toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return { inicio: `${String(h).padStart(2, "0")}:${m}`, fin: null };
  }

  return { inicio: null, fin: null };
}

export type ClaseParaProyeccion = {
  id: string;
  nombre: string;
  codigo?: string | null;
  horario: string | null;
  aula?: string | null;
  profesor?: string | null;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
};

export type EntradaClaseProyectada = {
  id: string;
  materiaId: string;
  titulo: string;
  detalle: string | null;
  dia: string; // YYYY-MM-DD
  hora: string | null;
  horaFin: string | null;
  ubicacion: string | null;
};

/**
 * Proyecta una lista de clases en sus fechas específicas de la semana dentro de un rango dado,
 * respetando el período de impartición (fechaInicio y fechaFin).
 */
export function proyectarClasesEnRango({
  clases,
  desde,
  hasta,
}: {
  clases: readonly ClaseParaProyeccion[];
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
}): EntradaClaseProyectada[] {
  const proyectadas: EntradaClaseProyectada[] = [];

  for (const clase of clases) {
    const dias = diasDeHorario(clase.horario);
    if (dias.length === 0) continue;

    const { inicio, fin } = horasDeHorario(clase.horario);

    // Fechas efectivas delimitadas por el periodo de la materia y el rango pedido
    const iniStr = clase.fechaInicio > desde ? clase.fechaInicio : desde;
    const finStr = clase.fechaFin < hasta ? clase.fechaFin : hasta;

    if (iniStr > finStr) continue;

    const [yIni, mIni, dIni] = iniStr.split("-").map(Number);
    const [yFin, mFin, dFin] = finStr.split("-").map(Number);

    const cursor = new Date(Date.UTC(yIni, mIni - 1, dIni, 12, 0, 0));
    const limite = new Date(Date.UTC(yFin, mFin - 1, dFin, 12, 0, 0));

    while (cursor <= limite) {
      const diaSemana = cursor.getUTCDay() as DiaSemana;
      if (dias.includes(diaSemana)) {
        const y = cursor.getUTCFullYear();
        const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
        const d = String(cursor.getUTCDate()).padStart(2, "0");
        const fechaDia = `${y}-${m}-${d}`;

        proyectadas.push({
          id: `clase-${clase.id}-${fechaDia}`,
          materiaId: clase.id,
          titulo: clase.codigo ? `${clase.codigo} · ${clase.nombre}` : clase.nombre,
          detalle: [clase.aula, clase.profesor].filter(Boolean).join(" · ") || null,
          dia: fechaDia,
          hora: inicio,
          horaFin: fin,
          ubicacion: clase.aula ?? null,
        });
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return proyectadas.sort((a, b) =>
    a.dia === b.dia
      ? (a.hora ?? "").localeCompare(b.hora ?? "")
      : a.dia.localeCompare(b.dia)
  );
}

