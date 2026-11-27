import {
  ClipboardCheck,
  BarChart3,
  Bot,
  BookOpen,
  Bus,
  CalendarDays,
  Camera,
  GanttChartSquare,
  ClipboardList,
  DollarSign,
  FolderKanban,
  GraduationCap,
  HeartHandshake,
  HandCoins,
  Gauge,
  Inbox,
  LayoutDashboard,
  Landmark,
  Mail,
  Home,
  Library,
  Map,
  Megaphone,
  MoreHorizontal,
  MonitorPlay,
  Package,
  Presentation,
  ReceiptText,
  Settings,
  ScanSearch,
  Sparkles,
  Star,
  UserCog,
  FileCheck2,
  Receipt,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";

import {
  GRUPOS_CONTABLES,
  MODULOS_CONTABLES,
  modulosDeGrupo,
  type ModuloContable,
} from "@/lib/contabilidad/modulos";
import type { Permiso, Rol } from "@/lib/rbac";
import { tienePermiso } from "@/lib/rbac";

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
  /**
   * La entrada solo se dibuja cuando la persona tiene este permiso. Debe ser el
   * mismo que la pantalla exige con `requerirPermiso`: así lo que el menú
   * ofrece y lo que la página deja abrir nunca se contradicen, y la pantalla
   * de permisos puede decir qué módulos ve cada rol sin otra lista aparte.
   */
  permiso?: Permiso;
  /** Como `permiso`, pero basta con tener UNO (pantallas con pestañas por permiso). */
  algunPermiso?: readonly Permiso[];
  /**
   * Entrada que ve todo el que tenga el menú, sin permiso que la proteja. Es una
   * decisión y no un olvido: cada una lleva al lado el porqué (la pantalla es
   * de todos, o su acceso es por ROL y no por permiso). `scripts/` comprueba
   * que ninguna entrada quede sin `permiso`, `algunPermiso` ni `universal`.
   */
  universal?: boolean;
  /**
   * Fuera de la barra lateral y del menú «Más», pero dentro del buscador ⌘K (que
   * sigue filtrando por permiso). Es para lo que el rol usa poco: la regla 13 de
   * `ux-rules.md` limita el sidebar a 8 entradas y lo raro se busca.
   */
  soloBusqueda?: boolean;
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
    clave: "bandeja",
    etiqueta: "pending",
    icono: Inbox,
    secciones: [
      {
        // Una sola entrada de inicio: Pendientes junta lo que antes eran la
        // bandeja, las tareas y la torre de control (tres pantallas con el
        // mismo trabajo). Cada pestaña se abre con `?tab=`.
        // Universal: la bandeja es el inicio del personal y cada pestaña
        // filtra por sus propios permisos dentro de la pantalla.
        items: [{ etiqueta: "pending", href: "/bandeja", icono: Inbox, universal: true }],
      },
    ],
  },
  // Cada programa en su módulo, por lo que tienen en común: la universidad (catálogo,
  // planes de estudio y notas), las clases propias de la Fundación (Global Effect 360) y
  // Habitudes con la Academia de Liderazgo.
  {
    clave: "academico",
    etiqueta: "academicModule",
    icono: GraduationCap,
    secciones: [
      {
        items: [
          // Catálogo universidad → carrera → plan de estudios: de aquí sale el avance de
          // cada becado en su carrera.
          {
            etiqueta: "universities",
            href: "/academico/universidades",
            icono: Landmark,
            permiso: "catalogo.leer",
          },
          {
            etiqueta: "uploadGrades",
            href: "/academico/universidades/calificaciones",
            icono: ScanSearch,
            permiso: "expedientes.escribir",
          },
        ],
      },
    ],
  },
  {
    clave: "academico",
    etiqueta: "academicModule",
    icono: Sparkles,
    secciones: [
      {
        items: [
          // Une «Clases de 360» y «Asignación de materias»: el docente piensa en
          // sus clases, no en de qué programa vienen.
          {
            etiqueta: "myClasses",
            href: "/portal/profesor/clases",
            icono: Library,
            permiso: "docencia.impartir",
          },
          // La cola de todo lo que espera nota, sin entrar clase por clase.
          {
            etiqueta: "submissionsToGrade",
            href: "/portal/profesor/entregas",
            icono: FileCheck2,
            permiso: "docencia.impartir",
          },
        ],
      },
    ],
  },
  {
    clave: "habitudes",
    etiqueta: "habitudes",
    icono: BookOpen,
    secciones: [
      {
        items: [
          {
            etiqueta: "habitudesHub",
            href: "/habitudes",
            icono: BookOpen,
            permiso: "habitudes.recursos.leer",
          },
        ],
      },
      {
        etiqueta: "leadershipAcademy",
        items: [
          {
            etiqueta: "programs",
            href: "/academias/programas",
            icono: Presentation,
            permiso: "academico.leer",
          },
          {
            etiqueta: "materials",
            href: "/academias/materiales",
            icono: Library,
            permiso: "academico.leer",
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
          {
            etiqueta: "atRisk",
            href: "/expedientes/riesgo",
            icono: HeartHandshake,
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
          // Las cartas de los becados a sus patrocinadores: antes solo se llegaba
          // por un botón de la lista, y lo que no está en un menú no se encuentra.
          {
            etiqueta: "sponsorLetters",
            href: "/patrocinadores/correos",
            icono: Mail,
            permiso: "patrocinadores.escribir",
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
          // El resumen del módulo: cifras que llevan a cada pantalla y todos
          // los módulos que esta persona puede abrir. Universal, porque se
          // arma solo con lo que sus permisos habilitan.
          {
            etiqueta: "adminHome",
            href: "/administrativo",
            icono: LayoutDashboard,
            universal: true,
          },
          // Primero: es lo que espera respuesta de alguien. Universal, porque
          // todo el personal puede pedir algo; lo que cada uno puede RESOLVER
          // lo decide la pantalla con los permisos de solicitudes.
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
            universal: true,
          },
          {
            etiqueta: "projects",
            href: "/administrativo/proyectos",
            icono: FolderKanban,
            permiso: "operaciones.leer",
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
          {
            etiqueta: "transport",
            href: "/administrativo/transporte",
            icono: Bus,
            permiso: "transporte.gestionar",
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
          // Universal: el calendario es de todo el personal (`requerirUsuario`);
          // cada quien ve y puede crear lo que sus permisos permiten.
          { etiqueta: "calendar", href: "/calendario", icono: CalendarDays, universal: true },
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
          // es donde se puede cerrar una parte y no toda la puerta. Por eso
          // basta UNO de los tres permisos de sus pestañas, igual que la pantalla.
          {
            etiqueta: "reports",
            href: "/reportes",
            icono: BarChart3,
            algunPermiso: ["operaciones.leer", "academico.leer", "finanzas.leer"],
          },
          // Universal: `requerirRol(["admin", "super_admin"])`, o sea, acceso por
          // ROL y no por permiso; este menú ya es solo de esos dos roles.
          { etiqueta: "sitemap", href: "/sitemap", icono: Map, universal: true },
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
          // Universal: la entrada de Configuración es por ROL
          // (`requerirRol(["admin", "super_admin"])`); cada tarjeta de dentro
          // se filtra con su permiso.
          { etiqueta: "settings", href: "/configuracion", icono: Settings, universal: true },
          {
            etiqueta: "permissions",
            href: "/configuracion/permisos",
            icono: UserCog,
            permiso: "usuarios.administrar",
          },
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

// Las pantallas del estudiante (`/portal/estudiante/*`) se abren por ROL
// (`requerirRol(["estudiante"])`), no por un permiso: por eso sus entradas son
// `universal`. Solo el chat de IA pide permiso, porque su pantalla lo comprueba.
//
// Ocho entradas como máximo (docs/ux-rules.md §13). Lo que se fundió: Aula
// virtual y Global Effect 360 son «Mis clases» y «Tareas»; Prematrícula se abre
// desde «Mis clases»; Comida, Transporte y Reuniones se abren desde «Mi beca» y
// el calendario. Siguen existiendo sus rutas.
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
            icono: GraduationCap,
            universal: true,
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
            etiqueta: "myClasses",
            href: "/portal/estudiante/clases",
            icono: BookOpen,
            universal: true,
          },
          {
            etiqueta: "tasks",
            href: "/portal/estudiante/tareas",
            icono: ClipboardCheck,
            universal: true,
          },
          // Ahí está el índice académico, que es lo que decide la beca, y las
          // notas finales de 360.
          {
            etiqueta: "grades",
            href: "/portal/estudiante/calificaciones",
            icono: Star,
            universal: true,
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
            universal: true,
          },
          // Índice, servicio, reunión, comida y transporte: todo lo que decide
          // si conserva la beca y lo que usa a diario.
          {
            etiqueta: "myScholarship",
            href: "/portal/estudiante/beca",
            icono: HeartHandshake,
            universal: true,
          },
          // Trámites con administración: constancias, cartas, citas y
          // permisos. Va en la agenda porque casi todo lo que pide tiene
          // fecha, y la cita aprobada aparece en su calendario.
          {
            etiqueta: "myRequests",
            href: "/portal/estudiante/solicitudes",
            icono: Inbox,
            universal: true,
          },
          // Fuera del sidebar (máximo 8) pero buscables con ⌘K: se llega por Mi
          // beca y el calendario, y no deben quedar inalcanzables.
          {
            etiqueta: "meetings",
            href: "/reuniones",
            icono: Users,
            permiso: "reuniones.leer",
            soloBusqueda: true,
          },
          { etiqueta: "meals", href: "/comida", icono: Utensils, universal: true, soloBusqueda: true },
          {
            etiqueta: "transport",
            href: "/portal/estudiante/transporte",
            icono: Bus,
            universal: true,
            soloBusqueda: true,
          },
          {
            etiqueta: "preenrollment",
            href: "/portal/estudiante/prematricula",
            icono: Library,
            universal: true,
            soloBusqueda: true,
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
            permiso: "docencia.impartir",
          },
        ],
      },
    ],
  },
  {
    clave: "global360",
    etiqueta: "global360",
    icono: Sparkles,
    secciones: [
      {
        items: [
          {
            etiqueta: "classes360",
            href: "/academico/clases-360",
            icono: Sparkles,
            permiso: "docencia.impartir",
          },
          // La cola de todo lo que espera nota, sin entrar clase por clase.
          {
            etiqueta: "submissionsToGrade",
            href: "/portal/profesor/entregas",
            icono: FileCheck2,
            permiso: "docencia.impartir",
          },
          // Sus materias con alumnos, notas y asistencia: `/academico/materias` es el
          // catálogo administrativo y desde ahí el docente no puede calificar.
          {
            etiqueta: "academic",
            href: "/portal/profesor/materias",
            icono: Library,
            permiso: "docencia.impartir",
          },
        ],
      },
    ],
  },
  {
    clave: "habitudes",
    etiqueta: "habitudes",
    icono: BookOpen,
    secciones: [
      {
        items: [
          {
            etiqueta: "habitudesHub",
            href: "/habitudes",
            icono: BookOpen,
            permiso: "habitudes.recursos.leer",
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
          // Universal: el calendario es de todo el personal (`requerirUsuario`).
          { etiqueta: "calendar", href: "/calendario", icono: CalendarDays, universal: true },
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
            soloBusqueda: true,
          },
          // El docente pide material o gastos de su curso por aquí. Universal:
          // cualquiera con sesión puede pedir algo.
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
            universal: true,
          },
          // Tienen `rendicion.enviar` y la pantalla ya existía, pero solo la
          // alcanzaba Contabilidad: quien gasta por la Fundación no tenía por
          // dónde rendir la factura.
          {
            etiqueta: "expenseReports",
            href: "/administrativo/rendiciones",
            icono: Receipt,
            permiso: "rendicion.enviar",
            soloBusqueda: true,
          },
        ],
      },
    ],
  },
];

/**
 * Menú del programa Habitudes.
 *
 * Su trabajo es el hub de Habitudes y postular candidatos (una solicitud que
 * aprueba administración). En cuanto el estudiante pasa a activo, el
 * expediente es de administración y esta cuenta deja de verlo. Lleva además
 * su torre, el calendario y las reuniones, porque ahí le llega lo que otros
 * roles le asignan o le convocan.
 */
const MENU_HABITUDES: AreaNav[] = [
  {
    clave: "habitudes",
    etiqueta: "habitudes",
    icono: Sparkles,
    secciones: [
      {
        items: [
          // El hub exige `habitudes.recursos.leer` (el guard de la pantalla es el
          // mismo): quien no lo tiene no ve la entrada, ni entra por la URL.
          {
            etiqueta: "habitudesHub",
            href: "/habitudes",
            icono: BookOpen,
            permiso: "habitudes.recursos.leer",
          },
          // Postular a un candidato ES una solicitud (`alta_expediente`) que
          // aprueba administración: no hay lista de expedientes que ver, y una
          // entrada a `/expedientes` los devolvía a su portal sin explicación.
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
            universal: true,
          },
          // Tienen `rendicion.enviar` y la pantalla ya existía, pero solo la
          // alcanzaba Contabilidad: quien gasta por la Fundación no tenía por
          // dónde rendir la factura.
          {
            etiqueta: "expenseReports",
            href: "/administrativo/rendiciones",
            icono: Receipt,
            permiso: "rendicion.enviar",
          },
          // Tienen `reuniones.agendar`/`leer` (y el director, `gestionar`),
          // pero sin estas entradas una reunión a la que los convocaban solo
          // se encontraba escribiendo la dirección a mano.
          { etiqueta: "calendar", href: "/calendario", icono: CalendarDays, universal: true },
          {
            etiqueta: "meetings",
            href: "/reuniones",
            icono: Users,
            permiso: "reuniones.leer",
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
/**
 * El director supervisa a los facilitadores: su entrada a `/habitudes` abre en
 * la pestaña de supervisión (mapa de liceos, visitas, evidencias por auditar),
 * no en los recursos, y así se llama en su menú.
 */
const MENU_DIR_HABITUDES: AreaNav[] = MENU_HABITUDES.map((area) => ({
  ...area,
  secciones: area.secciones.map((seccion) => ({
    ...seccion,
    items: seccion.items.map((item) =>
      item.href === "/habitudes" ? { ...item, etiqueta: "habitudesSupervision" } : item,
    ),
  })),
}));

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
            permiso: "contabilidad.leer",
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
          { etiqueta: "calendar", href: "/calendario", icono: CalendarDays, universal: true },
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
    universal: modulo.universal,
  };
}

/**
 * Menú exclusivo del chofer institucional: cabina de mando móvil y directa.
 */
const MENU_CHOFER: AreaNav[] = [
  {
    clave: "chofer",
    etiqueta: "transport",
    icono: Bus,
    secciones: [
      {
        items: [
          {
            etiqueta: "driverDashboard",
            href: "/portal/chofer",
            icono: Bus,
            permiso: "transporte.operar",
          },
          // Pedir una compra a contabilidad y ver cómo va: lo puede hacer
          // todo rol, sin permiso de entrada.
          {
            etiqueta: "requests",
            href: "/administrativo/solicitudes",
            icono: Inbox,
            universal: true,
          },
          // Rinde el gasoil, el pinchazo o el peaje: es quien más gasta efectivo en la
          // calle y no tenía por dónde entregar la factura.
          {
            etiqueta: "expenseReports",
            href: "/administrativo/rendiciones",
            icono: Receipt,
            permiso: "rendicion.enviar",
          },
          // Las reuniones a las que lo convocan; ya no la torre de control ni el
          // calendario corporativo, que no son de alguien al volante.
          { etiqueta: "meetings", href: "/reuniones", icono: Users, permiso: "reuniones.leer" },
        ],
      },
    ],
  },
];

/**
 * Lo que se suma al menú cuando a una persona se le habilita una función que
 * su rol no trae. Hoy, la docencia: un profesor de Habitudes al que se le dio
 * `docencia.impartir` ve su portal de profesor y sus clases de 360 sin dejar
 * de ser de Habitudes.
 */
const AREA_DOCENCIA: AreaNav = {
  clave: "docencia",
  etiqueta: "teacherPortal",
  icono: BookOpen,
  secciones: [
    {
      items: [
        {
          etiqueta: "teacherPortal",
          href: "/portal/profesor",
          icono: BookOpen,
          permiso: "docencia.impartir",
        },
        {
          etiqueta: "myClasses",
          href: "/portal/profesor/clases",
          icono: Library,
          permiso: "docencia.impartir",
        },
        {
          etiqueta: "submissionsToGrade",
          href: "/portal/profesor/entregas",
          icono: FileCheck2,
          permiso: "docencia.impartir",
        },
      ],
    },
  ],
};

// Solo `super_admin`: el tablero de Dirección/Junta va primero y la bandeja sigue debajo.
const MENU_SUPER_ADMIN: AreaNav[] = [
  {
    clave: "ejecutivo",
    etiqueta: "executiveDashboard",
    icono: Gauge,
    // Universal: `requerirRol(["super_admin"])`. Es acceso por ROL (Dirección/Junta),
    // no un permiso que se reparta; el menú ya es solo de ese rol.
    secciones: [
      {
        items: [{ etiqueta: "executiveDashboard", href: "/ejecutivo", icono: Gauge, universal: true }],
      },
    ],
  },
  ...MENU_ADMINISTRACION,
];

const AREAS_POR_CAPACIDAD: readonly { permiso: Permiso; area: AreaNav }[] = [
  { permiso: "docencia.impartir", area: AREA_DOCENCIA },
];

const MENU_POR_ROL: Record<Rol, AreaNav[]> = {
  super_admin: MENU_SUPER_ADMIN,
  admin: MENU_ADMINISTRACION,
  docente: MENU_DOCENTE,
  estudiante: MENU_ESTUDIANTE,
  contabilidad: MENU_CONTABILIDAD,
  habitudes: MENU_HABITUDES,
  dir_habitudes: MENU_DIR_HABITUDES,
  chofer: MENU_CHOFER,
};

/**
 * Menú del rol, ya sin las entradas que su permiso no admite. Las secciones que se quedan sin ninguna entrada
 * desaparecen, y las áreas que se quedan sin ninguna sección tampoco llegan al
 * raíl: un icono que abre un panel vacío es peor que no tener el icono.
 */
export function menuDe(
  rol: Rol,
  /**
   * Permisos efectivos de la persona (rol + excepciones). Sin ellos se usa el
   * reparto de fábrica del rol, que es lo que necesitan los catálogos por rol.
   */
  permisos?: ReadonlySet<Permiso>,
): AreaNav[] {
  const puede = (permiso: Permiso) =>
    permisos ? permisos.has(permiso) : tienePermiso(rol, permiso);

  const base = MENU_POR_ROL[rol];
  const hrefsBase = new Set(base.flatMap(itemsDeArea).map((item) => item.href));
  const habilitadas = AREAS_POR_CAPACIDAD.filter(
    ({ permiso, area }) =>
      permisos?.has(permiso) &&
      area.secciones.flatMap((s) => s.items).some((i) => !hrefsBase.has(i.href)),
  ).map(({ area }) => area);

  return [...base, ...habilitadas]
    .map((area) => ({
      ...area,
      secciones: area.secciones
        .map((seccion) => ({
          ...seccion,
          // La visibilidad se DERIVA del permiso: no hay otra lista que
          // configurar. Quien no puede abrir un módulo, no lo ve.
          items: seccion.items.filter(
            (item) =>
              (!item.permiso || puede(item.permiso)) &&
              (!item.algunPermiso || item.algunPermiso.some(puede)),
          ),
        }))
        .filter((seccion) => seccion.items.length > 0),
    }))
    .filter((area) => area.secciones.length > 0);
}

/** El menú tal como se dibuja: sin las entradas que solo viven en el buscador. */
export function menuVisibleDe(rol: Rol, permisos?: ReadonlySet<Permiso>): AreaNav[] {
  return menuDe(rol, permisos)
    .map((area) => ({
      ...area,
      secciones: area.secciones
        .map((seccion) => ({ ...seccion, items: seccion.items.filter((item) => !item.soloBusqueda) }))
        .filter((seccion) => seccion.items.length > 0),
    }))
    .filter((area) => area.secciones.length > 0);
}

/**
 * Entradas sin `permiso` ni `universal` de un menú: debe devolver vacío. Lo usa
 * el script de verificación para que una entrada nueva no se cuele sin decidir
 * quién puede verla.
 */
export function itemsSinDeclarar(rol: Rol): ItemNav[] {
  return itemsDeTodoElMenu(rol).filter(
    (item) => !item.permiso && !item.algunPermiso && !item.universal,
  );
}

/**
 * Las entradas del menú de un rol que este permiso abre, para que la pantalla
 * de permisos diga qué módulos enciende cada interruptor. Sin repetir: una
 * misma ruta puede salir en dos áreas.
 */
export function modulosQueHabilita(rol: Rol, permiso: Permiso): ItemNav[] {
  const vistos = new Set<string>();

  return itemsDeTodoElMenu(rol).filter((item) => {
    const depende = item.permiso === permiso || item.algunPermiso?.includes(permiso);
    if (!depende || vistos.has(item.href)) return false;
    vistos.add(item.href);
    return true;
  });
}

/** Todo lo que el rol puede llegar a ver, sin filtrar: base + áreas por capacidad. */
export function itemsDeTodoElMenu(rol: Rol): ItemNav[] {
  return [...MENU_POR_ROL[rol], ...AREAS_POR_CAPACIDAD.map(({ area }) => area)].flatMap(
    itemsDeArea,
  );
}

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

/** Dónde está la persona dentro del menú: para las migas de pan. */
export type MigaRuta = {
  area: AreaNav;
  seccion: SeccionNav;
  item: ItemNav;
  /** La ruta es más profunda que la entrada del menú (una ficha, un detalle). */
  esDetalle: boolean;
};

/** Área › sección › entrada de la ruta actual, con la coincidencia más específica. */
export function migasDeRuta(
  rol: Rol,
  ruta: string,
  permisos?: ReadonlySet<Permiso>,
): MigaRuta | null {
  const candidatos = menuDe(rol, permisos).flatMap((area) =>
    area.secciones.flatMap((seccion) =>
      seccion.items
        .filter((item) => esRutaActiva(ruta, item.href))
        .map((item) => ({ area, seccion, item })),
    ),
  );
  const mejor = candidatos.sort((a, b) => b.item.href.length - a.item.href.length)[0];

  return mejor ? { ...mejor, esDetalle: ruta !== mejor.item.href } : null;
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
  "/ejecutivo",
  "/bandeja",
  "/portal/profesor",
  "/portal/profesor/clases",
  "/portal/profesor/entregas",
  "/portal/contabilidad",
  "/administrativo/solicitudes",
  "/calendario",
  "/expedientes",
  "/academico/clases-360",
  "/contabilidad/recibos",
  "/contabilidad/bancos",
];

/** Etiqueta corta para la pestaña: en 11 px "Portal administrativo" no cabe. */
const ETIQUETA_CORTA: Record<string, string> = {
  "/ejecutivo": "home",
  "/bandeja": "home",
  "/portal/profesor": "home",
  "/portal/contabilidad": "home",
  "/portal/estudiante": "home",
  "/portal/estudiante/clases": "classesShort",
  "/portal/profesor/clases": "classesShort",
  "/portal/profesor/entregas": "toGradeShort",
  "/portal/estudiante/solicitudes": "requests",
  "/administrativo/solicitudes": "requests",
  "/administrativo/inventario": "inventory",
  "/administrativo/inventario/escanear": "scanQr",
};

/**
 * Estudiante: Inicio · Clases · Tareas · Más (cuatro, sin botón central: el
 * estudiante viene a ver qué entregar, entregarlo y ver sus notas).
 *
 * «Más» abre el menú completo, donde están Calificaciones, Mi beca, Calendario,
 * Solicitudes y el chat. El perfil sigue en el menú del avatar de la barra de
 * arriba.
 */
export function pestanasMoviles(
  rol: Rol,
  /** Permisos efectivos: sin ellos las pestañas seguían el reparto de fábrica. */
  permisos?: ReadonlySet<Permiso>,
): PestanaMovil[] {
  const items = menuDe(rol, permisos).flatMap(itemsDeArea);
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
      "/portal/estudiante/clases",
      "/portal/estudiante/tareas",
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
