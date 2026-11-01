import {
  BarChart3,
  Bot,
  BookOpen,
  CalendarDays,
  Camera,
  GanttChartSquare,
  ClipboardList,
  DollarSign,
  FolderKanban,
  GraduationCap,
  HandCoins,
  Inbox,
  Landmark,
  Home,
  LayoutDashboard,
  Library,
  ListTodo,
  Map,
  Megaphone,
  MoreHorizontal,
  MonitorPlay,
  Package,
  Presentation,
  ReceiptText,
  Settings,
  Shield,
  Sparkles,
  Star,
  TowerControl,
  UserCog,
  Users,
  Utensils,
  Wallet,
  Wrench,
} from "lucide-react";

import {
  GRUPOS_CONTABLES,
  MODULOS_CONTABLES,
  modulosDeGrupo,
  type ModuloContable,
} from "@/lib/contabilidad/modulos";
import type { Permiso, Rol } from "@/lib/rbac";
import { PORTAL_POR_ROL, tienePermiso } from "@/lib/rbac";

/**
 * Menús de la barra lateral, uno por rol (sección 3 del inventario).
 *
 * El menú tiene DOS niveles, porque la barra lateral también los tiene: un
 * raíl de iconos con las áreas del rol y, al lado, un panel con las secciones
 * y los enlaces del área elegida. Antes era un solo nivel con grupos
 * plegables; el modelo cambia, las rutas y los permisos no.
 *
 *   AreaNav   → un icono del raíl (Académico, Patrocinadores, Finanzas…)
 *   SeccionNav → un encabezado dentro del panel; sin `etiqueta`, los enlaces
 *                van sueltos arriba del todo
 *   ItemNav   → un enlace a una ruta real
 *
 * `etiqueta` es siempre una clave de `messages/*.json` bajo el espacio `nav`,
 * nunca texto literal.
 *
 * `permiso` es opcional y ahí está la diferencia importante respecto al
 * inventario: aquel describe un menú de administrador con Contabilidad
 * dentro, pero en la base de datos `admin` no tiene `finanzas.leer`. En vez de mantener dos menús casi
 * idénticos, el de administración se declara completo y cada entrada sensible
 * se marca con su permiso: `super_admin` las ve todas y `admin` solo las que
 * le corresponden. Así el menú nunca ofrece una puerta que el servidor va a
 * cerrar. Un área que se queda sin ninguna entrada no llega a dibujar su
 * icono en el raíl.
 */

export type ItemNav = {
  /** Clave de traducción dentro del espacio `nav`. */
  etiqueta: string;
  href: string;
  icono: React.ComponentType<{ className?: string }>;
  /** Si se indica, la entrada solo se dibuja cuando el rol tiene el permiso. */
  permiso?: Permiso;
};

export type SeccionNav = {
  /** Encabezado dentro del panel. Sin él, los enlaces van al primer nivel. */
  etiqueta?: string;
  items: ItemNav[];
};

export type AreaNav = {
  /** Identificador estable del área: clave de React y del estado del raíl. */
  clave: string;
  /** Clave de traducción dentro del espacio `nav`. */
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  secciones: SeccionNav[];
};

