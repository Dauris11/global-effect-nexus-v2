import { consultar, consultarUna } from "@/lib/db";
import { SQL_HOY_RD } from "@/lib/fecha-rd";
import { estadoComedor } from "@/server/comida/consultas";

/**
 * Lo de «Mi beca» que no tenía consulta propia: el almuerzo de hoy y si el
 * transporte aplica a este estudiante.
 */

/** Zonas que usan la guagua (regla 16: solo estas cinco). */
const ZONAS_TRANSPORTE = ["rincon", "jima", "ranchito", "saba rey", "rancho viejo"];

const sinAcentos = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * ¿Le toca transporte? Sí si vive en una de las cinco zonas o si ya tiene una
 * inscripción activa (aunque la zona no esté escrita en su ficha): ofrecerle
 * «Inscribirme» a quien ya está inscrito sería absurdo, y esconderle el estado
 * a quien lo usa, peor. La comida NO entra en esta cuenta (regla 16).
 */
export async function usaTransporte(estudianteId: string | null): Promise<boolean> {
  if (!estudianteId) return false;

  const [vivienda, inscripcion] = await Promise.all([
    consultarUna<{ comunidad: string | null; direccion: string | null }>(
      `SELECT comunidad, direccion FROM perfil_vivienda WHERE estudiante_id = $1`,
      [estudianteId],
    ),
    consultarUna<{ id: string }>(
      `SELECT id FROM transporte_inscripcion_recurrente
        WHERE estudiante_id = $1 AND activo = true LIMIT 1`,
      [estudianteId],
    ),
  ]);

  if (inscripcion) return true;
  const lugar = sinAcentos(`${vivienda?.comunidad ?? ""} ${vivienda?.direccion ?? ""}`);

  return ZONAS_TRANSPORTE.some((zona) => lugar.includes(zona));
}

export type ComidaDeHoy = {
  /** Si el comedor admite inscripciones AHORA (la hora la decide la base). */
  abierto: boolean;
  inscrito: boolean;
};

/**
 * El comedor se inscribe por NOMBRE (`inscripcion_comida` no tiene estudiante), así
 * que «inscrito» es coincidir el nombre sin importar mayúsculas ni espacios.
 */
export async function comidaDeHoy(nombre: string): Promise<ComidaDeHoy> {
  const [estado, fila] = await Promise.all([
    estadoComedor(),
    consultar<{ id: string }>(
      `SELECT id FROM inscripcion_comida
        WHERE fecha = ${SQL_HOY_RD}
          AND lower(btrim(nombre)) = lower(btrim($1))
        LIMIT 1`,
      [nombre],
    ),
  ]);

  return { abierto: estado.abierto, inscrito: fila.length > 0 };
}
