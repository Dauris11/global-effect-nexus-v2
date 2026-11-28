import { ENTIDAD } from "./entidad";

/**
 * Preguntas frecuentes del PORTAL (no de la Fundación). Fuente única: de aquí
 * salen la lista que se ve en la landing y el JSON-LD `FAQPage`, así que el
 * texto que lee una persona y el que lee un buscador no pueden diferir.
 *
 * Reglas para editar:
 * - Cada respuesta debe ser cierta contra el código: nombres de secciones del
 *   menú (`messages/*.json`, espacio `nav`) y rutas reales. Si una pantalla
 *   cambia de nombre, se corrige aquí.
 * - Sin cifras (becados, montos) y sin horas fijas del comedor: la apertura y el
 *   cierre son parámetros editables (`comedor.apertura` / `comedor.cierre`) y
 *   fijarlos en un texto lo dejaría desactualizado.
 * - El `id` es el ancla compartible (`/#faq-<id>`); no se renombra una vez
 *   publicado porque rompería los enlaces que alguien ya copió.
 */

export type CategoriaFaq = "acceso" | "estudiantes" | "docentes" | "privacidad";

export type Bilingue = { es: string; en: string };

export type PreguntaFaq = {
  id: string;
  categoria: CategoriaFaq;
  pregunta: Bilingue;
  respuesta: Bilingue;
};

const C = ENTIDAD.correo;