const MENU_ADMINISTRACION: AreaNav[] = [
  {
    clave: "panel",
    etiqueta: "dashboard",
    icono: LayoutDashboard,
    secciones: [
      {
        items: [
          // El portal va PRIMERO: es la entrada del rol, donde converge todo.
          // `/dashboard` se queda como la pantalla de gráficas, que es otra
          // pregunta y merece su propia entrada.
          {
            etiqueta: "adminPortal",
            href: "/portal/administrativo",
            icono: Shield,
          },
          { etiqueta: "dashboard", href: "/dashboard", icono: LayoutDashboard },
        ],
      },
    ],
  },
  {
    clave: "academico",
    etiqueta: "academicModule",
    icono: GraduationCap,
    secciones: [
      {
        etiqueta: "courses",
        items: [
          {
            etiqueta: "classes360",
            href: "/academico/clases-360",
            icono: Sparkles,
          },
          { etiqueta: "academic", href: "/academico/materias", icono: Library },
          { etiqueta: "history", href: "/academico/historial", icono: BarChart3 },
          {
            etiqueta: "preenrollment",
            href: "/academico/prematricula",
            icono: ClipboardList,
          },
          {
            etiqueta: "periods",
            href: "/academico/periodos",
            icono: CalendarDays,
          },
        ],
      },
      {
        etiqueta: "academies",
        items: [
          {
            etiqueta: "programs",
            href: "/academias/programas",
            icono: Presentation,
          },
          {
            etiqueta: "materials",
            href: "/academias/materiales",
            icono: Library,
          },
          {
            etiqueta: "habitudesHub",
            href: "/habitudes",
            icono: BookOpen,
          },
        ],
      },
    ],
  },
  {
    clave: "expedientes",
    etiqueta: "records",
    icono: Users,
    secciones: [
      {
        items: [
          {
            etiqueta: "records",
            href: "/expedientes",
            icono: Users,
            permiso: "expedientes.leer",
          },
        ],
      },
    ],
  },
  {
    clave: "patrocinadores",
    etiqueta: "sponsors",
    icono: HandCoins,
    secciones: [
      {
        items: [
          {
            etiqueta: "sponsorList",
            href: "/patrocinadores",
            icono: HandCoins,
            permiso: "patrocinadores.leer",
          },
          {
            etiqueta: "scholarships",
            href: "/patrocinadores/becas",
            icono: GraduationCap,
            permiso: "patrocinadores.leer",
          },
        ],
      },
    ],
  },
  {
    clave: "operaciones",
    etiqueta: "admin",
    icono: ClipboardList,
    secciones: [
      {
        etiqueta: "admin",
        items: [
          // Primero: es lo que espera respuesta de alguien. Sin permiso, porque
          // todo el personal puede pedir algo; lo que cada uno puede RESOLVER
          // lo decide la pantalla con los permisos de solicitudes.
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
          },
          { etiqueta: "tasks", href: "/administrativo/tareas", icono: ListTodo },
          {
            etiqueta: "controlTower",
            href: "/administrativo/torre-control",
            icono: TowerControl,
          },
          {
            etiqueta: "teamTower",
            href: "/administrativo/torre-control/equipo",
            icono: Users,
            permiso: "operaciones.escribir",
          },
          {
            etiqueta: "projects",
            href: "/administrativo/proyectos",
            icono: FolderKanban,
          },
          {
            etiqueta: "staff",
            href: "/administrativo/personal",
            icono: UserCog,
            permiso: "usuarios.administrar",
          },
        ],
      },
      {
        etiqueta: "operations",
        items: [
          {
            etiqueta: "inventory",
            href: "/administrativo/inventario",
            icono: Package,
            permiso: "inventario.leer",
          },
          {
            etiqueta: "scanQr",
            href: "/administrativo/inventario/escanear",
            icono: Camera,
            permiso: "inventario.auditar",
          },
          {
            etiqueta: "monthlyServices",
            href: "/servicios-mensuales",
            icono: CalendarDays,
            permiso: "operaciones.leer",
          },
          {
            etiqueta: "mealList",
            href: "/inscripcion-comida",
            icono: Utensils,
            permiso: "operaciones.leer",
          },
        ],
      },
    ],
  },
  {
    // Reservado a contabilidad y super_admin.
    clave: "finanzas",
    etiqueta: "finances",
    icono: DollarSign,
    secciones: [
      {
        // `contabilidad.leer` y no `finanzas.leer`: super_admin entra a
        // mirar (y a auditar), pero las acciones de escritura del módulo le
        // responden que no. `admin` no tiene ninguno de los dos. Los módulos
        // salen del registro del departamento, igual que el menú de contabilidad.
        items: [
          {
            etiqueta: "accountingHome",
            href: "/portal/contabilidad",
            icono: Home,
            permiso: "contabilidad.leer",
          },
          ...MODULOS_CONTABLES.filter((modulo) => modulo.enAdministracion).map(itemDeModulo),
        ],
      },
    ],
  },
  {
    clave: "herramientas",
    etiqueta: "tools",
    icono: Sparkles,
    secciones: [
      {
        items: [
          { etiqueta: "calendar", href: "/calendario", icono: CalendarDays },
          {
            etiqueta: "meetings",
            href: "/reuniones",
            icono: Users,
            permiso: "reuniones.leer",
          },
          // La línea de tiempo cierra su propia puerta (junta datos
          // académicos y de operaciones), pero se ofrece solo a quien
          // lleva operaciones: es el que la va a usar de verdad.
          {
            etiqueta: "timeline",
            href: "/calendario/gantt",
            icono: GanttChartSquare,
            permiso: "operaciones.leer",
          },
          {
            etiqueta: "chatIaAdmin",
            href: "/chat-ia",
            icono: Bot,
            permiso: "ia.usar",
          },
          // Los reportes salieron del área de Finanzas y vinieron aquí, SIN
          // permiso. Estaban marcados con `finanzas.leer`, que `admin` no
          // tiene, así que coordinación no veía la entrada —y dos de las tres
          // pestañas del módulo son de operaciones y de académico, que sí
          // lleva—. La pestaña financiera se cierra dentro de la pantalla, que
          // es donde se puede cerrar una parte y no toda la puerta.
          { etiqueta: "reports", href: "/reportes", icono: BarChart3 },
          { etiqueta: "sitemap", href: "/sitemap", icono: Map },
        ],
      },
    ],
  },
  {
    clave: "configuracion",
    etiqueta: "settings",
    icono: Settings,
    secciones: [
      {
        items: [
          { etiqueta: "settings", href: "/configuracion", icono: Settings },
          // La cara pública del sistema. Va con su permiso, que es el que la
          // migración 0015 creó para esto: `admin` y `super_admin` lo tienen,
          // y si alguna vez se le quita a uno, la entrada desaparece con él.
          {
            etiqueta: "homeAnnouncements",
            href: "/configuracion/landing",
            icono: Megaphone,
            permiso: "landing.administrar",
          },
        ],
      },
    ],
  },
];

