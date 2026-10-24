import {
  BarChart3,
  Boxes,
  FileSpreadsheet,
  HandCoins,
  Inbox,
  Landmark,
  ReceiptText,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";

import type { Permiso } from "@/lib/rbac";

/**
 * Los módulos del Departamento de Contabilidad, en un solo sitio.
 *
 * De esta lista salen tres cosas que antes se escribían por separado y se
 * desalineaban: el menú lateral del rol `contabilidad` (agrupado), el área de
 * Finanzas del menú de administración y el lanzador de la pantalla de inicio.
 * Añadir un módulo nuevo —nómina, presupuestos, contabilidad general— es añadir
 * su entrada aquí y su ruta; el menú, el inicio y el buscador lo recogen solos.
 *
 * Algunas herramientas viven fuera de `/contabilidad` porque las usan también
 * otros roles (las rendiciones las envía cualquier colaborador; el inventario de
 * activos lo audita administración). No se mueven: se listan aquí para que el
 * contable las encuentre en su departamento sin saber dónde están.
 *
 * `etiqueta` es una clave del espacio `nav`; `descripcion`, una de
 * `contab.modulos`.
 */

export const GRUPOS_CONTABLES = [
  "tesoreria",
  "ingresos",
  "gastos",
  "impuestos",
  "activos",
  "departamento",
] as const;

export type GrupoContable = (typeof GRUPOS_CONTABLES)[number];

export type ModuloContable = {
  /** Identificador estable: clave de React y de traducción. */
  clave: string;
  grupo: GrupoContable;
  /** Clave dentro del espacio `nav`. */
  etiqueta: string;
  href: string;
  icono: React.ComponentType<{ className?: string }>;
  /** Sin permiso, el módulo no aparece ni en el menú ni en el inicio. */
  permiso?: Permiso;
  /**
   * Si va también en el área de Finanzas del menú de administración.
   *
   * Las herramientas compartidas (rendiciones, inventario, solicitudes) ya
   * tienen su entrada propia en ese menú: repetirlas daría dos enlaces iguales.
   */
  enAdministracion: boolean;
};

export const MODULOS_CONTABLES: readonly ModuloContable[] = [
  // ── Tesorería: dónde está el dinero ─────────────────────────────────
  {
    clave: "bancos",
    grupo: "tesoreria",
    etiqueta: "banks",
    href: "/contabilidad/bancos",
    icono: Landmark,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "cajas",
    grupo: "tesoreria",
    etiqueta: "boxes",
    href: "/contabilidad/cajas",
    icono: Wallet,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  // ── Ingresos ────────────────────────────────────────────────────────
  {
    clave: "recibos",
    grupo: "ingresos",
    etiqueta: "receipts",
    href: "/contabilidad/recibos",
    icono: ReceiptText,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  // ── Gastos ──────────────────────────────────────────────────────────
  {
    clave: "proveedores",
    grupo: "gastos",
    etiqueta: "suppliers",
    href: "/contabilidad/proveedores",
    icono: Users,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "cxp",
    grupo: "gastos",
    etiqueta: "payables",
    href: "/contabilidad/cuentas-por-pagar",
    icono: HandCoins,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "rendiciones",
    grupo: "gastos",
    etiqueta: "expenseReports",
    href: "/administrativo/rendiciones",
    icono: ScrollText,
    permiso: "rendicion.revisar",
    enAdministracion: false,
  },
  // ── Impuestos ───────────────────────────────────────────────────────
  {
    clave: "impuestos",
    grupo: "impuestos",
    etiqueta: "taxes",
    href: "/contabilidad/impuestos",
    icono: FileSpreadsheet,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  // ── Activos ─────────────────────────────────────────────────────────
  {
    clave: "inventario",
    grupo: "activos",
    etiqueta: "inventory",
    href: "/administrativo/inventario",
    icono: Boxes,
    permiso: "inventario.leer",
    enAdministracion: false,
  },
  // ── Trabajo del departamento ────────────────────────────────────────
  {
    clave: "solicitudes",
    grupo: "departamento",
    etiqueta: "requests",
    href: "/administrativo/solicitudes",
    icono: Inbox,
    enAdministracion: false,
  },
  {
    clave: "reportes",
    grupo: "departamento",
    etiqueta: "reports",
    href: "/reportes",
    icono: BarChart3,
    enAdministracion: false,
  },
];

/** Los módulos de un grupo, en el orden declarado. */
export function modulosDeGrupo(grupo: GrupoContable): ModuloContable[] {
  return MODULOS_CONTABLES.filter((modulo) => modulo.grupo === grupo);
}
