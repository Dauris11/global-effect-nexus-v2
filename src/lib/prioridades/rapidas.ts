import { esRolTotal } from "@/lib/rbac";
import {
  BarChart3,
  BookOpen,
  Bus,
  Calculator,
  Camera,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FolderPlus,
  GraduationCap,
  HandCoins,
  Library,
  ListTodo,
  Mail,
  Receipt,
  Upload,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { Rol } from "@/lib/rbac";

/** Un acceso de «Crear rápido»: `clave` es la etiqueta en `priorities.quick.<clave>`. */
export type AccesoRapido = { clave: string; href: string; icono: LucideIcon };

const NUEVA_SOLICITUD: AccesoRapido = { clave: "newRequest", href: "/administrativo/solicitudes", icono: ClipboardList };

/** Tres accesos por rol (los de la maqueta). Cada ruta la protege su propia pantalla. */
export const ACCESOS_RAPIDOS: Record<Rol, readonly AccesoRapido[]> = {
  developer: [
    NUEVA_SOLICITUD,
    { clave: "newProject", href: "/administrativo/proyectos", icono: FolderPlus },
    { clave: "viewReports", href: "/reportes", icono: BarChart3 },
  ],
  owner: [
    NUEVA_SOLICITUD,
    { clave: "newProject", href: "/administrativo/proyectos", icono: FolderPlus },
    { clave: "viewReports", href: "/reportes", icono: BarChart3 },
  ],
  admin: [
    { clave: "newFile", href: "/expedientes", icono: FilePlus2 },
    { clave: "uploadGrades", href: "/academico/universidades/calificaciones", icono: Upload },
    { clave: "sponsorLetter", href: "/patrocinadores/correos", icono: Mail },
  ],
  contabilidad: [
    { clave: "expenseReceipt", href: "/contabilidad/recibos/nuevo", icono: Receipt },
    { clave: "manualEntry", href: "/contabilidad/asientos/nuevo", icono: Calculator },
    { clave: "cashCount", href: "/contabilidad/cajas", icono: Wallet },
  ],
  docente: [
    { clave: "createTask", href: "/portal/profesor/clases", icono: ClipboardCheck },
    { clave: "uploadMaterial", href: "/portal/profesor/clases", icono: Upload },
    { clave: "toGrade", href: "/portal/profesor/entregas", icono: GraduationCap },
  ],
  estudiante: [
    { clave: "requestCertificate", href: "/portal/estudiante/solicitudes", icono: HandCoins },
    { clave: "myTasks", href: "/portal/estudiante/tareas", icono: ListTodo },
    { clave: "myClasses", href: "/portal/estudiante/clases", icono: BookOpen },
  ],
  habitudes: [
    { clave: "resources", href: "/habitudes/recursos", icono: Library },
    { clave: "nominate", href: "/administrativo/solicitudes?tipo=alta_expediente", icono: UserPlus },
    { clave: "logVisit", href: "/habitudes/visitas/nueva", icono: Camera },
  ],
  dir_habitudes: [
    { clave: "resources", href: "/habitudes/recursos", icono: Library },
    { clave: "nominate", href: "/administrativo/solicitudes?tipo=alta_expediente", icono: UserPlus },
    { clave: "viewReports", href: "/habitudes/reportes", icono: BarChart3 },
  ],
  chofer: [
    { clave: "myTrip", href: "/portal/chofer", icono: Bus },
    NUEVA_SOLICITUD,
  ],
};

/** El botón primario de la cabecera: un menú «Nueva solicitud ▾» / «Registrar ▾», o un solo enlace. */
export type BotonPrimario =
  | { tipo: "menu"; etiqueta: "newRequest" | "register"; opciones: readonly AccesoRapido[] }
  | { tipo: "enlace"; etiqueta: "publishTask"; href: string };

export function botonPrimarioDe(rol: Rol): BotonPrimario | null {
  if (rol === "admin" || esRolTotal(rol)) {
    return {
      tipo: "menu",
      etiqueta: "newRequest",
      opciones: [NUEVA_SOLICITUD, { clave: "newFile", href: "/expedientes", icono: FilePlus2 }, { clave: "newTask", href: "/administrativo/tareas", icono: ListTodo }],
    };
  }
  if (rol === "contabilidad") {
    return {
      tipo: "menu",
      etiqueta: "register",
      opciones: [
        { clave: "incomeReceipt", href: "/contabilidad/recibos/nuevo", icono: Receipt },
        { clave: "expenseReceipt", href: "/contabilidad/recibos/nuevo", icono: Receipt },
        { clave: "manualEntry", href: "/contabilidad/asientos/nuevo", icono: Calculator },
        { clave: "cashCount", href: "/contabilidad/cajas", icono: Wallet },
      ],
    };
  }
  return null;
}