const MENU_ESTUDIANTE: AreaNav[] = [
  {
    clave: "panel",
    etiqueta: "studentPortal",
    icono: Home,
    secciones: [
      {
        items: [
          {
            etiqueta: "studentPortal",
            href: "/portal/estudiante",
            icono: Wrench,
          },
        ],
      },
    ],
  },
  {
    clave: "academico",
    etiqueta: "academicModule",
    icono: GraduationCap,
    secciones: [
      {
        items: [
          {
            etiqueta: "mySubjects",
            href: "/portal/estudiante/prematricula",
            icono: Library,
          },
          // Las asignaciones cuelgan de la misma matrícula, así que van con
          // ella.
          {
            etiqueta: "virtualClassroom",
            href: "/portal/estudiante/aula-virtual",
            icono: MonitorPlay,
          },
          // Global Effect 360: las materias de la Fundación. Desde la 0047 son
          // para todos, todas obligatorias, una por tanda.
          {
            etiqueta: "global360",
            href: "/portal/estudiante/global-360",
            icono: Sparkles,
          },
          // Ahí está el índice académico, que es lo que decide la beca, y las
          // notas finales de 360.
          {
            etiqueta: "grades",
            href: "/portal/estudiante/calificaciones",
            icono: Star,
          },
        ],
      },
    ],
  },
  {
    clave: "agenda",
    etiqueta: "agenda",
    icono: CalendarDays,
    secciones: [
      {
        items: [
          {
            etiqueta: "calendar",
            href: "/portal/estudiante/calendario",
            icono: CalendarDays,
          },
          {
            etiqueta: "meetings",
            href: "/reuniones",
            icono: Users,
          },
          // Trámites con administración: constancias, cartas, citas y
          // permisos. Va en la agenda porque casi todo lo que pide tiene
          // fecha, y la cita aprobada aparece en su calendario.
          {
            etiqueta: "myRequests",
            href: "/portal/estudiante/solicitudes",
            icono: Inbox,
          },
        ],
      },
    ],
  },
  {
    clave: "ia",
    etiqueta: "chatIa",
    icono: Bot,
    secciones: [
      {
        items: [
          {
            etiqueta: "chatIa",
            href: "/portal/estudiante/chat",
            icono: Bot,
            permiso: "ia.usar",
          },
        ],
      },
    ],
  },
];

