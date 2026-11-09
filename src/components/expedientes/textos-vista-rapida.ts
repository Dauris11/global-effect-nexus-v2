import type { getTranslations } from "next-intl/server";

import type { FilaExpediente } from "@/server/expedientes/consultas";

/**
 * Los textos de `PrevisualizarExpediente`, iguales en las dos vistas. Se
 * resuelven en el servidor porque la vista rápida es un componente cliente y
 * la lista no.
 */
export function textosVistaRapida(
  fila: FilaExpediente,
  t: Awaited<ReturnType<typeof getTranslations<"records">>>,
) {
  return {
    preview: t("rowActions.preview"),
    idCard: t("field.idCard"),
    email: t("field.email"),
    phone: t("field.phone"),
    program: t("field.program"),
    university: t("field.university"),
    since: t("detail.since"),
    gpa: t("detail.gpa"),
    gpaScale: t("detail.gpaScale"),
    noGpa: t("noGpa"),
    status: t(`status.${fila.estado}` as "status.activo"),
    optional: t("field.optional"),
    edit: t("rowActions.edit"),
    viewFull: t("rowActions.viewFull"),
    sinFoto: t("sinFoto"),
  };
}