export const FAQ_PORTAL: readonly PreguntaFaq[] = [
  {
    id: "que-es-el-portal",
    categoria: "acceso",
    pregunta: { es: "¿Qué es el Portal GlobalEffect?", en: "What is the GlobalEffect Portal?" },
    respuesta: {
      es: "Es la plataforma en línea de la Fundación Global Effect donde estudiantes becados, docentes y el equipo de la fundación gestionan clases, notas, solicitudes, comida y transporte. Cada persona entra con su cuenta y ve solo lo que corresponde a su perfil.",
      en: "It is the online platform of the Global Effect Foundation where scholarship students, teachers and the foundation team manage classes, grades, requests, meals and transport. Each person signs in with their own account and sees only what belongs to their profile.",
    },
  },
  {
    id: "quien-puede-entrar",
    categoria: "acceso",
    pregunta: { es: "¿Quién puede entrar al portal?", en: "Who can sign in to the portal?" },
    respuesta: {
      es: "Los estudiantes becados, los docentes de Global Effect 360 y el personal de la fundación. La cuenta la crea la fundación; no hay registro abierto.",
      en: "Scholarship students, Global Effect 360 teachers and the foundation staff. The foundation creates every account; there is no open sign-up.",
    },
  },
  {
    id: "primer-acceso",
    categoria: "acceso",
    pregunta: { es: "¿Cómo entro por primera vez?", en: "How do I sign in for the first time?" },
    respuesta: {
      es: "Cuando la fundación crea tu cuenta te llega un correo con un enlace para elegir tu contraseña. Después entras desde la pantalla de acceso con ese correo y tu contraseña, o con «Continuar con Google» usando ese mismo correo.",
      en: "When the foundation creates your account you receive an email with a link to choose your password. After that you sign in from the sign-in screen with that email and your password, or with “Continue with Google” using that same email.",
    },
  },
  {
    id: "olvide-contrasena",
    categoria: "acceso",
    pregunta: { es: "Olvidé mi contraseña, ¿qué hago?", en: "I forgot my password, what do I do?" },
    respuesta: {
      es: `La pantalla de acceso todavía no recupera contraseñas por sí sola. Escribe a ${C} desde tu correo registrado y la fundación te envía un enlace para elegir una nueva. Si entras con Google, no necesitas contraseña.`,
      en: `The sign-in screen does not reset passwords by itself yet. Write to ${C} from your registered email and the foundation will send you a link to choose a new one. If you sign in with Google, you do not need a password.`,
    },
  },
  {
    id: "cuenta-no-registrada",
    categoria: "acceso",
    pregunta: {
      es: "Me sale “Tu cuenta no está registrada”, ¿por qué?",
      en: "I get “Your account is not registered”, why?",
    },
    respuesta: {
      es: `Tu correo todavía no está dado de alta en el portal o usaste uno distinto al que registró la fundación. “Continuar con Google” solo funciona con correos ya registrados. Escribe a ${C} desde tu correo para que lo revisen.`,
      en: `Your email is not yet registered in the portal, or you used a different one from the one the foundation registered. “Continue with Google” only works with emails that are already registered. Write to ${C} from your email so they can check it.`,
    },
  },
  {
    id: "notas-e-indice",
    categoria: "estudiantes",
    pregunta: { es: "¿Dónde veo mis notas y mi índice?", en: "Where do I see my grades and my GPA?" },
    respuesta: {
      es: "En la sección Calificaciones del menú. Ahí aparecen tus notas por período, tu índice académico y los créditos de tus materias; se actualizan oficialmente al cierre de cada cuatrimestre.",
      en: "In the Grades section of the menu. It shows your grades by term, your academic GPA and the credits of your subjects; they are officially updated when each four-month term closes.",
    },
  },
  {
    id: "entregar-tarea",
    categoria: "estudiantes",
    pregunta: { es: "¿Cómo entrego una tarea?", en: "How do I hand in an assignment?" },
    respuesta: {
      es: "Entra a Tareas (o a Mis clases y abre la clase), abre la tarea, adjunta tu archivo o escribe tu respuesta y pulsa «Entregar». Puedes hacerlo desde el celular.",
      en: "Go to Tasks (or to My classes and open the class), open the assignment, attach your file or write your answer and press “Submit”. You can do it from your phone.",
    },
  },
  {
    id: "almuerzo",
    categoria: "estudiantes",
    pregunta: { es: "¿Cómo me inscribo al almuerzo?", en: "How do I sign up for lunch?" },
    respuesta: {
      es: "Desde la página de Inscripción de comida (también en la sección Comida de tu portal) te inscribes cada día mientras la inscripción esté abierta. Fuera del horario del día aparece como «Cerrado».",
      en: "From the Meal sign-up page (also in the Meals section of your portal) you sign up each day while sign-up is open. Outside that day’s window it shows as “Closed”.",
    },
  },
  {
    id: "constancia-o-carta",
    categoria: "estudiantes",
    pregunta: { es: "¿Cómo pido una constancia o una carta?", en: "How do I request a certificate or a letter?" },
    respuesta: {
      es: "En Mis solicitudes eliges el tipo (constancia, carta, permiso o cita con administración), completas los datos y la envías. Ves su estado ahí mismo hasta que esté lista.",
      en: "In My requests you choose the type (certificate, letter, permission or an appointment with administration), fill in the details and send it. You can follow its status there until it is ready.",
    },
  },
  {
    id: "transporte",
    categoria: "estudiantes",
    pregunta: { es: "¿Cómo sé dónde viene el transporte?", en: "How do I know where the transport is?" },
    respuesta: {
      es: "El transporte lo usan los estudiantes de Rincón, Jima, Ranchito, Saba Rey y Rancho Viejo. En la sección Transporte ves tus rutas y paradas y, cuando hay un viaje en curso, su posición en el mapa.",
      en: "Transport is used by students from Rincón, Jima, Ranchito, Saba Rey and Rancho Viejo. In the Transport section you see your routes and stops and, when a trip is under way, its position on the map.",
    },
  },
  {
    id: "calificar-entregas",
    categoria: "docentes",
    pregunta: { es: "¿Cómo califico las entregas?", en: "How do I grade submissions?" },
    respuesta: {
      es: "En Por calificar abres cada entrega, pones la nota y un comentario y pasas a la siguiente con «Guardar y siguiente».",
      en: "In To grade you open each submission, enter the grade and a comment, and move on to the next one with “Save and next”.",
    },
  },
  {
    id: "privacidad",
    categoria: "privacidad",
    pregunta: { es: "¿Quién puede ver mis datos?", en: "Who can see my data?" },
    respuesta: {
      es: "Solo tú y el personal autorizado de la fundación. Cada perfil tiene permisos distintos. Para más detalle, consulta la Política de privacidad, enlazada al pie de esta página.",
      en: "Only you and the foundation’s authorized staff. Each profile has different permissions. For more detail, see the Privacy Policy, linked at the bottom of this page.",
    },
  },
];

/** Orden en el que salen los chips de categoría. */
export const CATEGORIAS_FAQ: readonly CategoriaFaq[] = ["acceso", "estudiantes", "docentes", "privacidad"];
