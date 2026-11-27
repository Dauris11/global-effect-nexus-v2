import { unstable_cache } from "next/cache";

import { consultar } from "@/lib/db";
import type { UsuarioSesion } from "@/lib/auth";
import { diaEnRD } from "@/lib/fechas";
import { MARCADOR_CONFIGURADO, UNIVERSALES, responsabilidadesPorDefecto } from "@/lib/prioridades/defaults";
import { agrupar, calcular } from "@/lib/prioridades/score";
import { TIPOS_PRIORIDAD, type ListaPrioridades, type PrioridadItem, type TipoPrioridad } from "@/lib/prioridades/types";
import { filtrarVisibles } from "@/lib/prioridades/visibilidad";

import { proveedorContabilidad } from "./providers/contabilidad";
import { proveedorDocencia } from "./providers/docencia";
import { proveedorEstudiante } from "./providers/estudiante";
import { proveedorExpedientes } from "./providers/expedientes";
import { proveedorHabitudes } from "./providers/habitudes";
import { proveedorProyectos } from "./providers/proyectos";
import { proveedorSolicitudes } from "./providers/solicitudes";
import { proveedorTareas } from "./providers/tareas";
import { diaComoFecha, type ContextoServidor, type ItemCrudo, type Proveedor } from "./tipos";

/**
 * Motor de prioridades: junta los pendientes de todos los módulos y decide qué le toca a cada
 * persona. Los proveedores corren en paralelo; el resultado crudo se guarda 60 s por persona
 * (y rol: «Ver como» cambia lo que ve) y se invalida al actuar sobre un ítem (`updateTag`).
 * La visibilidad, la severidad y el score se calculan DESPUÉS de la caché, con funciones puras.
 */
const PROVEEDORES: readonly Proveedor[] = [
  proveedorSolicitudes,
  proveedorTareas,
  proveedorProyectos,
  proveedorExpedientes,
  proveedorDocencia,
  proveedorEstudiante,
  proveedorHabitudes,
  proveedorContabilidad,
];

export const etiquetaDePrioridades = (userId: string) => `prioridades:${userId}`;

const esTipo = (t: string): t is TipoPrioridad => (TIPOS_PRIORIDAD as readonly string[]).includes(t);

/** Lo que esta persona atiende: lo personalizado en «Qué atiende» o, sin personalizar, lo de su rol. */
export async function responsabilidadesDe(userId: string, rol: UsuarioSesion["rol"]): Promise<ReadonlySet<TipoPrioridad>> {
  const filas = await consultar<{ tipo_prioridad: string }>(
    `SELECT tipo_prioridad FROM responsabilidades_personal WHERE user_id = $1`,
    [userId],
  );

  if (!filas.some((f) => f.tipo_prioridad === MARCADOR_CONFIGURADO)) return responsabilidadesPorDefecto(rol);

  return new Set(filas.map((f) => f.tipo_prioridad).filter(esTipo));
}

type Crudo = Omit<ItemCrudo, "venceEn" | "creadoEn"> & { venceEn?: string; creadoEn?: string };

const crudosCacheados = (ctx: ContextoServidor, proveedores: readonly Proveedor[]) =>
  unstable_cache(
    async (): Promise<Crudo[]> => {
      const listas = await Promise.all(proveedores.map((p) => p.getItems(ctx).catch((e) => {
        // Un módulo caído no tumba el inicio: se pierde SU parte y se deja rastro.
        console.error(`[prioridades] falló el proveedor ${p.nombre}`, e);
        return [] as ItemCrudo[];
      })));

      return listas.flat().map((i) => ({ ...i, venceEn: i.venceEn?.toISOString(), creadoEn: i.creadoEn?.toISOString() }));
    },
    ["prioridades", ctx.userId, ctx.rol],
    { revalidate: 60, tags: [etiquetaDePrioridades(ctx.userId)] },
  )();

export async function itemsDePrioridad(
  usuario: UsuarioSesion,
  opciones: { sinCache?: boolean } = {},
): Promise<PrioridadItem[]> {
  const hoy = diaEnRD();
  const responsabilidades = await responsabilidadesDe(usuario.id, usuario.rol);
  const ctx: ContextoServidor = { userId: usuario.id, rol: usuario.rol, responsabilidades, hoy, usuario };

  // Solo se consulta lo que esta persona podría ver; dirección además mira las tareas de todos (escalados).
  const queridos = new Set<TipoPrioridad>([...responsabilidades, ...UNIVERSALES]);
  const proveedores = PROVEEDORES.filter((p) => p.tipos.some((t) => queridos.has(t)));

  const crudos = opciones.sinCache
    ? (await Promise.all(proveedores.map((p) => p.getItems(ctx)))).flat()
    : (await crudosCacheados(ctx, proveedores)).map((c) => ({
        ...c,
        venceEn: c.venceEn ? new Date(c.venceEn) : undefined,
        creadoEn: c.creadoEn ? new Date(c.creadoEn) : undefined,
      }));

  const completos = crudos.map((c) => calcular(c, hoy, diaEnRD));
  const visibles = filtrarVisibles(completos, ctx, diaEnRD);

  const pospuestos = await consultar<{ item_id: string }>(
    `SELECT item_id FROM prioridad_pospuesta WHERE user_id = $1 AND hasta > $2::date`,
    [usuario.id, hoy],
  );
  const fuera = new Set(pospuestos.map((p) => p.item_id));

  return visibles.filter((i) => !fuera.has(i.id));
}

export async function prioridadesDe(usuario: UsuarioSesion, opciones: { sinCache?: boolean } = {}): Promise<ListaPrioridades> {
  const items = await itemsDePrioridad(usuario, opciones);

  return agrupar(items, diaEnRD(), diaEnRD);
}

export { diaComoFecha };
