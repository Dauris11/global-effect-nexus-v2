import type Anthropic from "@anthropic-ai/sdk";

import type { Permiso, Rol } from "@/lib/rbac";

/**
 * Qué es una herramienta del agente.
 *
 *   · `automatica`: lectura o algo sin efecto. Se ejecuta sin preguntar.
 *   · `confirmacion`: escribe algo que otros ven. Se PROPONE y solo se ejecuta
 *     cuando la persona pulsa Aprobar; el modelo no puede aprobarse a sí mismo
 *     porque la aprobación es otra petición (`aprobarAccionIA`), no una salida
 *     del modelo.
 *
 * El nivel "aprobación jerárquica" (desembolsos mayores, activos de capital) no
 * tiene herramientas: lo que ya exige aprobación en el sistema no se expone al
 * agente. Ver `PROHIBIDAS`.
 */
export type Nivel = "automatica" | "confirmacion";

export type UsuarioHerramienta = { id: string; rol: Rol; nombre: string };

export type ResultadoHerramienta = {
  ok: boolean;
  /** Texto que ve el modelo (y, resumido, la persona). */
  texto: string;
  entidad?: { tipo: string; id: string };
  /** Datos para poder deshacer (valor anterior, id creado...). */
  deshacer?: Record<string, unknown>;
};

export type Herramienta = {
  nombre: string;
  descripcion: string;
  esquema: Anthropic.Tool["input_schema"];
  nivel: Nivel;
  /** Roles que la VEN. El modelo de otro rol no sabe que existe. */
  roles: readonly Rol[];
  /** Permiso RBAC adicional, comprobado al proponer y otra vez al ejecutar. */
  permiso?: Permiso;
  /** Frase para la tarjeta de aprobación, en el idioma de la persona. */
  resumir: (argumentos: Record<string, unknown>, idioma: "es" | "en") => string;
  ejecutar: (
    usuario: UsuarioHerramienta,
    argumentos: Record<string, unknown>,
    contexto: { agente: string },
  ) => Promise<ResultadoHerramienta>;
  /** Solo las que escriben algo reversible. */
  deshacer?: (
    usuario: UsuarioHerramienta,
    accion: { entidad_tipo: string | null; entidad_id: string | null; deshacer: Record<string, unknown> | null },
  ) => Promise<boolean>;
};

/**
 * Lo que el agente NO puede hacer, con o sin aprobación (prompt de IA, §4).
 *
 * No hay herramienta con ninguno de estos nombres y la prueba
 * `scripts/probar-nexus-ai.ts` falla si alguien la añade. Contabilizar en un
 * periodo cerrado, borrar evidencia, presentar a la DGII, tocar permisos y
 * apagar la bitácora no pueden ser algo que un modelo decida.
 */
export const PROHIBIDAS = [
  "contabilizar_periodo_cerrado",
  "borrar_evidencia",
  "enviar_declaracion_dgii",
  "cambiar_permisos",
  "desactivar_bitacora",
  "aprobar_desembolso",
] as const;
