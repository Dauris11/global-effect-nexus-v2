import sharp from "sharp";

import { FAMILIA_FIJA } from "@/lib/expedientes";
import { fechaLarga } from "@/lib/fechas";
import { urlDeAvatar } from "@/lib/supabase/almacen";
import { indiceDelEstudiante } from "@/server/academico/indice";
import { obtenerExpediente } from "@/server/expedientes/consultas";
import { seguimientoDelEstudiante } from "@/server/expedientes/seguimiento";
import { catalogoDelEstudiante, recordNativoDelEstudiante } from "@/server/universidades/consultas";

import { traducir } from "../traducir";
import { nombreSeguro, type Bloque, type Documento } from "../documento";

const nota = (n: number | null) => (n === null ? "—" : n.toFixed(2));

/** La foto del expediente en JPEG pequeño, o `null` si no tiene o no se puede leer. */
async function fotoDe(ruta: string | null): Promise<Buffer | null> {
  const url = urlDeAvatar(ruta);

  if (!url) return null;

  try {
    const res = await fetch(url);

    if (!res.ok) return null;

    return await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize({ width: 260, height: 330, fit: "cover", position: "top" }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

/** Ficha completa del estudiante con su foto: todo lo que se sabe de la persona, por secciones. */
export async function documentoFicha(id: string): Promise<Documento | null> {
  const e = await obtenerExpediente(id);

  if (!e) return null;

  const [t, catalogo, seg, foto] = await Promise.all([traducir("records"), catalogoDelEstudiante(id), seguimientoDelEstudiante(id), fotoDe(e.foto_url)]);
  const enumerado = (grupo: string, v: string | null) => (v ? (t.has(`${grupo}.${v}` as never) ? t(`${grupo}.${v}` as never) : v) : null);
  const fecha = (v: string | null) => (v ? fechaLarga(v, "es") : null);
  const direccion = [e.direccion, e.sector, e.comunidad, e.ciudad_residencia].filter(Boolean).join(", ") || null;
  const patrocinador = seg.asignaciones.find((a) => a.activa);

  const bloques: Bloque[] = [
    { tipo: "seccion", titulo: t("v2.sections.personal") },
    { tipo: "datos", filas: [[t("field.name"), e.nombre], [t("field.idCard"), e.cedula], [t("field.birthDate"), fecha(e.fecha_nacimiento)], [t("field.birthPlace"), e.lugar_nacimiento], [t("field.nationality"), e.nacionalidad], [t("field.gender"), enumerado("gender", e.genero)], [t("field.religion"), e.religion]] },
    { tipo: "seccion", titulo: t("v2.sections.contact") },
    { tipo: "datos", filas: [[t("field.email"), e.email], [t("field.phone"), e.telefono], [t("field.address"), direccion], [t("field.emergencyName"), e.contacto_emergencia_nombre], [t("field.emergencyPhone"), e.contacto_emergencia_telefono]] },
    { tipo: "seccion", titulo: t("v2.sections.studies") },
    {
      tipo: "datos",
      filas: [
        ["Situación en la Fundación", t(`status.${e.estado}` as never)],
        ["Universidad", catalogo.universidad?.nombre ?? e.universidad],
        ["Carrera", catalogo.carrera?.nombre ?? e.programa],
        ["Plan de estudios", catalogo.pensum ? `versión ${catalogo.pensum.version}` : null],
        ["Matrícula", catalogo.matricula],
        [t("field.entryDate"), fecha(e.fecha_ingreso)],
        [t("field.group"), e.grupo ? String(e.grupo) : null],
        ["Patrocinador", patrocinador?.patrocinador ?? null],
      ],
    },
    { tipo: "seccion", titulo: t("v2.sections.story") },
    { tipo: "datos", filas: [[t("field.lifeStory"), e.historia_de_vida], [t("field.familySituation"), e.situacion_familiar], [t("field.economicSituation"), e.situacion_economica], [t("field.scholarshipReason"), e.motivo_beca], [t("field.academicGoals"), e.metas_academicas]] },
    { tipo: "seccion", titulo: t("v2.sections.habitudes") },
    { tipo: "datos", filas: [[t("field.school"), e.centro_educativo], [t("field.schoolDirector"), e.director_centro], [t("field.facilitator"), e.facilitador_habitudes], [t("field.habitudesStory"), e.breve_historia_habitudes]] },
    { tipo: "seccion", titulo: t("v2.sections.family") },
    {
      tipo: "tabla",
      nombreHoja: "Familia",
      columnas: ["Parentesco", t("family.name"), t("family.age"), t("family.phone"), t("family.occupation")],
      filas: FAMILIA_FIJA.map((p) => {
        const f = e.familiares[p];

        return [t(`relation.${p}` as never), f?.nombre, f?.edad, f?.telefono, f?.profesion];
      }),
    },
    { tipo: "seccion", titulo: t("v2.sections.housing") },
    { tipo: "datos", filas: [[t("field.livesWith"), e.con_quien_vive], [t("field.siblings"), e.hermanos_cantidad], [t("field.ownHouse"), enumerado("house", e.casa_propia)], [t("field.houseType"), e.tipo_casa], [t("field.bathroom"), enumerado("bathroom", e.bano_dentro)], [t("field.rooms"), e.habitaciones], [t("field.beds"), e.camas], [t("field.whoSleeps"), e.quienes_duermen_cama]] },
    { tipo: "seccion", titulo: t("v2.sections.health") },
    { tipo: "datos", filas: [[t("field.illnesses"), e.enfermedades], [t("field.allergies"), e.alergias]] },
  ];

  if (e.amonestaciones || e.notas_adicionales) {
    bloques.push({ tipo: "seccion", titulo: t("v2.followUp.notes") }, { tipo: "datos", filas: [[t("field.warnings"), e.amonestaciones], [t("field.notes"), e.notas_adicionales]] });
  }

  return {
    titulo: `Expediente de ${e.nombre}`,
    subtitulo: [t(`status.${e.estado}` as never), catalogo.universidad?.siglas, catalogo.carrera?.nombre].filter(Boolean).join(" · "),
    foto,
    bloques,
    nombreArchivo: `expediente-${nombreSeguro(e.nombre)}`,
  };
}

/** Récord de notas: cada cuatrimestre con sus materias, el índice del período y el acumulado. */
export async function documentoRecord(id: string): Promise<Documento | null> {
  const e = await obtenerExpediente(id);

  if (!e) return null;

  const [catalogo, record, indice] = await Promise.all([catalogoDelEstudiante(id), recordNativoDelEstudiante(id), indiceDelEstudiante(id)]);
  const bloques: Bloque[] = [
    {
      tipo: "datos",
      filas: [["Estudiante", e.nombre], ["Cédula", e.cedula], ["Universidad", catalogo.universidad?.nombre], ["Carrera", catalogo.carrera?.nombre], ["Matrícula", catalogo.matricula], ["Índice acumulado", nota(indice)], ["Créditos aprobados", `${catalogo.creditosAprobados} de ${catalogo.creditosTotales}`]],
    },
  ];

  if (!record) bloques.push({ tipo: "parrafo", texto: "Todavía no hay notas registradas para este estudiante." });
  else {
    // Del más antiguo al más reciente: así se lee un récord.
    for (const p of [...record.periodos].reverse()) {
      bloques.push(
        { tipo: "seccion", titulo: `${p.periodo} · índice del período ${nota(p.indice)} · ${p.creditos} créditos` },
        { tipo: "tabla", nombreHoja: p.periodo, columnas: ["Código", "Materia", "Créditos", "Nota", "Letra"], alinear: ["l", "l", "r", "r", "c"], anchos: [10, 52, 8, 8, 8], filas: p.intentos.map((i) => [i.codigo, i.nombre, i.creditos, i.nota, i.letra]) },
      );
    }
  }

  return { titulo: `Récord de notas — ${e.nombre}`, subtitulo: [catalogo.universidad?.siglas, catalogo.carrera?.nombre].filter(Boolean).join(" · "), bloques, nombreArchivo: `record-${nombreSeguro(e.nombre)}` };
}

/** Avance en el plan de estudios: cada materia del plan con su estado, por cuatrimestre. */
export async function documentoAvance(id: string): Promise<Documento | null> {
  const e = await obtenerExpediente(id);

  if (!e) return null;

  const [catalogo, indice] = await Promise.all([catalogoDelEstudiante(id), indiceDelEstudiante(id)]);
  const estados: Record<string, string> = { aprobada: "Aprobada", reprobada: "Reprobada", retirada: "Retirada", cursando: "Cursando", pendiente: "Pendiente" };
  const bloques: Bloque[] = [
    {
      tipo: "datos",
      filas: [["Estudiante", e.nombre], ["Universidad", catalogo.universidad?.nombre], ["Carrera", catalogo.carrera?.nombre], ["Plan de estudios", catalogo.pensum ? `versión ${catalogo.pensum.version}` : null], ["Créditos aprobados", `${catalogo.creditosAprobados} de ${catalogo.creditosTotales}${catalogo.creditosTotales ? ` (${Math.round((catalogo.creditosAprobados / catalogo.creditosTotales) * 100)} %)` : ""}`], ["Índice acumulado", nota(indice)]],
    },
  ];

  if (!catalogo.pensum) bloques.push({ tipo: "parrafo", texto: "Todavía no tiene plan de estudios asignado." });
  else {
    bloques.push({
      tipo: "tabla",
      nombreHoja: "Avance",
      columnas: ["Cuat.", "Código", "Materia", "Créditos", "Letra", "Estado"],
      alinear: ["c", "l", "l", "r", "c", "l"],
      anchos: [6, 11, 46, 8, 7, 12],
      filas: [...catalogo.materias].sort((a, b) => (a.periodo_sugerido ?? 99) - (b.periodo_sugerido ?? 99) || a.codigo.localeCompare(b.codigo)).map((m) => [m.periodo_sugerido, m.codigo, m.nombre, m.creditos, m.letra, estados[m.estado] ?? m.estado]),
    });
  }

  return { titulo: `Avance en el plan de estudios — ${e.nombre}`, subtitulo: [catalogo.universidad?.siglas, catalogo.carrera?.nombre].filter(Boolean).join(" · "), bloques, nombreArchivo: `avance-${nombreSeguro(e.nombre)}` };
}
