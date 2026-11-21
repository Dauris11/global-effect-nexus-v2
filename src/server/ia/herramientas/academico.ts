import { filasDeLista } from "@/lib/carga-calificaciones";
import { consultarUna } from "@/lib/db";
import { leerEtiquetaPeriodo } from "@/lib/gradua";
import { ROLES } from "@/lib/rbac";
import { borrarAdjunto, obtenerAdjunto } from "@/server/ia/adjuntos";
import { leerComprobanteFiscal, leerDocumentoDeIdentidad } from "@/server/ia/ocr";
import { confirmarCarga, guardarBorrador, leerFilasDeArchivo, universidadDeCarga } from "@/server/universidades/carga-nucleo";

import type { Herramienta } from "./tipos";

/**
 * Herramientas de Elly para cargar calificaciones (equipo administrativo).
 *
 *  - `preparar_carga_calificaciones` solo deja un BORRADOR para revisar: no toca
 *    ningún expediente, por eso no pide aprobación.
 *  - `confirmar_carga_calificaciones` escribe las notas, así que se PROPONE y la
 *    persona la aprueba. Reutiliza `confirmarCarga`, la misma que el botón de la
 *    pantalla: por estudiante todo o nada, y devuelve las alertas por índice.
 *
 * El chat recibe adjuntos (PDF o foto): el archivo queda unos minutos en `ia_adjunto` y
 * las herramientas lo leen por id. Una carga también se puede preparar con una lista
 * pegada o desde `/academico/universidades/calificaciones`.
 *
 *  - `leer_documento_adjunto` pasa un adjunto por los lectores OCR del sistema (cédula,
 *    comprobante fiscal), que validan campo por campo; Elly explica qué se identificó y
 *    qué conviene verificar. Solo lee: no guarda nada.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMINISTRATIVOS = ["admin", "super_admin"] as const;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const frase = (es: string, en: string, idioma: "es" | "en") => (idioma === "en" ? en : es);

const preparar: Herramienta = {
  nombre: "preparar_carga_calificaciones",
  descripcion:
    "Prepara una carga de calificaciones de una universidad a partir de un ADJUNTO (PDF o foto: pasa su adjunto_id) o de una lista pegada (una fila por línea: matrícula ; nombre ; código ; letra ; nota). " +
    "NO guarda nada en los expedientes: deja un borrador que se revisa en pantalla y devuelve su enlace.",
  esquema: {
    type: "object",
    properties: {
      universidad: { type: "string", description: "Siglas de la universidad, p. ej. UCATECI." },
      periodo: { type: "string", description: "Año y ronda del cuatrimestre, p. ej. 2026-2." },
      adjunto_id: { type: "string", description: "UUID del adjunto del chat (PDF o foto con el listado). Opcional si se pasa la lista." },
      lista: { type: "string", description: "Las filas: matrícula ; nombre ; código ; letra ; nota (la nota es opcional). Opcional si se pasa el adjunto." },
    },
    required: ["universidad", "periodo"],
  },
  nivel: "automatica",
  roles: ADMINISTRATIVOS,
  permiso: "expedientes.escribir",
  resumir: (a, i) => frase(`Preparar la carga de calificaciones de ${texto(a.universidad, 20)}`, `Prepare the grades upload for ${texto(a.universidad, 20)}`, i),
  async ejecutar(usuario, a) {
    const periodo = leerEtiquetaPeriodo(texto(a.periodo, 10));
    const siglas = texto(a.universidad, 20).toUpperCase();

    if (!periodo || periodo.anio > new Date().getFullYear() + 1) return { ok: false, texto: "Período inválido: usa el formato 2026-2." };

    const uni = await consultarUna<{ id: string }>(`SELECT id FROM universidad WHERE upper(siglas) = $1 AND activa`, [siglas]);
    const universidad = uni ? await universidadDeCarga(uni.id) : null;

    if (!universidad) return { ok: false, texto: `No existe la universidad ${siglas}.` };

    const adjuntoId = texto(a.adjunto_id, 40);
    let filas = filasDeLista(texto(a.lista, 60_000));
    let medio: "pdf" | "imagen" | "lista" = "lista";

    if (adjuntoId) {
      if (!UUID_RE.test(adjuntoId)) return { ok: false, texto: "Identificador de adjunto inválido." };

      const adjunto = await obtenerAdjunto(usuario.id, adjuntoId);

      if (!adjunto) return { ok: false, texto: "El adjunto ya no está disponible (se guardan una hora). Pide que lo vuelvan a adjuntar." };

      const lectura = await leerFilasDeArchivo({ mime: adjunto.mime, base64: adjunto.bytes.toString("base64"), bytes: adjunto.bytes.length }, universidad);

      if (lectura.estado !== "ok") {
        return { ok: false, texto: lectura.estado === "sin_filas" ? "No se encontró ninguna calificación en el documento." : lectura.estado === "sin_clave" ? "La lectura con IA no está configurada." : "No se pudo leer el documento; sugiere una imagen más nítida o pegar la lista." };
      }

      filas = lectura.filas;
      medio = adjunto.mime === "application/pdf" ? "pdf" : "imagen";
    }

    if (filas.length === 0) return { ok: false, texto: "No se pudo leer ninguna fila: adjunta el listado o pega la lista." };

    const r = await guardarBorrador({ universidad, anio: periodo.anio, ronda: periodo.ronda, medio, filas, usuarioId: usuario.id });

    // Ya está leído y en el borrador: el archivo no se conserva.
    if (adjuntoId) await borrarAdjunto(usuario.id, adjuntoId);

    return {
      ok: true,
      texto:
        `Borrador listo: ${r.filas} filas de ${r.estudiantes} estudiantes; ${r.sinEmparejar} sin emparejar y ${r.conProblemas} con algo por revisar. ` +
        `Se revisa en /academico/universidades/calificaciones/${r.cargaId}. Si la persona quiere guardarlas, propón confirmar_carga_calificaciones con carga_id ${r.cargaId}.`,
      entidad: { tipo: "carga_calificaciones", id: r.cargaId },
    };
  },
};

const confirmar: Herramienta = {
  nombre: "confirmar_carga_calificaciones",
  descripcion:
    "Propone guardar en los expedientes las calificaciones de una carga ya preparada. Solo se escribe cuando la persona aprueba. " +
    "Por estudiante es todo o nada: quien tenga filas por revisar no se guarda. Devuelve las alertas por índice del período y acumulado.",
  esquema: {
    type: "object",
    properties: { carga_id: { type: "string", description: "UUID de la carga preparada." } },
    required: ["carga_id"],
  },
  nivel: "confirmacion",
  roles: ADMINISTRATIVOS,
  permiso: "expedientes.escribir",
  resumir: (a, i) => frase(`Guardar las calificaciones de la carga ${texto(a.carga_id, 8)}…`, `Save the grades of upload ${texto(a.carga_id, 8)}…`, i),
  async ejecutar(usuario, a) {
    const id = texto(a.carga_id, 40);

    if (!UUID_RE.test(id)) return { ok: false, texto: "Identificador de carga inválido." };

    const r = await confirmarCarga(id, usuario.id);

    if (r.estado !== "ok") return { ok: false, texto: r.estado === "no_encontrada" ? "La carga no existe o ya se cerró." : "No se pudo guardar la carga." };

    const alertas = r.alertas.map((x) => `${x.nombre}: ${x.tipo === "periodo" ? "índice del período" : "índice acumulado"} ${x.indice.toFixed(2)} < ${x.umbral.toFixed(2)}`);

    return {
      ok: true,
      texto:
        `Guardadas ${r.notasEscritas} notas de ${r.estudiantesEscritos} estudiantes; ${r.estudiantesOmitidos} estudiantes omitidos por filas por revisar y ${r.filasSinEstudiante} filas sin estudiante.` +
        (alertas.length ? ` Alertas: ${alertas.join("; ")}.` : " Nadie quedó por debajo de los mínimos."),
      entidad: { tipo: "carga_calificaciones", id },
    };
  },
};

const leerAdjunto: Herramienta = {
  nombre: "leer_documento_adjunto",
  descripcion:
    "Lee un adjunto del chat con los lectores OCR del sistema y devuelve los campos ya validados, cada uno con su certeza. tipo: \"identidad\" (cédula o documento de identidad) o \"comprobante_fiscal\" (factura o comprobante). " +
    "Solo lee: no guarda nada. Explica a la persona qué se identificó y qué conviene verificar a mano.",
  esquema: {
    type: "object",
    properties: {
      adjunto_id: { type: "string", description: "UUID del adjunto del chat." },
      tipo: { type: "string", enum: ["identidad", "comprobante_fiscal"] },
    },
    required: ["adjunto_id", "tipo"],
  },
  nivel: "automatica",
  roles: ROLES.filter((r) => r !== "estudiante"),
  resumir: (a, i) => frase(`Leer el documento adjunto (${texto(a.tipo, 20)})`, `Read the attached document (${texto(a.tipo, 20)})`, i),
  async ejecutar(usuario, a) {
    const id = texto(a.adjunto_id, 40);
    const tipo = texto(a.tipo, 20);

    if (!UUID_RE.test(id)) return { ok: false, texto: "Identificador de adjunto inválido." };
    if (tipo !== "identidad" && tipo !== "comprobante_fiscal") return { ok: false, texto: "Tipo no válido: identidad o comprobante_fiscal." };

    const adjunto = await obtenerAdjunto(usuario.id, id);

    if (!adjunto) return { ok: false, texto: "El adjunto ya no está disponible (se guardan una hora). Pide que lo vuelvan a adjuntar." };

    const archivo = new File([new Uint8Array(adjunto.bytes)], adjunto.nombre, { type: adjunto.mime });
    const r = tipo === "identidad" ? await leerDocumentoDeIdentidad(archivo, usuario.id) : await leerComprobanteFiscal(archivo, usuario.id);

    if (r.estado !== "ok") {
      return { ok: false, texto: r.estado === "sin_clave" ? "La lectura con IA no está configurada." : r.estado === "ilegible" ? "No se pudo leer el documento; sugiere una imagen más nítida." : "No se pudo leer el documento." };
    }

    return { ok: true, texto: `Campos leídos (null = no se vio; confianza 0-100 es la certeza del modelo, no una garantía): ${JSON.stringify(r.datos)}` };
  },
};

export const HERRAMIENTAS_ACADEMICAS: readonly Herramienta[] = [preparar, confirmar, leerAdjunto];
