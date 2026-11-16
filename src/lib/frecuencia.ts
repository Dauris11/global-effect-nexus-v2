/**
 * Limitador de frecuencia en memoria por ventana deslizante.
 *
 * Protege los puntos de entrada públicos sin sesión (`/api/transporte/posicion`
 * y la inscripción puntual desde `/transporte`) frente a ráfagas automatizadas
 * desde una misma IP.
 */

type VentanaIp = {
  conteo: number;
  reiniciaEn: number;
};

const ventanas = new Map<string, VentanaIp>();
const MAX_CLAVES = 5000;

/**
 * Extrae la IP del cliente a partir de las cabeceras estándar del proxy
 * (`x-forwarded-for` o `x-real-ip`).
 */
export function ipDeCabeceras(cabeceras: Headers): string {
  const reenviada = cabeceras.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return cabeceras.get("x-real-ip")?.trim() || "local";
}

/**
 * Devuelve `true` si la clave aún está dentro del cupo permitido en la ventana,
 * o `false` si ya alcanzó el tope.
 */
export function permitirFrecuencia(
  clave: string,
  limite: number,
  ventanaMs: number,
  ahora = Date.now(),
): boolean {
  if (ventanas.size > MAX_CLAVES) {
    for (const [k, v] of ventanas) {
      if (v.reiniciaEn <= ahora) ventanas.delete(k);
    }
  }

  const actual = ventanas.get(clave);
  if (!actual || actual.reiniciaEn <= ahora) {
    ventanas.set(clave, { conteo: 1, reiniciaEn: ahora + ventanaMs });
    return true;
  }

  if (actual.conteo >= limite) {
    return false;
  }

  actual.conteo += 1;
  return true;
}
