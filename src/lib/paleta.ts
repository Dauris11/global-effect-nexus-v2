/**
 * El color del sistema, en un solo sitio.
 *
 * REGLA DURA DE MARCA: azul claro, azul oscuro, blanco y negro. Nada más, en
 * ningún sitio —botones, avisos, insignias, gráficas, acentos por rol—. Ni
 * naranja, ni morado, ni verde, ni rojo.
 *
 * Con una sola excepción, acotada y escrita: `SEMAFORO`, al final de este
 * archivo, gasta dos matices en los dos estados que tienen que saltar de una
 * lista de ocho. Está ahí explicado por qué, y no vale para nada más.
 *
 * Eso obliga a un cambio de fondo en cómo se distinguen las cosas. Antes el
 * matiz llevaba el significado: verde bien, rojo mal, un color por rol. Ahora lo
 * lleva el PESO dentro del mismo azul —cuanto más oscuro, más importa— y el
 * negro marca el extremo. Una escala así se sigue leyendo de un vistazo, que era
 * lo que hacía el arcoíris, y además se lee igual en escala de grises y para
 * quien no distingue matices.
 *
 * Conviene decirlo claro: un aviso de error deja de ser rojo. La gravedad se
 * dice con el tono más pesado y con el icono, no con el matiz.
 *
 * Las clases van escritas completas y nunca compuestas (`bg-${x}` no se
 * compila): Tailwind necesita ver la cadena entera en el código.
 *
 * La escala de calificaciones (A–F) NO está aquí: vive en `src/lib/notas.ts`,
 * junto al tramo de nota y al índice sobre 4.00 que la producen. Separarla del
 * color sería partir en dos algo que solo tiene sentido junto —una letra sin su
 * tramo no se puede calcular—, así que el color la acompaña allí.
 */

/** Azul claro institucional. Es el color de la Fundación. */
export const AZUL = "#2096BA";
/** El mismo azul, un paso más oscuro: hover de botones y texto sobre claro. */
export const AZUL_MEDIO = "#177A99";
/** El más oscuro de la marca: lo que más pesa sin llegar al negro. */
export const AZUL_OSCURO = "#0E4A5E";
/** Un paso más claro que la marca, para separar series en una gráfica. */
export const AZUL_SUAVE = "#74C5DD";
/** Negro institucional: el extremo de la escala. */
export const TINTA = "#14191F";
/** Rojo de estado (`--danger`): lo urgente, lo vencido y lo que sale, también en las gráficas. */
export const PELIGRO = "#B91C1C";
/** El lienzo. Lo usa `themeColor`, que no admite clases. */
export const BLANCO = "#FFFFFF";
/** Gris neutro, para lo que no tiene peso. */
export const NEUTRO = "#94A3B8";

/**
 * Serie categórica de las gráficas: una rampa del mismo azul, de oscuro a
 * claro, con el gris al final.
 *
 * Cinco tonos y no más. Con seis empiezan a confundirse dos vecinos, y una
 * gráfica de panel que hay que descifrar no sirve de nada.
 */
export const SERIE = [AZUL_OSCURO, AZUL, AZUL_SUAVE, NEUTRO, TINTA] as const;

/**
 * Dinero. Entra en azul, sale en negro.
 *
 * No es la convención de siempre —verde y rojo— y es a propósito: la marca no
 * tiene ni verde ni rojo. Lo que se conserva es lo que hace falta para leer la
 * gráfica: dos tonos que no se confunden y el signo escrito al lado.
 *
 * Son colores sueltos porque las gráficas los quieren así: Recharts pinta con
 * `fill`, no con clases.
 */
export const FINANZAS = {
  ingreso: AZUL,
  egreso: TINTA,
  balance: AZUL_OSCURO,
} as const;

/**
 * Lo mismo, pero en clases, para las listas y las tablas de transacciones.
 *
 * Va aparte de `FINANZAS` y no dentro porque las gráficas necesitan el color
 * crudo y las tablas necesitan la clase: meter ambas cosas en un solo objeto
 * obligaría a todos los consumidores a saber cuál de las dos formas quieren.
 *
 * El signo va aquí y no en la vista a propósito. Es la única señal que sobrevive
 * en blanco y negro, así que no puede quedar a criterio de cada pantalla.
 */