const MENU_DOCENTE: AreaNav[] = [
  {
    clave: "panel",
    etiqueta: "teacherPortal",
    icono: Home,
    secciones: [
      {
        items: [
          {
            etiqueta: "teacherPortal",
            href: "/portal/profesor",
            icono: BookOpen,
          },
        ],
      },
    ],
  },
  {
    clave: "academico",
    etiqueta: "academicModule",
    icono: GraduationCap,
    secciones: [
      {
        items: [
          {
            etiqueta: "classes360",
            href: "/academico/clases-360",
            icono: Sparkles,
          },
          { etiqueta: "academic", href: "/academico/materias", icono: Library },
          {
            etiqueta: "habitudesHub",
            href: "/habitudes",
            icono: BookOpen,
          },
        ],
      },
    ],
  },
  {
    clave: "agenda",
    etiqueta: "agenda",
    icono: CalendarDays,
    secciones: [
      {
        items: [
          { etiqueta: "calendar", href: "/calendario", icono: CalendarDays },
          {
            etiqueta: "meetings",
            href: "/reuniones",
            icono: Users,
          },
          // La línea de tiempo cierra su propia puerta (junta datos
          // académicos y de operaciones), pero se ofrece solo a quien
          // lleva operaciones: es el que la va a usar de verdad.
          {
            etiqueta: "timeline",
            href: "/calendario/gantt",
            icono: GanttChartSquare,
            permiso: "operaciones.leer",
          },
          // El docente pide material o gastos de su curso por aquí.
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
          },
          {
            etiqueta: "controlTower",
            href: "/administrativo/torre-control",
            icono: TowerControl,
          },
        ],
      },
    ],
  },
];

/**
 * Menú del programa Habitudes.
 *
 * Dos entradas, y es todo lo que puede hacer este rol: postular candidatos y
 * pedir a administración que los dé de alta. En cuanto el estudiante pasa a
 * activo, el expediente es de administración y esta cuenta deja de verlo.
 *
 * No lleva calendario ni panel propio: la pantalla de expedientes ES su portal,
 * y por eso `PORTAL_POR_ROL` lo manda ahí al entrar.
 */
const MENU_HABITUDES: AreaNav[] = [
  {
    clave: "habitudes",
    etiqueta: "habitudes",
    icono: Sparkles,
    secciones: [
      {
        items: [
          {
            etiqueta: "habitudesHub",
            href: "/habitudes",
            icono: BookOpen,
          },
          // Postular a un candidato ES una solicitud (`alta_expediente`) que
          // aprueba administración: no hay lista de expedientes que ver, y una
          // entrada a `/expedientes` los devolvía a su portal sin explicación.
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
          },
          {
            etiqueta: "controlTower",
            href: "/administrativo/torre-control",
            icono: TowerControl,
          },
        ],
      },
    ],
  },
];

/**
 * Menú de Contabilidad: estructurado en áreas funcionales por ciclo contable
 * más las herramientas operativas institucionales (Calendario, Reuniones, Chat IA).
 * Cada área se dibuja con su icono y encabezado en la barra lateral.
 */
const MENU_CONTABILIDAD: AreaNav[] = [
  {
    clave: "contab_general",
    etiqueta: "contabGroups.general",
    icono: BookOpen,
    secciones: [
      {
        items: [
          {
            etiqueta: "accountingHome",
            href: "/portal/contabilidad",
            icono: Home,
          },
          ...modulosDeGrupo("general").map(itemDeModulo),
        ],
      },
    ],
  },
  {
    clave: "contab_tesoreria",
    etiqueta: "contabGroups.tesoreria",
    icono: Landmark,
    secciones: [
      {
        items: modulosDeGrupo("tesoreria").map(itemDeModulo),
      },
    ],
  },
  {
    clave: "contab_ingresos",
    etiqueta: "contabGroups.ingresos",
    icono: HandCoins,
    secciones: [
      {
        items: modulosDeGrupo("ingresos").map(itemDeModulo),
      },
    ],
  },
  {
    clave: "contab_gastos",
    etiqueta: "contabGroups.gastos",
    icono: ReceiptText,
    secciones: [
      {
        items: modulosDeGrupo("gastos").map(itemDeModulo),
      },
    ],
  },
  {
    clave: "contab_impuestos",
    etiqueta: "contabGroups.impuestos",
    icono: DollarSign,
    secciones: [
      {
        items: modulosDeGrupo("impuestos").map(itemDeModulo),
      },
    ],
  },
  {
    clave: "contab_activos",
    etiqueta: "contabGroups.activos",
    icono: Package,
    secciones: [
      {
        items: modulosDeGrupo("activos").map(itemDeModulo),
      },
    ],
  },
  {
    clave: "contab_gestion",
    etiqueta: "tools",
    icono: Sparkles,
    secciones: [
      {
        items: [
          ...modulosDeGrupo("departamento").map(itemDeModulo),
          { etiqueta: "controlTower", href: "/administrativo/torre-control", icono: TowerControl },
          { etiqueta: "calendar", href: "/calendario", icono: CalendarDays },
          { etiqueta: "meetings", href: "/reuniones", icono: Users, permiso: "reuniones.leer" },
          { etiqueta: "chatIaAdmin", href: "/chat-ia", icono: Bot, permiso: "ia.usar" },
        ],
      },
    ],
  },
];

