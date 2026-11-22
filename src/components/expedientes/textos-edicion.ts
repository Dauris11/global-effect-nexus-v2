import type { getTranslations } from "next-intl/server";

import {
  ASISTIO_REUNION,
  BANO,
  CASA_PROPIA,
  ENVIO_CORREO,
  ESTADOS_ESTUDIANTE,
  GENEROS,
  PARENTESCOS,
} from "@/lib/expedientes";

/**
 * Todos los textos del formulario de edición del expediente. Vivían dentro de la
 * página de detalle y la llevaban a casi 400 líneas; aquí se arman una vez.
 */

const SECCIONES = ["identity", "academic", "family", "housing", "health", "social"] as const;

type Traductor = Awaited<ReturnType<typeof getTranslations>>;

export function textosEdicion(t: Traductor) {
  return {
    nuevo: t("new"),
    titulo: t("form.titleEdit"),
    guardar: t("form.saveEdit"),
    guardando: t("form.saving"),
    faltaNombre: t("form.faltaNombreSeccion"),
    cancelar: t("form.cancel"),
    opcional: t("field.optional"),
    savedEdit: t("form.savedEdit"),
    notOwner: t("form.notOwner"),
    verExpediente: t("rowActions.view"),
    editarExpediente: t("rowActions.edit"),
    readOnlyNote: t("form.readOnlyNote"),
    photoInvalid: t("form.photoInvalid"),
    photoTooLarge: t("form.photoTooLarge"),
    error: t("form.error"),
    pestanas: Object.fromEntries(
      SECCIONES.map((clave) => [clave, t(`tab.${clave}`)]),
    ),
    campos: {
      name: t("field.name"),
      idCard: t("field.idCard"),
      email: t("field.email"),
      phone: t("field.phone"),
      birthDate: t("field.birthDate"),
      birthPlace: t("field.birthPlace"),
      nationality: t("field.nationality"),
      gender: t("field.gender"),
      sexDocument: t("field.sexDocument"),
      religion: t("field.religion"),
      photo: t("field.photo"),
      photoHint: t("field.photoHint"),
      status: t("field.status"),
      program: t("field.program"),
      whereStudies: t("field.whereStudies"),
      university: t("field.university"),
      entryDate: t("field.entryDate"),
      group: t("field.group"),
      school: t("field.school"),
      schoolDirector: t("field.schoolDirector"),
      facilitator: t("field.facilitator"),
      habitudesStory: t("field.habitudesStory"),
      livesWith: t("field.livesWith"),
      whyLivesWith: t("field.whyLivesWith"),
      siblings: t("field.siblings"),
      ownHouse: t("field.ownHouse"),
      houseType: t("field.houseType"),
      bathroom: t("field.bathroom"),
      rooms: t("field.rooms"),
      beds: t("field.beds"),
      whoSleeps: t("field.whoSleeps"),
      address: t("field.address"),
      community: t("field.community"),
      city: t("field.city"),
      illnesses: t("field.illnesses"),
      allergies: t("field.allergies"),
      emergencyName: t("field.emergencyName"),
      emergencyPhone: t("field.emergencyPhone"),
      lifeStory: t("field.lifeStory"),
      familySituation: t("field.familySituation"),
      economicSituation: t("field.economicSituation"),
      scholarshipReason: t("field.scholarshipReason"),
      academicGoals: t("field.academicGoals"),
      sponsorEmail: t("field.sponsorEmail"),
      monthlyMeeting: t("field.monthlyMeeting"),
      warnings: t("field.warnings"),
      pendingRequests: t("field.pendingRequests"),
      notes: t("field.notes"),
    },
    familia: {
      name: t("family.name"),
      age: t("family.age"),
      phone: t("family.phone"),
      occupation: t("family.occupation"),
      emptyHint: t("family.emptyHint"),
    },
    parentescos: Object.fromEntries(
      PARENTESCOS.map((clave) => [clave, t(`relation.${clave}`)]),
    ),
    estados: Object.fromEntries(
      ESTADOS_ESTUDIANTE.map((clave) => [clave, t(`status.${clave}`)]),
    ),
    generos: Object.fromEntries(
      GENEROS.map((clave) => [clave, t(`gender.${clave}`)]),
    ),
    casa: Object.fromEntries(
      CASA_PROPIA.map((clave) => [clave, t(`house.${clave}`)]),
    ),
    bano: Object.fromEntries(
      BANO.map((clave) => [clave, t(`bathroom.${clave}`)]),
    ),
    seguimiento: Object.fromEntries(
      [...new Set([...ENVIO_CORREO, ...ASISTIO_REUNION])].map((clave) => [
        clave,
        t(`followUp.${clave}`),
      ]),
    ),

  };
}

/** Textos de los desplegables de universidad, carrera y pénsum (espacio `catalog`). */
export function textosCatalogo(t: (clave: string, valores?: Record<string, string>) => string) {
  return {
    university: t("link.university"),
    career: t("link.career"),
    pensum: t("link.pensum"),
    matricula: t("link.matricula"),
    none: t("link.none"),
    legacy: t("link.legacy", { text: "{text}" }),
    plan: t("pensum.versionLabel", { version: "{version}" }),
    previous: t("pensum.old"),
    invalid: t("link.invalid"),
    incompleteActive: t("link.incompleteActive"),
  };
}
