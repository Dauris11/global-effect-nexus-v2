import { getLocale, getTranslations } from "next-intl/server";

import { Filas, Seccion } from "@/components/expedientes/detalle/ficha";
import { FAMILIA_FIJA } from "@/lib/expedientes";
import { fechaLarga } from "@/lib/fechas";
import type { ExpedienteCompleto } from "@/server/expedientes/consultas";

/**
 * Las fichas de LECTURA del expediente: todo lo que se sabe de la persona, por
 * tipo de información. Antes estos datos solo existían dentro del formulario de
 * edición, con los campos deshabilitados al final de una página larga.
 */

async function contexto() {
  const [t, idioma] = await Promise.all([getTranslations("records"), getLocale()]);

  return { t, idioma: (idioma === "en" ? "en" : "es") as "es" | "en" };
}

/** Un valor de lista cerrada, traducido si la clave existe. */
function enumerado(t: Awaited<ReturnType<typeof getTranslations>>, grupo: string, valor: string | null) {
  return valor ? (t.has(`${grupo}.${valor}`) ? t(`${grupo}.${valor}` as never) : valor) : null;
}

/** `tiempo`: «1 año y 8 meses» en la Fundación, ya redactado, o `null` sin fecha de ingreso. */
export async function FichaInformacion({ e, tiempo }: { e: ExpedienteCompleto; tiempo: string | null }) {
  const { t, idioma } = await contexto();

  return (
    <>
      <Seccion titulo={t("v2.sections.personal")}>
        <Filas
          filas={[
            { etiqueta: t("field.name"), valor: e.nombre },
            { etiqueta: t("field.idCard"), valor: e.cedula },
            { etiqueta: t("field.birthDate"), valor: e.fecha_nacimiento ? fechaLarga(e.fecha_nacimiento, idioma) : null },
            { etiqueta: t("field.birthPlace"), valor: e.lugar_nacimiento },
            { etiqueta: t("field.nationality"), valor: e.nacionalidad },
            { etiqueta: t("field.gender"), valor: enumerado(t, "gender", e.genero) },
            { etiqueta: t("field.sexDocument"), valor: e.sexo_documento },
            { etiqueta: t("field.religion"), valor: e.religion },
          ]}
        />
      </Seccion>

      <Seccion titulo={t("v2.sections.contact")}>
        <Filas
          filas={[
            { etiqueta: t("field.email"), valor: e.email },
            { etiqueta: t("field.phone"), valor: e.telefono },
            { etiqueta: t("field.address"), valor: [e.direccion, e.sector, e.comunidad, e.ciudad_residencia].filter(Boolean).join(", ") || null, largo: true },
          ]}
        />
      </Seccion>

      <Seccion titulo={t("v2.sections.studies")}>
        <Filas
          filas={[
            { etiqueta: t("field.entryDate"), valor: e.fecha_ingreso ? fechaLarga(e.fecha_ingreso, idioma) : null },
            { etiqueta: t("v2.tenureLabel"), valor: tiempo },
            { etiqueta: t("field.group"), valor: e.grupo ? String(e.grupo) : t("v2.noGroup") },
            { etiqueta: t("field.notes"), valor: e.notas_adicionales, largo: true },
          ]}
        />
      </Seccion>
    </>
  );
}

export async function FichaPerfil({ e }: { e: ExpedienteCompleto }) {
  const { t } = await contexto();

  return (
    <>
      <Seccion titulo={t("v2.sections.story")}>
        <Filas
          filas={[
            { etiqueta: t("field.lifeStory"), valor: e.historia_de_vida, largo: true },
            { etiqueta: t("field.familySituation"), valor: e.situacion_familiar, largo: true },
            { etiqueta: t("field.economicSituation"), valor: e.situacion_economica, largo: true },
            { etiqueta: t("field.scholarshipReason"), valor: e.motivo_beca, largo: true },
            { etiqueta: t("field.academicGoals"), valor: e.metas_academicas, largo: true },
          ]}
        />
      </Seccion>

      <Seccion titulo={t("v2.sections.habitudes")}>
        <Filas
          filas={[
            { etiqueta: t("field.school"), valor: e.centro_educativo },
            { etiqueta: t("field.schoolDirector"), valor: e.director_centro },
            { etiqueta: t("field.facilitator"), valor: e.facilitador_habitudes },
            { etiqueta: t("field.habitudesStory"), valor: e.breve_historia_habitudes, largo: true },
          ]}
        />
      </Seccion>
    </>
  );
}

export async function FichaFamilia({ e }: { e: ExpedienteCompleto }) {
  const { t } = await contexto();

  return (
    <>
      <Seccion titulo={t("v2.sections.family")}>
        <div className="space-y-5">
          {FAMILIA_FIJA.map((parentesco) => {
            const f = e.familiares[parentesco];

            return (
              <div key={parentesco} className="space-y-2">
                <p className="text-sm font-semibold">{t(`relation.${parentesco}`)}</p>
                <Filas
                  filas={[
                    { etiqueta: t("family.name"), valor: f?.nombre },
                    { etiqueta: t("family.age"), valor: f?.edad != null ? String(f.edad) : null },
                    { etiqueta: t("family.phone"), valor: f?.telefono },
                    { etiqueta: t("family.occupation"), valor: f?.profesion },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </Seccion>

      <Seccion titulo={t("v2.sections.housing")}>
        <Filas
          filas={[
            { etiqueta: t("field.livesWith"), valor: e.con_quien_vive },
            { etiqueta: t("field.whyLivesWith"), valor: e.por_que_vive_con_esa_persona, largo: true },
            { etiqueta: t("field.siblings"), valor: e.hermanos_cantidad != null ? String(e.hermanos_cantidad) : null },
            { etiqueta: t("field.ownHouse"), valor: enumerado(t, "house", e.casa_propia) },
            { etiqueta: t("field.houseType"), valor: e.tipo_casa },
            { etiqueta: t("field.bathroom"), valor: enumerado(t, "bathroom", e.bano_dentro) },
            { etiqueta: t("field.rooms"), valor: e.habitaciones != null ? String(e.habitaciones) : null },
            { etiqueta: t("field.beds"), valor: e.camas != null ? String(e.camas) : null },
            { etiqueta: t("field.whoSleeps"), valor: e.quienes_duermen_cama, largo: true },
          ]}
        />
      </Seccion>
    </>
  );
}

export async function FichaSalud({ e }: { e: ExpedienteCompleto }) {
  const { t } = await contexto();

  return (
    <Seccion titulo={t("v2.sections.health")}>
      <Filas
        filas={[
          { etiqueta: t("field.illnesses"), valor: e.enfermedades, largo: true },
          { etiqueta: t("field.allergies"), valor: e.alergias, largo: true },
          { etiqueta: t("field.emergencyName"), valor: e.contacto_emergencia_nombre },
          { etiqueta: t("field.emergencyPhone"), valor: e.contacto_emergencia_telefono },
        ]}
      />
    </Seccion>
  );
}
