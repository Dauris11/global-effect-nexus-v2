import { consultar, consultarUna } from "@/lib/db";
import { agenteDeRol, type ClaveAgente } from "@/lib/ia-agentes";
import { conversar, type RespuestaIA, type TurnoIA, type UsoIA } from "@/lib/ia";
import type { Rol } from "@/lib/rbac";

/**
 * Puerta única al modelo para los chats del sistema.
 *
 * Antes cada chat llamaba a `conversar` directo y nadie sabía cuánto se
 * gastaba ni quién. Aquí se hace, en este orden: se busca el agente del rol, se
 * comprueba el acceso (agente activo, límite por hora, tope mensual), se llama
 * al modelo y se registra el consumo.
 *
 * Es un archivo de servidor sin `"use server"` a propósito: son funciones
 * internas, no acciones que el navegador pueda invocar.
 */

export type UsuarioIA = { id: string; rol: Rol };

export type RespuestaAgente = RespuestaIA | { estado: "cuota" } | { estado: "limite" };

export type ConfigAgente = {
  clave: ClaveAgente;
  instrucciones: string | null;
  modelo: string | null;
  maximoTokens: number | null;
  limiteHora: number;
  activo: boolean;
};

export type Acceso = "ok" | "inactivo" | "cuota" | "limite";

/**
 * Configuración del agente del rol. Si la tabla no tiene la fila (migración sin
 * aplicar) devuelve los valores por defecto: un agente sin configurar no debe
 * apagar el asistente.
 */
export async function configDelAgente(rol: Rol): Promise<ConfigAgente> {
  const clave = agenteDeRol(rol);

  const fila = await consultarUna<{
    instrucciones: string | null;
    modelo: string | null;
    max_tokens: number | null;
    limite_hora: number;
    activo: boolean;
  }>(
    `SELECT instrucciones, modelo, max_tokens, limite_hora, activo
       FROM ai_agente WHERE clave = $1`,
    [clave],
  ).catch(() => null);

  return {
    clave,
    instrucciones: fila?.instrucciones ?? null,
    modelo: fila?.modelo ?? null,
    maximoTokens: fila?.max_tokens ?? null,
    limiteHora: fila?.limite_hora ?? 30,
    activo: fila?.activo ?? true,
  };
}

/** ¿Puede este usuario hacer otra consulta ahora mismo? */
export async function verificarAcceso(
  usuario: UsuarioIA,
  config: ConfigAgente,
): Promise<Acceso> {
  if (!config.activo) return "inactivo";

  const hora = await consultarUna<{ n: string }>(
    `SELECT count(*) AS n FROM ai_uso
      WHERE usuario_id = $1 AND created_at > now() - interval '1 hour'`,
    [usuario.id],
  ).catch(() => null);

  if (Number(hora?.n ?? 0) >= config.limiteHora) return "limite";

  const consumo = await miConsumo(usuario);

  return consumo.agotada ? "cuota" : "ok";
}

export async function conversarComo(
  usuario: UsuarioIA,
  sistema: string,
  turnos: readonly TurnoIA[],
  conversacionId: string | null = null,
): Promise<RespuestaAgente> {
  const config = await configDelAgente(usuario.rol);
  const acceso = await verificarAcceso(usuario, config);

  if (acceso === "inactivo") return { estado: "rechazada" };
  if (acceso === "cuota") return { estado: "cuota" };
  if (acceso === "limite") return { estado: "limite" };

  const respuesta = await conversar(
    config.instrucciones ? `${sistema}\n\n${config.instrucciones}` : sistema,
    turnos,
    {
      modelo: config.modelo ?? undefined,
      maximoTokens: config.maximoTokens ?? undefined,
    },
  );

  if (respuesta.estado === "ok") {
    // Un fallo al medir no puede tirar una respuesta que ya se pagó.
    await registrarUso(usuario, config.clave, conversacionId, respuesta.uso).catch(
      (error) => console.error("[ia] no se pudo registrar el uso", error),
    );
  }

  return respuesta;
}

export type Consumo = {
  /** Tokens (entrada + salida) gastados este mes. */
  usados: number;
  /** Tope mensual vigente, o `null` si no hay cuota definida. */
  tope: number | null;
  /** Porcentaje del tope, o `null` sin tope. */
  porcentaje: number | null;
  /** Pasó el umbral de aviso (80 % por defecto). */
  aviso: boolean;
  agotada: boolean;
};

/**
 * Consumo del mes y su tope. La cuota del usuario manda sobre la de su rol. Sin
 * ninguna cuota definida no hay tope: no se inventa un número.
 */
export async function miConsumo(usuario: UsuarioIA): Promise<Consumo> {
  const [cuota, gastado] = await Promise.all([
    consultarUna<{ tokens_mes: string; aviso_pct: number }>(
      `SELECT tokens_mes, aviso_pct FROM ai_cuota
        WHERE (usuario_id = $1 OR rol = $2)
          AND (anulada_hasta IS NULL OR anulada_hasta < now())
        ORDER BY (usuario_id IS NOT NULL) DESC
        LIMIT 1`,
      [usuario.id, usuario.rol],
    ).catch(() => null),
    consultarUna<{ total: string }>(
      `SELECT COALESCE(SUM(tokens_entrada + tokens_salida), 0) AS total
         FROM ai_uso
        WHERE usuario_id = $1 AND created_at >= date_trunc('month', now())`,
      [usuario.id],
    ).catch(() => null),
  ]);

  const usados = Number(gastado?.total ?? 0);

  if (!cuota) {
    return { usados, tope: null, porcentaje: null, aviso: false, agotada: false };
  }

  const tope = Number(cuota.tokens_mes);
  const porcentaje = Math.round((usados / tope) * 100);

  return {
    usados,
    tope,
    porcentaje,
    aviso: porcentaje >= cuota.aviso_pct,
    agotada: usados >= tope,
  };
}

/**
 * Anota una llamada. El costo se calcula al guardar con el precio de ese
 * momento: si el precio cambia después, el histórico no se reescribe.
 */
export async function registrarUso(
  usuario: UsuarioIA,
  agente: string,
  conversacionId: string | null,
  uso: UsoIA,
) {
  await consultar(
    `INSERT INTO ai_uso
       (usuario_id, rol, agente_clave, conversacion_id, modelo,
        tokens_entrada, tokens_salida, tokens_cache, latencia_ms, costo_usd)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9,
            (SELECT ($6 * usd_entrada_mtok + $7 * usd_salida_mtok + $8 * usd_cache_lectura_mtok) / 1000000.0
               FROM ai_precio_modelo WHERE modelo = $5)`,
    [
      usuario.id,
      usuario.rol,
      agente,
      conversacionId,
      uso.modelo,
      uso.entrada,
      uso.salida,
      uso.cache,
      uso.latenciaMs,
    ],
  );
}
