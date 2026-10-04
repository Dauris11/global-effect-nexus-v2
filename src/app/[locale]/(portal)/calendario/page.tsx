import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";

import { Calendario } from "@/components/calendario/calendario";
import type { Entrada } from "@/components/calendario/event-manager";
import { mensajesCliente } from "@/i18n/mensajes-cliente";
import { requerirUsuario } from "@/lib/auth";
import { claveDia, claveMes } from "@/lib/fechas";
import { tienePermiso } from "@/lib/rbac";
import { calendarioDelMes } from "@/server/calendario/consultas";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calendar" });

  return { title: t("title") };
}

/**
 * Calendario interno: mes, semana, día y lista, con buscador, filtros y
 * arrastrar para mover.
 *
 * La página es de servidor y solo hace tres cosas: comprobar quién mira, traer
 * el mes y decidir qué puede tocar. Todo lo demás —las cuatro vistas, los
 * filtros, el arrastre— vive en `EventManager`, que es cliente porque nada de
 * eso se puede hacer sin JavaScript.
 *
 * Quién ve qué lo decide la CONSULTA, no el componente: los eventos son de todo
 * el equipo, las tareas solo las asignadas a quien mira, y las citas con
 * administración solo para quien las atiende (`solicitudes.gestionar`). Y `editable` se calcula aquí, en el
 * servidor, para que el componente no tenga que conocer el modelo de permisos;
 * las acciones lo vuelven a comprobar antes de escribir.
 */
export default async function PaginaCalendario({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { locale } = await params;
  const { mes: mesPedido } = await searchParams;

  const usuario = await requerirUsuario();

  // Un mes con formato raro en la URL se ignora: llega de un enlace que puede
  // haber quedado viejo.
  const mes = /^\d{4}-\d{2}$/.test(mesPedido ?? "") ? mesPedido! : claveMes();

  const [t, filas, mensajes] = await Promise.all([
    getTranslations({ locale, namespace: "calendar" }),
    calendarioDelMes({ usuarioId: usuario.id, rol: usuario.rol, mes }),
    mensajesCliente(["calendar"]),
  ]);

  const puedeCrear = tienePermiso(usuario.rol, "operaciones.escribir");
  const puedeMoverCitas = tienePermiso(usuario.rol, "solicitudes.gestionar");

  /*
   * Qué puede mover cada quien:
   *
   *   · un evento, si tiene `operaciones.escribir`
   *   · una cita con administración, si tiene `solicitudes.gestionar`
   *   · una tarea, nunca: su fecha límite la fija quien la asignó
   */
  const entradas: Entrada[] = filas.map((fila) => ({
    origen: fila.origen,
    id: fila.id,
    titulo: fila.titulo,
    detalle: fila.detalle,
    dia: fila.dia,
    hora: fila.hora,
    horaFin: fila.hora_fin,
    descripcion: fila.descripcion,
    ubicacion: fila.ubicacion,
    estado: fila.estado,
    prioridad: fila.prioridad ?? "media",
    editable:
      fila.origen === "evento"
        ? puedeCrear
        : fila.origen === "cita"
          ? puedeMoverCitas
          : false,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Un solo título. Antes eran tres apilados: el del módulo en la barra
          superior, este con su rótulo "OPERACIONES", y el del mes que pinta el
          propio calendario. */}
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <CalendarDays className="size-5 text-[#2096BA]" />
        {t("title")}
      </h1>

      <NextIntlClientProvider messages={mensajes}>
        <Calendario
          entradas={entradas}
          mes={mes}
          hoy={claveDia()}
          puedeCrear={puedeCrear}
          puedeMoverCitas={puedeMoverCitas}
        />
      </NextIntlClientProvider>
    </div>
  );
}