export const MOVIMIENTO = {
  ingreso: {
    texto: "text-marca-600",
    cuadro: "bg-marca-50 text-marca-600",
    signo: "+",
  },
  egreso: {
    texto: "text-tinta",
    cuadro: "bg-muted text-tinta",
    signo: "−",
  },
} as const;

export type TipoMovimiento = keyof typeof MOVIMIENTO;

/** `transaccion.tipo` es TEXT: lo que venga de la base se comprueba antes. */
export function esMovimiento(valor: string): valor is TipoMovimiento {
  return valor in MOVIMIENTO;
}

/**
 * Prioridad de una tarea, de más a menos urgente.
 *
 * Cuatro pesos del mismo azul, con el negro arriba: urgente es lo más pesado
 * que hay en pantalla y baja apenas se nota. Las claves coinciden con lo que
 * guarda `tarea.prioridad`, así que la base indexa aquí directamente.
 */
export const PRIORIDAD = {
  urgente: {
    color: PELIGRO,
    clases: "border border-status-danger-border bg-status-danger-bg text-status-danger-fg",
    punto: "bg-status-danger",
  },
  alta: {
    color: AZUL_OSCURO,
    clases: "bg-marca-700 text-white",
    punto: "bg-marca-700",
  },
  media: {
    color: AZUL,
    clases: "bg-marca-50 text-marca-700",
    punto: "bg-marca-500",
  },
  baja: {
    color: NEUTRO,
    clases: "bg-muted text-tinta-2",
    punto: "bg-tinta-3",
  },
} as const;

export type Prioridad = keyof typeof PRIORIDAD;

export const PRIORIDADES = ["urgente", "alta", "media", "baja"] as const;

/** Una prioridad desconocida en la base no debe romper la pantalla. */
export function esPrioridad(valor: string): valor is Prioridad {
  return valor in PRIORIDAD;
}

/**
 * Estado de un proyecto, una tarea o una cita, con el color ESTÁNDAR de estado
 * (tokens `est-*` de `globals.css`, los mismos de `src/lib/estados-trabajo.ts`).
 * Un estado que no esté en la lista cae en gris, que es lo que menos afirma.
 */
export const ESTADO = {
  en_curso: "bg-est-progreso/10 text-est-progreso",
  en_progreso: "bg-est-progreso/10 text-est-progreso",
  programada: "bg-est-progreso/10 text-est-progreso",
  en_revision: "bg-est-revision/10 text-est-revision",
  completado: "bg-est-listo/10 text-est-listo",
  completada: "bg-est-listo/10 text-est-listo",
  pausado: "bg-est-pausa/10 text-est-pausa",
  planificacion: "bg-est-pendiente/10 text-est-pendiente",
  pendiente: "bg-est-pendiente/10 text-est-pendiente",
  por_hacer: "bg-est-pendiente/10 text-est-pendiente",
  cancelada: "bg-muted text-tinta-3",
  cancelado: "bg-muted text-tinta-3",
} as const;

export function clasesDeEstado(estado: string): string {
  return ESTADO[estado as keyof typeof ESTADO] ?? "bg-muted text-tinta-2";
}

/**
 * Cuadro pastel de un icono, en los cuatro pesos que se usan.
 *
 * Sustituye a los `bg-marca-50 text-marca-700` y compañía que antes daban
 * un color por módulo. Ahora el módulo no tiene color propio: tiene el de la
 * casa, y lo que varía es cuánto pesa.
 */
export const CUADRO = {
  fuerte: "bg-marca-700 text-white",
  marca: "bg-marca-50 text-marca-700",
  suave: "bg-marca-50 text-marca-600",
  neutro: "bg-muted text-tinta-2",
  tinta: "bg-tinta text-background",
} as const;

/**
 * @deprecated El lenguaje "app web" no usa banners en degradado: la cabecera
 * es `EncabezadoPagina`. Se elimina al terminar la Fase 5 del rediseño.
 */

