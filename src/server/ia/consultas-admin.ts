import { consultar, consultarUna } from "@/lib/db";
import { DIAS_SIN_VERIFICAR } from "@/lib/ia-conocimiento";

/**
 * Lecturas del tablero de Nexus AI. Solo metadatos de uso y de acciones: el
 * CONTENIDO de las conversaciones no sale de aquí. Dirección ve cuánto y cómo se
 * usa, no qué le preguntó cada persona al asistente.
 */

export type ResumenMes = {
  llamadas: number;
  tokens: number;
  costo: number | null;
  personas: number;
};

export async function resumenDelMes(): Promise<ResumenMes> {
  const fila = await consultarUna<{
    llamadas: string;
    tokens: string;
    costo: string | null;
    personas: string;
  }>(
    `SELECT count(*) AS llamadas,
            COALESCE(SUM(tokens_entrada + tokens_salida), 0) AS tokens,
            SUM(costo_usd) AS costo,
            count(DISTINCT usuario_id) AS personas
       FROM ai_uso WHERE created_at >= date_trunc('month', now())`,
  );

  return {
    llamadas: Number(fila?.llamadas ?? 0),
    tokens: Number(fila?.tokens ?? 0),
    costo: fila?.costo === null || fila?.costo === undefined ? null : Number(fila.costo),
    personas: Number(fila?.personas ?? 0),
  };
}

export type FilaConsumo = { clave: string; llamadas: number; tokens: number; costo: number | null };

async function agrupado(columna: "agente_clave" | "modelo" | "rol"): Promise<FilaConsumo[]> {
  // `columna` sale de una lista cerrada de arriba, nunca de la petición.
  const filas = await consultar<{ clave: string; llamadas: string; tokens: string; costo: string | null }>(
    `SELECT COALESCE(${columna}, '—') AS clave, count(*) AS llamadas,
            SUM(tokens_entrada + tokens_salida) AS tokens, SUM(costo_usd) AS costo
       FROM ai_uso WHERE created_at >= date_trunc('month', now())
      GROUP BY 1 ORDER BY tokens DESC`,
  );

  return filas.map((f) => ({
    clave: f.clave,
    llamadas: Number(f.llamadas),
    tokens: Number(f.tokens),
    costo: f.costo === null ? null : Number(f.costo),
  }));
}

export const consumoPorAgente = () => agrupado("agente_clave");
export const consumoPorModelo = () => agrupado("modelo");
export const consumoPorRol = () => agrupado("rol");

export async function consumoPorDia(dias = 14) {
  const filas = await consultar<{ dia: string; tokens: string }>(
    `SELECT d::date::text AS dia,
            COALESCE(SUM(u.tokens_entrada + u.tokens_salida), 0) AS tokens
       FROM generate_series(current_date - ($1::int - 1), current_date, '1 day') d
       LEFT JOIN ai_uso u ON u.created_at::date = d::date
      GROUP BY 1 ORDER BY 1`,
    [dias],
  );

  return filas.map((f) => ({ dia: f.dia, tokens: Number(f.tokens) }));
}

export async function mayoresConsumidores(limite = 8) {
  const filas = await consultar<{ nombre: string; rol: string; tokens: string; costo: string | null }>(
    `SELECT COALESCE(us.nombre, '—') AS nombre, u.rol,
            SUM(u.tokens_entrada + u.tokens_salida) AS tokens, SUM(u.costo_usd) AS costo
       FROM ai_uso u LEFT JOIN usuario us ON us.id = u.usuario_id
      WHERE u.created_at >= date_trunc('month', now())
      GROUP BY us.nombre, u.rol ORDER BY tokens DESC LIMIT $1`,
    [limite],
  );

  return filas.map((f) => ({
    nombre: f.nombre,
    rol: f.rol,
    tokens: Number(f.tokens),
    costo: f.costo === null ? null : Number(f.costo),
  }));
}

export type CuotaFila = {
  id: string;
  alcance: "rol" | "usuario";
  quien: string;
  tokensMes: number;
  avisoPct: number;
  anuladaHasta: string | null;
};

export async function cuotas(): Promise<CuotaFila[]> {
  const filas = await consultar<{
    id: string;
    rol: string | null;
    nombre: string | null;
    tokens_mes: string;
    aviso_pct: number;
    anulada_hasta: string | null;
  }>(
    `SELECT c.id, c.rol, u.nombre, c.tokens_mes, c.aviso_pct, c.anulada_hasta::text
       FROM ai_cuota c LEFT JOIN usuario u ON u.id = c.usuario_id
      ORDER BY c.rol NULLS LAST, u.nombre`,
  );

  return filas.map((f) => ({
    id: f.id,
    alcance: f.rol ? "rol" : "usuario",
    quien: f.rol ?? f.nombre ?? "—",
    tokensMes: Number(f.tokens_mes),
    avisoPct: f.aviso_pct,
    anuladaHasta: f.anulada_hasta,
  }));
}

