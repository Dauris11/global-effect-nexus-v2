/**
 * Eventos que el servidor manda al navegador mientras el agente trabaja
 * (`/api/ia/chat`): una línea JSON por evento. Viven aquí, sin importar nada
 * del servidor, para que el componente cliente y el motor compartan el tipo.
 */
export type EventoTurno =
  | { t: "delta"; texto: string }
  | {
      t: "paso";
      id: string;
      herramienta: string;
      estado: "ejecutando" | "ok" | "error";
      resumen: string;
    }
  | { t: "aprobacion"; accionId: string; herramienta: string; resumen: string }
  | { t: "fin"; texto: string; entrada: number; salida: number }
  | { t: "error"; codigo: "sin_clave" | "rechazada" | "fallo" };

export type EventoConsumo = {
  t: "consumo";
  usados: number;
  tope: number | null;
  aviso: boolean;
};

export type EventoFlujo = EventoTurno | EventoConsumo;

/**
 * Lee la respuesta línea a línea y avisa de cada evento. Un trozo que llega
 * partido por la mitad de una línea se guarda hasta que llegue el resto.
 */
export async function leerFlujo(
  respuesta: Response,
  alEvento: (evento: EventoFlujo) => void,
): Promise<void> {
  if (!respuesta.body) return;

  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = "";

  for (;;) {
    const { done, value } = await lector.read();

    if (done) break;

    pendiente += decodificador.decode(value, { stream: true });

    let corte: number;

    while ((corte = pendiente.indexOf("\n")) >= 0) {
      const linea = pendiente.slice(0, corte).trim();

      pendiente = pendiente.slice(corte + 1);

      if (!linea) continue;

      try {
        alEvento(JSON.parse(linea) as EventoFlujo);
      } catch {
        // Una línea corrupta se descarta: el resto del flujo sigue siendo válido.
      }
    }
  }
}
