import {
  Banknote,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Calculator,
  CalendarDays,
  CalendarRange,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  History,
  Home,
  KeyRound,
  Landmark,
  Layers,
  Library,
  Lock,
  Mail,
  Map,
  Megaphone,
  Package,
  PieChart,
  Receipt,
  School,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  Timer,
  Truck,
  UserCog,
  UserX,
  Users,
  Utensils,
  Video,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { Permiso, Rol } from "@/lib/rbac";

/**
 * Sidebar por rol de ≤ 9 enlaces (docs/ux-rules.md §13): cada enlace es un MÓDULO y lo que antes eran
 * entradas sueltas pasa a ser sus PESTAÑAS, dentro de la pantalla. Las pestañas son las rutas de siempre
 * (subrutas, no `?tab=`), así que ningún enlace guardado se rompe; el módulo no tiene ruta propia: su enlace
 * lleva a la primera pestaña que la persona puede abrir.
 *
 * Este archivo es solo configuración y lógica pura (lo comparten el servidor y el cliente). El permiso de
 * cada pestaña NO se repite aquí: se toma de la entrada del menú completo de `nav.ts` con el mismo `href`
 * (la que protege la pantalla), para que menú y pantalla nunca se contradigan.
 */

export type PestanaNav = {
  /** Clave dentro de `nav.tab`. */
  etiqueta: string;
  href: string;
  /** Rutas hijas que también cuentan como esta pestaña (detalles). */
  activoEn?: readonly string[];
  /** Solo cuenta la ruta idéntica, no las hijas: la raíz de un módulo (`/contabilidad`) no debe adueñarse de pantallas sueltas que cuelgan de ella. */
  soloExacta?: boolean;
};

export type ModuloNav = {
  id: string;
  /** Clave dentro de `nav.m`: es el texto del enlace del sidebar. */
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  pestanas: readonly PestanaNav[];
  /** Distintivo numérico: vencidos de Inicio o solicitudes que me tocan. */
  insignia?: "vencidos" | "solicitudes";
  /** Va abajo, separado y en gris (Calendario, Reportes, Configuración). */
  pie?: boolean;
};

const p = (etiqueta: string, href: string, activoEn?: readonly string[], soloExacta?: boolean): PestanaNav => ({ etiqueta, href, activoEn, soloExacta });

export const MODULOS: Record<string, ModuloNav> = {
  inicio: { id: "inicio", etiqueta: "home", icono: Home, pestanas: [p("home", "/inicio")], insignia: "vencidos" },
  estudiantes: {
    id: "estudiantes",
    etiqueta: "students",
    icono: Users,
    pestanas: [p("files", "/expedientes"), p("atRisk", "/expedientes/riesgo"), p("scholarships", "/patrocinadores/becas")],
  },
  academico: {
    id: "academico",
    etiqueta: "academic",
    icono: GraduationCap,
    pestanas: [
      p("universities", "/academico/universidades"),
      p("grades", "/academico/universidades/calificaciones"),
      p("terms", "/academico/periodos"),
      p("prematricula", "/academico/prematricula"),
      p("subjects", "/academico/materias"),
      p("g360", "/academico/clases-360"),
    ],
  },
  patrocinadores: {
    id: "patrocinadores",
    etiqueta: "sponsors",
    icono: HandCoins,
    pestanas: [p("list", "/patrocinadores"), p("letters", "/patrocinadores/correos")],
  },
  solicitudes: { id: "solicitudes", etiqueta: "requests", icono: ClipboardList, pestanas: [p("requests", "/administrativo/solicitudes")], insignia: "solicitudes" },
  proyectos: {
    id: "proyectos",
    etiqueta: "projects",
    icono: FolderKanban,
    pestanas: [p("board", "/administrativo/proyectos"), p("timeline", "/calendario/gantt"), p("myTasks", "/administrativo/tareas")],
  },
  operaciones: {
    id: "operaciones",
    etiqueta: "operations",
    icono: Briefcase,
    pestanas: [
      p("inventory", "/administrativo/inventario"),
      p("monthlyServices", "/servicios-mensuales"),
      p("meals", "/inscripcion-comida"),
      p("transport", "/administrativo/transporte"),
    ],
  },
  habitudes: {
    id: "habitudes",
    etiqueta: "habitudes",
    icono: BookOpen,
    pestanas: [p("programs", "/academias/programas"), p("materials", "/academias/materiales"), p("hub", "/habitudes/recursos")],
  },
  // Solo dirección: todas las pantallas de contabilidad como pestañas (los demás roles de contabilidad usan sus módulos).
  contabilidad: {
    id: "contabilidad",
    etiqueta: "accounting",
    icono: Landmark,
    pestanas: [
      // El módulo abre en su inicio (prioridades + 3 cifras), no en «Recibos».
      p("home", "/contabilidad", undefined, true),
      p("receipts", "/contabilidad/recibos"),
      p("journal", "/contabilidad/asientos"),
      p("banks", "/contabilidad/bancos"),
      p("cashboxes", "/contabilidad/cajas"),
      p("suppliers", "/contabilidad/proveedores"),
      p("payables", "/contabilidad/cuentas-por-pagar"),
      p("requests", "/contabilidad/cuentas-por-pagar/solicitudes"),
      p("pasaje", "/contabilidad/pasaje"),
      p("budget", "/contabilidad/presupuesto"),
      p("financialStatements", "/contabilidad/reportes"),
      p("ledgers", "/contabilidad/libros"),
      p("closing", "/contabilidad/cierre"),
    ],
  },
  calendario: { id: "calendario", etiqueta: "calendar", icono: CalendarDays, pie: true, pestanas: [p("calendar", "/calendario"), p("meetings", "/reuniones")] },
  // El mismo módulo, en la lista principal (docente y Habitudes lo usan a diario; abajo y en gris es para el personal).
  calendarioPrincipal: { id: "calendarioPrincipal", etiqueta: "calendar", icono: CalendarDays, pestanas: [p("calendar", "/calendario"), p("meetings", "/reuniones")] },
  reportes: { id: "reportes", etiqueta: "reports", icono: BarChart3, pie: true, pestanas: [p("reports", "/reportes"), p("studentCost", "/contabilidad/reportes/costo-estudiantes")] },
  configuracion: {
    id: "configuracion",
    etiqueta: "settings",
    icono: Settings,
    pie: true,
    pestanas: [
      p("general", "/configuracion"),
      p("staff", "/administrativo/personal"),
      p("permissions", "/configuracion/permisos"),
      p("announcements", "/configuracion/landing"),
      p("accountingSettings", "/contabilidad/configuracion"),
      // Solo para `tecnico.dev_panel`: la pestaña se filtra por el permiso que declara `nav.ts` (regla 17).
      p("devTools", "/dev"),
    ],
  },

  // ── contabilidad (rol) ─────────────────────────────────────────
  registrar: { id: "registrar", etiqueta: "register", icono: Receipt, pestanas: [p("receipts", "/contabilidad/recibos"), p("journal", "/contabilidad/asientos")] },
  bancosCajas: { id: "bancosCajas", etiqueta: "banksCash", icono: Wallet, pestanas: [p("banks", "/contabilidad/bancos"), p("cashboxes", "/contabilidad/cajas")] },
  porPagar: {
    id: "porPagar",
    etiqueta: "payables",
    icono: HandCoins,
    pestanas: [p("suppliers", "/contabilidad/proveedores"), p("payables", "/contabilidad/cuentas-por-pagar"), p("requests", "/contabilidad/cuentas-por-pagar/solicitudes")],
  },
  pasaje: {
    id: "pasaje",
    etiqueta: "pasaje",
    icono: Bus,
    pestanas: [p("pasaje", "/contabilidad/pasaje")],
  },
  presupuesto: { id: "presupuesto", etiqueta: "budget", icono: Calculator, pestanas: [p("budget", "/contabilidad/presupuesto")] },
  reportesConta: {
    id: "reportesConta",
    etiqueta: "reports",
    icono: BarChart3,
    pestanas: [p("financialStatements", "/contabilidad/reportes"), p("studentCost", "/contabilidad/reportes/costo-estudiantes"), p("ledgers", "/contabilidad/libros")],
  },
  cierre: { id: "cierre", etiqueta: "closing", icono: Lock, pestanas: [p("closing", "/contabilidad/cierre")] },
  configConta: { id: "configConta", etiqueta: "accountingSettings", icono: Settings, pestanas: [p("accountingSettings", "/contabilidad/configuracion")] },

  // ── docente ────────────────────────────────────────────────────
  misClasesDocente: { id: "misClasesDocente", etiqueta: "myClasses", icono: BookOpen, pestanas: [p("myClasses", "/portal/profesor/clases")] },
  porCalificar: { id: "porCalificar", etiqueta: "toGrade", icono: ClipboardCheck, pestanas: [p("toGrade", "/portal/profesor/entregas")] },

  // ── estudiante ─────────────────────────────────────────────────
  misClases: {
    id: "misClases",
    etiqueta: "myClasses",
    icono: BookOpen,
    pestanas: [p("classes", "/portal/estudiante/clases"), p("tasks", "/portal/estudiante/tareas"), p("prematricula", "/portal/estudiante/prematricula")],
  },
  calificaciones: { id: "calificaciones", etiqueta: "grades", icono: Star, pestanas: [p("grades", "/portal/estudiante/calificaciones")] },
  miBeca: {
    id: "miBeca",
    etiqueta: "myScholarship",
    icono: HeartHandshake,
    // «Comida» no es pestaña: `/comida` es la puerta pública, fuera del armazón del portal (sin menú), y un enlace ahí dejaría al estudiante sin navegación.
    pestanas: [p("scholarshipTab", "/portal/estudiante/beca"), p("transport", "/portal/estudiante/transporte")],
  },
  solicitudesEst: { id: "solicitudesEst", etiqueta: "requests", icono: ClipboardList, pestanas: [p("requests", "/portal/estudiante/solicitudes")] },
  calendarioEst: { id: "calendarioEst", etiqueta: "calendar", icono: CalendarDays, pestanas: [p("calendar", "/portal/estudiante/calendario"), p("meetings", "/reuniones")] },

  // ── habitudes ──────────────────────────────────────────────────
  visitas: { id: "visitas", etiqueta: "visits", icono: Camera, pestanas: [p("logVisit", "/habitudes/visitas/nueva")] },
  recursos: { id: "recursos", etiqueta: "resources", icono: Library, pestanas: [p("resources", "/habitudes/recursos")] },
  evidencias: { id: "evidencias", etiqueta: "evidences", icono: FileText, pestanas: [p("evidences", "/habitudes/evidencias")] },
  liceos: {
    id: "liceos",
    etiqueta: "schools",
    icono: School,
    pestanas: [p("schoolsTab", "/habitudes/liceos"), p("team", "/habitudes/equipo"), p("impact", "/habitudes/reportes")],
  },

  // ── chofer ─────────────────────────────────────────────────────
  viajeDeHoy: { id: "viajeDeHoy", etiqueta: "tripToday", icono: Bus, pestanas: [p("tripToday", "/portal/chofer")] },
  gastos: { id: "gastos", etiqueta: "expenses", icono: Wallet, pestanas: [p("expenses", "/administrativo/rendiciones")] },
};

/** Los módulos del sidebar de cada rol, en orden. Máximo 9 sin contar los de `pie`. */
export const SIDEBAR_POR_ROL: Record<Rol, readonly string[]> = {
  owner: ["inicio", "estudiantes", "academico", "patrocinadores", "solicitudes", "proyectos", "operaciones", "habitudes", "contabilidad", "calendario", "reportes", "configuracion"],
  developer: ["inicio", "estudiantes", "academico", "patrocinadores", "solicitudes", "proyectos", "operaciones", "habitudes", "contabilidad", "calendario", "reportes", "configuracion"],
  admin: ["inicio", "estudiantes", "academico", "patrocinadores", "solicitudes", "proyectos", "operaciones", "habitudes", "calendario", "reportes", "configuracion"],
  contabilidad: ["inicio", "registrar", "bancosCajas", "porPagar", "pasaje", "presupuesto", "reportesConta", "cierre", "configConta"],
  docente: ["inicio", "misClasesDocente", "porCalificar", "calendarioPrincipal", "solicitudes"],
  estudiante: ["inicio", "misClases", "calificaciones", "miBeca", "solicitudesEst", "calendarioEst"],
  habitudes: ["inicio", "visitas", "recursos", "evidencias", "solicitudes", "calendarioPrincipal"],
  dir_habitudes: ["inicio", "visitas", "recursos", "evidencias", "liceos", "solicitudes", "calendarioPrincipal"],
  // «Inicio» también para el chofer: `/inicio` es la entrada única de todos los roles.
  chofer: ["inicio", "viajeDeHoy", "gastos", "solicitudes"],
};

/** Lo que `nav.ts` sabe de cada pantalla: qué permiso la protege (se busca por `href`). */
export type AccesoDeHref = { permiso?: Permiso; algunPermiso?: readonly Permiso[]; universal?: boolean } | undefined;

type Contexto = { acceso: (href: string) => AccesoDeHref; puede: (permiso: Permiso) => boolean };

function pestanaVisible(pest: PestanaNav, { acceso, puede }: Contexto): boolean {
  const a = acceso(pest.href);
  if (!a) return false;
  if (a.universal) return true;
  if (a.permiso) return puede(a.permiso);
  if (a.algunPermiso) return a.algunPermiso.some(puede);

  return false;
}

export type ModuloVisible = ModuloNav & { href: string; pestanasVisibles: PestanaNav[] };

/** Los módulos del rol que la persona puede abrir, con su enlace (la primera pestaña permitida). */
export function modulosVisibles(rol: Rol, ctx: Contexto): ModuloVisible[] {
  return SIDEBAR_POR_ROL[rol].flatMap((id) => {
    const m = MODULOS[id];
    const visibles = m.pestanas.filter((pest) => pestanaVisible(pest, ctx));

    return visibles.length > 0 ? [{ ...m, href: visibles[0].href, pestanasVisibles: visibles }] : [];
  });
}

const casa = (ruta: string, href: string) => ruta === href || ruta.startsWith(`${href}/`);

/** La pestaña (y su módulo) más específica que casa con la ruta, entre los módulos visibles del rol. */
export function pestanaActiva(rol: Rol, ruta: string, ctx: Contexto): { modulo: ModuloVisible; pestana: PestanaNav; exacta: boolean } | null {
  let mejor: { modulo: ModuloVisible; pestana: PestanaNav; exacta: boolean; largo: number } | null = null;

  for (const modulo of modulosVisibles(rol, ctx)) {
    for (const pestana of modulo.pestanasVisibles) {
      for (const prefijo of [pestana.href, ...(pestana.activoEn ?? [])]) {
        const coincide = pestana.soloExacta && prefijo === pestana.href ? ruta === prefijo : casa(ruta, prefijo);
        if (coincide && (!mejor || prefijo.length > mejor.largo)) {
          mejor = { modulo, pestana, exacta: ruta === pestana.href, largo: prefijo.length };
        }
      }
    }
  }

  return mejor;
}

/**
 * Un icono por pestaña (clave de `nav.tab`), del mismo tamaño que su nombre (`size-[1.15em]` en `TabsTrigger`).
 * Una pestaña sin entrada aquí usa `ICONO_PESTANA_POR_DEFECTO`.
 */
export const ICONO_DE_PESTANA: Record<string, LucideIcon> = {
  home: Home,
  files: Users,
  atRisk: UserX,
  scholarships: HeartHandshake,
  universities: Building2,
  grades: Star,
  terms: CalendarRange,
  prematricula: ClipboardCheck,
  subjects: Library,
  g360: Sparkles,
  list: Table2,
  letters: Mail,
  requests: ClipboardList,
  board: FolderKanban,
  timeline: Timer,
  myTasks: CheckCircle2,
  inventory: Package,
  monthlyServices: HeartHandshake,
  meals: Utensils,
  transport: Bus,
  programs: GraduationCap,
  materials: Layers,
  hub: BookOpen,
  receipts: Receipt,
  journal: ScrollText,
  banks: Landmark,
  cashboxes: Wallet,
  suppliers: Truck,
  payables: HandCoins,
  pasaje: Bus,
  budget: PieChart,
  financialStatements: FileSpreadsheet,
  ledgers: BookOpen,
  closing: Lock,
  calendar: CalendarDays,
  meetings: Video,
  reports: BarChart3,
  studentCost: CircleDollarSign,
  general: Settings,
  staff: UserCog,
  permissions: KeyRound,
  announcements: Megaphone,
  accountingSettings: Wrench,
  expenseReports: Banknote,
  myClasses: BookOpen,
  toGrade: ClipboardCheck,
  classes: BookOpen,
  tasks: CheckCircle2,
  scholarshipTab: HeartHandshake,
  logVisit: Camera,
  evidences: FileText,
  schoolsTab: School,
  team: Users,
  impact: BarChart3,
  tripToday: Bus,
  expenses: Wallet,
};
export const ICONO_PESTANA_POR_DEFECTO: LucideIcon = Layers;