export type PrecioFila = {
  modelo: string;
  entrada: number;
  salida: number;
  cache: number;
  vigenteDesde: string;
};

export async function precios(): Promise<PrecioFila[]> {
  const filas = await consultar<{
    modelo: string;
    usd_entrada_mtok: string;
    usd_salida_mtok: string;
    usd_cache_lectura_mtok: string;
    vigente_desde: string;
  }>(`SELECT modelo, usd_entrada_mtok, usd_salida_mtok, usd_cache_lectura_mtok, vigente_desde::text
        FROM ai_precio_modelo ORDER BY modelo`);

  return filas.map((f) => ({
    modelo: f.modelo,
    entrada: Number(f.usd_entrada_mtok),
    salida: Number(f.usd_salida_mtok),
    cache: Number(f.usd_cache_lectura_mtok),
    vigenteDesde: f.vigente_desde,
  }));
}

export type AgenteFila = {
  clave: string;
  roles: string[];
  instrucciones: string | null;
  modelo: string | null;
  maxTokens: number | null;
  limiteHora: number;
  activo: boolean;
};

export async function agentes(): Promise<AgenteFila[]> {
  const filas = await consultar<{
    clave: string;
    roles: string[];
    instrucciones: string | null;
    modelo: string | null;
    max_tokens: number | null;
    limite_hora: number;
    activo: boolean;
  }>(`SELECT clave, roles, instrucciones, modelo, max_tokens, limite_hora, activo
        FROM ai_agente ORDER BY clave`);

  return filas.map((f) => ({
    clave: f.clave,
    roles: f.roles,
    instrucciones: f.instrucciones,
    modelo: f.modelo,
    maxTokens: f.max_tokens,
    limiteHora: f.limite_hora,
    activo: f.activo,
  }));
}

export type AccionReciente = {
  id: string;
  cuando: string;
  persona: string;
  agente: string;
  herramienta: string;
  estado: string;
  reversible: boolean;
  deshecha: boolean;
};

export async function accionesRecientes(limite = 15): Promise<AccionReciente[]> {
  const filas = await consultar<{
    id: string;
    created_at: string;
    nombre: string | null;
    agente_clave: string | null;
    herramienta: string;
    estado: string;
    reversible: boolean;
    deshecha_el: string | null;
  }>(
    `SELECT a.id, a.created_at::text, u.nombre, a.agente_clave, a.herramienta,
            a.estado, a.reversible, a.deshecha_el::text
       FROM ai_accion a LEFT JOIN usuario u ON u.id = a.usuario_id
      ORDER BY a.created_at DESC LIMIT $1`,
    [limite],
  );

  return filas.map((f) => ({
    id: f.id,
    cuando: f.created_at,
    persona: f.nombre ?? "—",
    agente: f.agente_clave ?? "—",
    herramienta: f.herramienta,
    estado: f.estado,
    reversible: f.reversible,
    deshecha: Boolean(f.deshecha_el),
  }));
}

export type DocumentoConocimiento = {
  documentoId: string;
  titulo: string;
  fuente: string | null;
  version: string | null;
  agentes: string[];
  fragmentos: number;
  verificadoEl: string | null;
  sinVerificar: boolean;
  activo: boolean;
};

/** Un documento = los fragmentos que comparten `fuente_id`. */
export async function documentosDeConocimiento(
  agentesVisibles: readonly string[] | null,
): Promise<DocumentoConocimiento[]> {
  const filas = await consultar<{
    documento_id: string;
    titulo: string | null;
    fuente: string | null;
    version: string | null;
    agentes: string[];
    fragmentos: string;
    verificado_el: string | null;
    sin_verificar: boolean;
    activo: boolean;
  }>(
    `SELECT fuente_id AS documento_id, max(titulo) AS titulo, max(fuente) AS fuente,
            max(version) AS version, (array_agg(agentes))[1] AS agentes,
            count(*) AS fragmentos, max(verificado_el)::text AS verificado_el,
            (max(verificado_el) IS NULL
               OR max(verificado_el) < current_date - $2::int) AS sin_verificar,
            bool_and(activo) AS activo
       FROM fragmento_conocimiento
      WHERE fuente_id IS NOT NULL
        AND ($1::text[] IS NULL OR agentes && $1::text[])
      GROUP BY fuente_id ORDER BY max(created_at) DESC`,
    [agentesVisibles ? [...agentesVisibles] : null, DIAS_SIN_VERIFICAR],
  );

  return filas.map((f) => ({
    documentoId: f.documento_id,
    titulo: f.titulo ?? "—",
    fuente: f.fuente,
    version: f.version,
    agentes: f.agentes,
    fragmentos: Number(f.fragmentos),
    verificadoEl: f.verificado_el,
    sinVerificar: f.sin_verificar,
    activo: f.activo,
  }));
}