/**
 * Las dos únicas excepciones a la regla de un solo matiz.
 *
 * La escala de pesos del azul funciona hasta que hay que separar muchos valores
 * a la vez. Los ocho estados de un expediente son ese caso: con solo peso, tres
 * grises quedaban casi iguales y dos azules claros también, así que el estado
 * dejaba de leerse de un vistazo, que era justo lo que la escala prometía.
 *
 * La salida no es abrir la paleta —eso devuelve el arcoíris por la puerta de
 * atrás— sino gastar exactamente dos matices en los dos estados que tienen que
 * saltar: el que dice que la persona está dentro y el que pide actuar. Los seis
 * restantes siguen en azul y gris, y todos llevan además su icono.
 *
 * Verde y rojo apagados a propósito (no `green-500` ni `red-500`): puestos al
 * lado del azul de la marca, los tonos saturados se comen la pantalla y la
 * insignia acaba pesando más que el nombre del estudiante.
 *
 * NO usar fuera de un estado. Ni en botones, ni en banners, ni en gráficas, ni
 * para decir "bien" y "mal" en un formulario: para eso sigue estando el peso.
 */
export const SEMAFORO = {
  /** Dentro y al día. */
  dentro: "#1E9E6A",
  /** En observación / cumplimiento parcial. */
  advertencia: "#D97706",
  /** Requiere una decisión de alguien. */
  alerta: "#B4342B",
} as const;

/**
 * Los mismos estados como clases de insignia, escritas aquí y no en
 * cada `.tsx`: así ningún componente lleva un hex suelto y `audit:ui` no
 * tiene que hacer excepciones. Siempre acompañadas de su icono.
 */
export const INSIGNIA_SEMAFORO = {
  dentro: "border-transparent bg-[#1E9E6A]/10 text-[#1E9E6A]",
  advertencia: "border-transparent bg-[#D97706]/10 text-[#D97706]",
  alerta: "border-transparent bg-[#B4342B]/10 text-[#B4342B]",
} as const;

/**
 * Gris de las rejillas y los ejes de las gráficas.
 *
 * Es el mismo contraste que los bordes y el texto secundario del resto de las
 * pantallas, así que una gráfica no pesa más que la tarjeta que la contiene.
 */
export const GRAFICA = {
  rejilla: "#EBEEF1", // = token `linea`
  texto: "#64748B", // slate-500
} as const;

/**
 * ────────────────────────────────────────────────────────────────────────────
 * PATRONES — clases ya armadas sobre los tokens de globals.css
 *
 * Desde el rediseño "app web" (oct 2026) ninguna clase de aquí lleva un hex:
 * todas usan los tokens (`marca-*`, `tinta`, `linea`, `rounded-card`,
 * `shadow-card`…), así que el aspecto se cambia en globals.css y no en
 * noventa archivos. Los únicos hex de este archivo son los colores crudos de
 * arriba, que las gráficas necesitan porque pintan con `fill`.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Tarjeta de módulo (AccesoRapido y cards de listas).
 *
 * Usar siempre con `group` en el contenedor para que el icono se escale.
 */
export const TARJETA = {
  /** Tarjeta clicable: se eleva al pasar, se comprime al pulsar. */
  interactiva:
    "rounded-card border border-linea bg-card shadow-card transition-all duration-200 hover:shadow-elevada hover:border-linea-fuerte hover:-translate-y-0.5 active:scale-[0.99] cursor-pointer",
  /** Tarjeta de contenido, sin movimiento. */
  contenido: "rounded-card border border-linea bg-card shadow-card",
  /** Icono en círculo gris: el acento lo pone el icono, no el fondo. */
  icono:
    "flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-tinta",
  iconoPequeno:
    "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-tinta",
  /** Icono en tinta, para lo urgente. */
  iconoTinta:
    "flex size-10 shrink-0 items-center justify-center rounded-full bg-tinta text-background",
  /** Fila de lista: separada por línea, no por caja. */
  fila:
    "flex items-start gap-3 border-b border-linea py-3 last:border-b-0 transition-colors hover:bg-muted/50",
  /** Fila destacada: lo que espera una decisión. */
  filaDestacada:
    "rounded-control border border-marca-200 bg-marca-50 p-3 transition-colors hover:bg-marca-100",
} as const;

