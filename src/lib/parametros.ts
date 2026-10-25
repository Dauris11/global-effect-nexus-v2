/**
 * Los parámetros institucionales: qué existe, de qué tipo es cada uno y cuál es
 * su valor normal.
 *
 * Esta lista es la verdad. La tabla `parametro_institucional` solo guarda lo que
 * se aparta del valor por defecto, y una clave que no esté aquí se ignora al
 * leer y se rechaza al guardar: así no hay ajustes que ningún código lee. Cada
 * parámetro de esta lista está CONECTADO a algo (ver `usadoEn`); si un día deja de
 * estarlo, se quita de aquí.
 */

export type GrupoParametro = "comedor" | "becas" | "asistente" | "contacto";

export type DefinicionParametro =
  | { clave: string; grupo: GrupoParametro; tipo: "hora"; defecto: string }
  | {
      clave: string;
      grupo: GrupoParametro;
      tipo: "numero";
      defecto: number;
      minimo: number;
      maximo: number;
      /** Decimales admitidos: 0 = entero. */
      decimales: number;
    }
  | { clave: string; grupo: GrupoParametro; tipo: "correo"; defecto: string };

export const GRUPOS: readonly GrupoParametro[] = ["comedor", "becas", "asistente", "contacto"];

export const DEFINICIONES = [
  { clave: "comedor.apertura", grupo: "comedor", tipo: "hora", defecto: "06:00" },
  { clave: "comedor.cierre", grupo: "comedor", tipo: "hora", defecto: "08:30" },
  { clave: "becas.indice_minimo", grupo: "becas", tipo: "numero", defecto: 3, minimo: 0, maximo: 4, decimales: 2 },
  { clave: "becas.asistencia_minima", grupo: "becas", tipo: "numero", defecto: 80, minimo: 0, maximo: 100, decimales: 0 },
  { clave: "becas.horas_servicio_mes", grupo: "becas", tipo: "numero", defecto: 8, minimo: 0, maximo: 60, decimales: 0 },
  { clave: "becas.nota_minima_360", grupo: "becas", tipo: "numero", defecto: 70, minimo: 0, maximo: 100, decimales: 0 },
  { clave: "asistente.dias_sin_verificar", grupo: "asistente", tipo: "numero", defecto: 90, minimo: 7, maximo: 730, decimales: 0 },
  { clave: "contacto.correo", grupo: "contacto", tipo: "correo", defecto: "info@globaleffect.org" },
] as const satisfies readonly DefinicionParametro[];

export type ClaveParametro = (typeof DEFINICIONES)[number]["clave"];

export type ValoresParametros = Record<ClaveParametro, string>;

export const DEFECTOS = Object.fromEntries(
  DEFINICIONES.map((d) => [d.clave, String(d.defecto)]),
) as ValoresParametros;

export function definicionDe(clave: string): DefinicionParametro | undefined {
  return DEFINICIONES.find((d) => d.clave === clave);
}

/** Resultado de validar lo que escribió una persona. */
export type Validacion = { ok: true; valor: string } | { ok: false; error: "hora" | "numero" | "rango" | "correo" };

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normaliza y valida un valor contra su definición. El texto de salida es el que se guarda. */
export function validarParametro(def: DefinicionParametro, crudo: string): Validacion {
  const texto = crudo.trim();

  switch (def.tipo) {
    case "hora":
      return HORA.test(texto) ? { ok: true, valor: texto } : { ok: false, error: "hora" };

    case "numero": {
      const n = Number(texto.replace(",", "."));

      if (!Number.isFinite(n) || texto === "") return { ok: false, error: "numero" };
      if (n < def.minimo || n > def.maximo) return { ok: false, error: "rango" };

      return { ok: true, valor: n.toFixed(def.decimales) };
    }

    case "correo":
      return CORREO.test(texto) && texto.length <= 120
        ? { ok: true, valor: texto.toLowerCase() }
        : { ok: false, error: "correo" };
  }
}

/** «06:00» → 360. */
export function aMinutos(hora: string): number {
  const [h = "0", m = "0"] = hora.split(":");

  return Number(h) * 60 + Number(m);
}

/** «08:30» → «8:30 AM». Igual en español e inglés: así se escribía en los textos. */
export function horaLegible(hora: string): string {
  const [h = 0, m = 0] = hora.split(":").map(Number);
  const sufijo = h >= 12 ? "PM" : "AM";
  const doce = h % 12 === 0 ? 12 : h % 12;

  return `${doce}:${String(m).padStart(2, "0")} ${sufijo}`;
}