function itemDeModulo(modulo: ModuloContable): ItemNav {
  return {
    etiqueta: modulo.etiqueta,
    href: modulo.href,
    icono: modulo.icono,
    permiso: modulo.permiso,
  };
}

/**
 * Menú del personal operativo (colaborador: choferes, mantenimiento, etc.).
 * Diseñado específicamente para uso móvil / PWA con accesos directos:
 * "Mi Día" (tareas de hoy), rendición de comprobantes con foto y solicitudes.
 */
const MENU_COLABORADOR: AreaNav[] = [
  {
    clave: "colaborador",
    etiqueta: "operations",
    icono: Wrench,
    secciones: [
      {
        items: [
          {
            // La torre ya es «mi día»: tareas de hoy, vencidas y de la semana.
            etiqueta: "controlTower",
            href: "/administrativo/torre-control",
            icono: TowerControl,
          },
          {
            etiqueta: "expenseReports",
            href: "/administrativo/rendiciones",
            icono: ReceiptText,
            permiso: "rendicion.enviar",
          },
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
            permiso: "solicitudes.gestionar",
          },
        ],
      },
    ],
  },
];

const MENU_POR_ROL: Record<Rol, AreaNav[]> = {
  super_admin: MENU_ADMINISTRACION,
  admin: MENU_ADMINISTRACION,
  docente: MENU_DOCENTE,
  estudiante: MENU_ESTUDIANTE,
  contabilidad: MENU_CONTABILIDAD,
  habitudes: MENU_HABITUDES,
  dir_habitudes: MENU_HABITUDES,
  colaborador: MENU_COLABORADOR,
};

/**
 * Menú del rol, ya sin las entradas que su permiso no admite. Las secciones que se quedan sin ninguna entrada
 * desaparecen, y las áreas que se quedan sin ninguna sección tampoco llegan al
 * raíl: un icono que abre un panel vacío es peor que no tener el icono.
 */
export function menuDe(rol: Rol, ocultos?: ReadonlySet<string>): AreaNav[] {
  return MENU_POR_ROL[rol]
    .map((area) => ({
      ...area,
      secciones: area.secciones
        .map((seccion) => ({
          ...seccion,
          items: seccion.items.filter(
            (item) =>
              (!item.permiso || tienePermiso(rol, item.permiso)) &&
              // Lo que el administrador maestro ocultó para este rol (ver
              // `/configuracion/visibilidad`). El permiso sigue mandando: ocultar
              // no da acceso a nada, solo quita la entrada.
              !ocultos?.has(item.href),
          ),
        }))
        .filter((seccion) => seccion.items.length > 0),
    }))
    .filter((area) => area.secciones.length > 0);
}

/**
 * Entradas que nadie puede ocultar ni bloquear a un rol: su portal de inicio y su
 * perfil. Sin ellas, una pantalla de visibilidad mal puesta lo dejaría sin sitio
 * al que ir ni forma de cambiar su foto o salir.
 */
export function rutasProtegidas(rol: Rol): string[] {
  return ["/perfil", PORTAL_POR_ROL[rol]];
}

/** Función transversal que también se puede ocultar por rol: el botón del asistente. */
export const FUNCION_ASISTENTE = "funcion:asistente_ia";

/** Todos los enlaces de un área, sin sus secciones. */
export function itemsDeArea(area: AreaNav): ItemNav[] {
  return area.secciones.flatMap((seccion) => seccion.items);
}

/** Una ruta está activa si coincide o si es un ancestro con `/` de por medio. */
export function esRutaActiva(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(`${href}/`);
}

/**
 * Área a la que pertenece la ruta actual, para que el raíl marque la suya al
 * entrar por URL directa. Gana la coincidencia más específica: sin ordenar por
 * longitud, `/academico/materias` casaría con cualquier entrada que empiece
 * por `/academico`.
 */
