import { esAccionSolicitud } from "@/lib/solicitudes";
import { solicitudesDe, solicitudesPorAtender } from "@/server/solicitudes/consultas";

import { diaComoFecha, type ItemCrudo, type Proveedor } from "../tipos";

/**
 * Solicitudes: lo que espera MI decisión (con el mismo filtro de `solicitudesPorAtender`, que ya
 * respeta permisos y separación de funciones) y lo que yo pedí y ya tiene respuesta.
 *
 * Las altas de expediente salen como `alta_expediente_por_revisar` porque son una responsabilidad
 * distinta de «decidir solicitudes» (se asignan por separado en «Qué atiende»).
 */
export const proveedorSolicitudes: Proveedor = {
  nombre: "solicitudes",
  tipos: ["solicitud_por_decidir", "solicitud_pendiente_direccion", "alta_expediente_por_revisar", "mi_solicitud_respondida"],
  async getItems({ usuario, hoy }) {
    const [porAtender, mias] = await Promise.all([solicitudesPorAtender(usuario), solicitudesDe(usuario)]);
    const items: ItemCrudo[] = [];

    for (const s of porAtender) {
      const decide = s.acciones.find((a) => a === "aprobar_direccion" || a === "aprobar" || a === "completar" || a === "tomar");
      const tipo =
        s.estado === "pendiente_direccion"
          ? "solicitud_pendiente_direccion"
          : s.tipo === "alta_expediente"
            ? "alta_expediente_por_revisar"
            : "solicitud_por_decidir";
      const puedeRechazar = s.acciones.includes("rechazar");

      items.push({
        id: `${tipo}:${s.id}`,
        tipo,
        titulo: `${decide === "completar" ? "Completar" : decide === "tomar" ? "Tomar" : "Aprobar"} «${s.titulo}»`,
        contexto: [`Solicitud #${s.folio}`, s.estudiante ?? s.solicitante].filter(Boolean).join(" · "),
        modulo: "solicitudes",
        href: "/administrativo/solicitudes",
        venceEn: s.fecha_requerida ? diaComoFecha(s.fecha_requerida) : undefined,
        creadoEn: new Date(s.creada),
        bloquea: true,
        subtipo: s.tipo,
        contextoGrupo: s.estudiante ?? s.solicitante ?? undefined,
        montoUsd: s.monto ?? undefined,
        accion: { label: decide === "completar" ? "Completar" : decide === "tomar" ? "Tomar" : "Aprobar", kind: "inline", action: `solicitud:${decide ?? "aprobar"}` },
        accionSecundaria: puedeRechazar ? { label: "Rechazar", action: "solicitud:rechazar" } : undefined,
      });
    }

    // Respondida = cerrada en los últimos 14 días. No hay marca de «leída»: cuando exista, se filtra aquí.
    for (const s of mias) {
      if (!["aprobada", "rechazada", "completada"].includes(s.estado) || !s.resuelta_en) continue;
      const dias = (Date.parse(`${hoy}T12:00:00Z`) - Date.parse(s.resuelta_en)) / 86_400_000;
      if (dias > 14) continue;

      items.push({
        id: `mi_solicitud_respondida:${s.id}`,
        tipo: "mi_solicitud_respondida",
        titulo: `Ver respuesta de «${s.titulo}»`,
        contexto: `Solicitud #${s.folio} · ${s.estado}`,
        modulo: "solicitudes",
        href: "/administrativo/solicitudes",
        creadoEn: new Date(s.resuelta_en),
        responsableId: usuario.id,
        accion: { label: "Ver respuesta", kind: "link" },
      });
    }

    // «Esperando a otros»: lo que pedí y sigue abierto. Responsable = yo (para que me aparezca) y
    // `esperandoA` = quien lo tiene; el motor lo manda a su propia pestaña.
    for (const s of mias) {
      if (!["enviada", "en_revision", "pendiente_direccion", "aprobada"].includes(s.estado)) continue;

      items.push({
        id: `solicitud_por_decidir:${s.id}`,
        tipo: "solicitud_por_decidir",
        titulo: `Esperar respuesta de «${s.titulo}»`,
        contexto: `Solicitud #${s.folio} · ${s.estado.replace("_", " ")}`,
        modulo: "solicitudes",
        href: "/administrativo/solicitudes",
        creadoEn: new Date(s.creada),
        responsableId: usuario.id,
        esperandoA: s.responsable ?? (s.estado === "pendiente_direccion" ? "Dirección" : "Administración"),
        accion: { label: "Abrir", kind: "link" },
      });
    }

    // Verificación de forma: una acción que el servidor no reconoce nunca llega al botón.
    return items.filter((i) => !i.accion.action || esAccionSolicitud(i.accion.action.replace("solicitud:", "")) );
  },
};