/**
 * Botones — estados de carga y variantes de marca.
 */
export const BOTON = {
  /** El CTA: un solo color plano de la marca. */
  primario:
    "rounded-control bg-marca-500 font-semibold text-white transition-all duration-150 hover:bg-marca-600 active:scale-[0.97]",
  /** Secundario: blanco con borde, texto tinta. */
  secundario:
    "rounded-control border border-linea-fuerte bg-background font-semibold text-tinta transition-all duration-150 hover:bg-muted active:scale-[0.97]",
  /** @deprecated Se usa `primario`. Se elimina en la Fase 5. */
  primarioOscuro:
    "rounded-control bg-marca-700 font-semibold text-white transition-all duration-150 hover:bg-tinta active:scale-[0.97]",
  outline:
    "rounded-control transition-all duration-150 active:scale-[0.97] hover:bg-muted",
} as const;

/**
 * StatCard — Tarjeta de estadística con icono lateral.
 *
 * Pattern: Card > CardContent > flex gap-3 > [icono] [valor + label]
 */
export const STAT_CARD = {
  card: "rounded-card border border-linea bg-card shadow-card",
  content: "p-5",
  // Contenedor neutro (canvas + ink-3) para todos los iconos de cifra: ningún KPI "destaca" por color.
  iconoAcento:
    "flex size-9 shrink-0 items-center justify-center rounded-control bg-canvas text-tinta-3",
  iconoNeutro:
    "flex size-9 shrink-0 items-center justify-center rounded-control bg-canvas text-tinta-3",
  /** La cifra va en tinta siempre: el acento lo lleva el icono. */
  valorAcento: "text-[34px] font-semibold leading-none tracking-tight text-tinta tabular-nums",
  valorNeutro: "text-[34px] font-semibold leading-none tracking-tight text-tinta tabular-nums",
  label: "texto-meta mt-1.5",
} as const;

/**
 * Estado vacío — cuando una lista no tiene resultados.
 *
 * Pattern: div.py-12.text-center > span [icono] > p [título] > p [descripción]
 */
export const VACIO = {
  contenedor: "py-14 text-center",
  icono:
    "mx-auto flex size-16 items-center justify-center rounded-full bg-muted text-tinta-2",
  titulo: "texto-titulo-tarjeta mt-4",
  descripcion: "mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-tinta-2",
} as const;

/**
 * Nombres de las clases de animación globales (declaradas en globals.css).
 *
 * Usar estos strings en className para evitar errores tipográficos.
 */
export const ANIMACION = {
  /** Entrada de página o sección completa */
  entrada: "animate-fade-in-up",
  /** Skeleton / placeholder de carga */
  shimmer: "animate-shimmer",
  /** Badge de estado activo / indicador vivo */
  pulso: "animate-soft-pulse",
} as const;

/**
 * Alerta de riesgos — para cualquier módulo que
 * necesite destacar una alerta sin usar color rojo.
 *
 * La gravedad se dice con el icono AlertTriangle + texto negro, no con rojo.
 */
export const ALERTA_RIESGO = {
  contenedor:
    "flex items-start gap-2 rounded-control border border-status-warning-border bg-status-warning-bg p-3",
  icono: "mt-0.5 size-4 shrink-0 text-status-warning",
  texto: "text-sm text-status-warning-fg leading-relaxed",
  etiqueta: "font-semibold",
} as const;

/**
 * Píldora de filtro — tabs tipo chip para filtrar listas.
 *
 * Activa: bg-marca-500 text-white con sombra de marca
 * Inactiva: outline con hover a muted
 */
export const PILDORA_FILTRO = {
  base: "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150",
  activa: "border-tinta bg-tinta text-background",
  inactiva: "border-linea-fuerte text-tinta-2 hover:border-tinta hover:text-tinta",
} as const;