export function areaDeRuta(rol: Rol, ruta: string): AreaNav | null {
  const candidatos = menuDe(rol)
    .flatMap((area) =>
      itemsDeArea(area)
        .filter((item) => esRutaActiva(ruta, item.href))
        .map((item) => ({ area, href: item.href })),
    )
    .sort((a, b) => b.href.length - a.href.length);

  return candidatos[0]?.area ?? null;
}

/**
 * Clave de traducción del título de la página actual, buscando la ruta más
 * específica que case.
 */
export function tituloDeRuta(rol: Rol, ruta: string): string | null {
  const candidatos = menuDe(rol)
    .flatMap(itemsDeArea)
    .filter((item) => esRutaActiva(ruta, item.href))
    .sort((a, b) => b.href.length - a.href.length);

  return candidatos[0]?.etiqueta ?? null;
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * PESTAÑAS DEL MÓVIL (barra inferior).
 *
 * En el teléfono la barra lateral no está: abajo hay cinco pestañas, como en
 * una app, y la quinta es "Más", que abre el menú completo en una hoja. Las
 * cuatro primeras salen de aquí y no del componente, para que la barra y el
 * menú no puedan contradecirse: cada pestaña es un ítem que el rol ya tiene en
 * `menuDe`, con su permiso ya filtrado.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type PestanaMovil =
  | { tipo: "enlace"; etiqueta: string; href: string; icono: ItemNav["icono"] }
  | { tipo: "mas"; etiqueta: string; icono: ItemNav["icono"] };

/**
 * Lo que más se abre, en orden, para el personal. Se toman los cuatro primeros
 * que el rol tenga en su menú; si tiene menos, se completa con su menú en el
 * orden de siempre. La entrada de cada portal va primero: es "Inicio".
 */
const PRIORIDAD_MOVIL = [
  "/portal/administrativo",
  "/portal/profesor",
  "/portal/contabilidad",
  "/administrativo/solicitudes",
  "/calendario",
  "/expedientes",
  "/administrativo/tareas",
  "/academico/clases-360",
  "/contabilidad/recibos",
  "/contabilidad/bancos",
];

/** Etiqueta corta para la pestaña: en 11 px "Portal administrativo" no cabe. */
const ETIQUETA_CORTA: Record<string, string> = {
  "/portal/administrativo": "home",
  "/portal/profesor": "home",
  "/portal/contabilidad": "home",
  "/portal/estudiante": "home",
  "/portal/estudiante/aula-virtual": "classroom",
  "/portal/estudiante/solicitudes": "requests",
  "/administrativo/solicitudes": "requests",
  "/administrativo/inventario": "inventory",
  "/administrativo/inventario/escanear": "scanQr",
};

/**
 * Estudiante: Inicio, Aula, Calendario, Solicitudes y Más.
 *
 * El plan pedía "Perfil" como quinta, y se cambió por "Más" a conciencia: sin
 * ella, Calificaciones, Global Effect 360 y el chat no tendrían entrada en el
 * teléfono. El perfil sigue a un toque, en el menú del avatar de la barra de
 * arriba.
 */
export function pestanasMoviles(rol: Rol, ocultos?: ReadonlySet<string>): PestanaMovil[] {
  const items = menuDe(rol, ocultos).flatMap(itemsDeArea);
  // Un objeto y no un `Map`: en este archivo `Map` es el icono de lucide.
  const porHref: Record<string, ItemNav> = Object.fromEntries(
    items.map((item) => [item.href, item]),
  );
  const mas: PestanaMovil = { tipo: "mas", etiqueta: "more", icono: MoreHorizontal };

  const enlace = (item: ItemNav): PestanaMovil => ({
    tipo: "enlace",
    etiqueta: ETIQUETA_CORTA[item.href] ?? item.etiqueta,
    href: item.href,
    icono: item.icono,
  });

  if (rol === "estudiante") {
    const deseadas = [
      "/portal/estudiante",
      "/portal/estudiante/aula-virtual",
      "/portal/estudiante/calendario",
      "/portal/estudiante/solicitudes",
    ];

    return [
      ...deseadas.flatMap((href) => {
        const item = porHref[href];
        return item ? [enlace(item)] : [];
      }),
      mas,
    ];
  }

  const elegidas = PRIORIDAD_MOVIL.filter((href) => porHref[href]);
  for (const item of items) {
    if (elegidas.length >= 4) break;
    if (!elegidas.includes(item.href)) elegidas.push(item.href);
  }

  return [...elegidas.slice(0, 4).map((href) => enlace(porHref[href])), mas];
}
