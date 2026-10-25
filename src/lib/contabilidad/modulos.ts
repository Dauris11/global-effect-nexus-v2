import {
  BarChart3,
  BookOpen,
  Boxes,
  Calculator,
  Coins,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  HandCoins,
  HandHeart,
  Inbox,
  Landmark,
  Layers,
  NotebookPen,
  PieChart,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingBag,
  Sun,
  UserCheck,
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
  "general",
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
  // ── Mi día: la cola de decisiones de hoy, antes que los libros ──────
  {
    clave: "mi-dia",
    grupo: "general",
    etiqueta: "accountingMyDay",
    href: "/contabilidad/mi-dia",
    icono: Sun,
    permiso: "contabilidad.leer",
    enAdministracion: false,
  },
  // ── Contabilidad general: los libros que salen de todo lo demás ─────
  {
    clave: "asientos",
    grupo: "general",
    etiqueta: "journalEntries",
    href: "/contabilidad/asientos",
    icono: NotebookPen,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "libros",
    grupo: "general",
    etiqueta: "ledgers",
    href: "/contabilidad/libros",
    icono: BookOpen,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "centros-costo",
    grupo: "general",
    etiqueta: "costCenters",
    href: "/contabilidad/centros-costo",
    icono: Layers,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "presupuesto",
    grupo: "general",
    etiqueta: "budget",
    href: "/contabilidad/presupuesto",
    icono: PieChart,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "reportes-financieros",
    grupo: "general",
    etiqueta: "financialStatements",
    href: "/contabilidad/reportes",
    icono: BarChart3,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "cierre-contable",
    grupo: "general",
    etiqueta: "accountingClosing",
    href: "/contabilidad/cierre",
    icono: FileCheck2,
    permiso: "contabilidad.cerrar_periodo",
    enAdministracion: true,
  },
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
    clave: "donaciones",
    grupo: "ingresos",
    etiqueta: "donations",
    href: "/contabilidad/donaciones",
    icono: HandHeart,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "fondos",
    grupo: "ingresos",
    etiqueta: "funds",
    href: "/contabilidad/fondos",
    icono: Coins,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "recibos",
    grupo: "ingresos",
    etiqueta: "receipts",
    href: "/contabilidad/recibos",
    icono: ReceiptText,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "rendicion",
    grupo: "ingresos",
    etiqueta: "accountabilityReport",
    href: "/contabilidad/rendicion",
    icono: FileText,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  // ── Gastos ──────────────────────────────────────────────────────────
  {
    clave: "ordenes-compra",
    grupo: "gastos",
    etiqueta: "purchaseOrders",
    href: "/contabilidad/ordenes-compra",
    icono: ShoppingBag,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
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
    clave: "retenciones",
    grupo: "gastos",
    etiqueta: "withholdingCertificates",
    href: "/contabilidad/retenciones",
    icono: FileCheck2,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "comprobantes-recibidos",
    grupo: "gastos",
    etiqueta: "receivedReceipts",
    href: "/contabilidad/comprobantes-recibidos",
    icono: Inbox,
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
  {
    clave: "nomina",
    grupo: "gastos",
    etiqueta: "payroll",
    href: "/contabilidad/nomina",
    icono: Users,
    permiso: "contabilidad.nomina",
    enAdministracion: true,
  },
  // ── Terceros ────────────────────────────────────────────────────────
  {
    clave: "terceros",
    grupo: "departamento",
    etiqueta: "thirdParties",
    href: "/contabilidad/terceros",
    icono: UserCheck,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  // ── Impuestos y Cumplimiento DGII ────────────────────────────────────
  {
    clave: "impuestos",
    grupo: "impuestos",
    etiqueta: "taxes",
    href: "/contabilidad/impuestos",
    icono: FileSpreadsheet,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  // ── Calculadoras Fiscales y Financieras ─────────────────────────────
  {
    clave: "calculadoras",
    grupo: "departamento",
    etiqueta: "calculators",
    href: "/contabilidad/calculadoras",
    icono: Calculator,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  // ── Activos y Kardex ────────────────────────────────────────────────
  {
    clave: "activos-fijos",
    grupo: "activos",
    etiqueta: "fixedAssets",
    href: "/contabilidad/activos-fijos",
    icono: Landmark,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
  {
    clave: "consumibles",
    grupo: "activos",
    etiqueta: "consumablesInventory",
    href: "/contabilidad/inventario",
    icono: ShoppingBag,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
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
  {
    clave: "configuracion",
    grupo: "departamento",
    etiqueta: "accountingSettings",
    href: "/contabilidad/configuracion",
    icono: Settings,
    permiso: "contabilidad.leer",
    enAdministracion: true,
  },
];

/** Los módulos de un grupo, en el orden declarado. */
export function modulosDeGrupo(grupo: GrupoContable): ModuloContable[] {
  return MODULOS_CONTABLES.filter((modulo) => modulo.grupo === grupo);
}
