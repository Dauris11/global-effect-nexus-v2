import { NextRequest, NextResponse } from "next/server";

import { obtenerUsuarioActual } from "@/lib/auth";
import { FUNCION_ASISTENTE } from "@/lib/nav";
import { MAXIMO_CARACTERES_PREGUNTA } from "@/lib/ia";
import { ensamblarSistema, revisarEntrada } from "@/lib/ia-seguridad";
import {
  configDelAgente,
  miConsumo,
  registrarUso,
  verificarAcceso,
} from "@/server/ia/agente";
import { guardarAdjunto } from "@/server/ia/adjuntos";
import { prepararTurno } from "@/server/ia/contexto";
import { visibilidadDeRol } from "@/server/visibilidad/consultas";
import type { EventoFlujo } from "@/lib/ia-eventos";
import { ejecutarTurno, proveedorModelo } from "@/server/ia/motor";
import { modeloIA } from "@/lib/modelo-ia";

/**
 * Chat del asistente con respuesta en vivo.
 *
 * Responde con líneas JSON (una por evento, ver `EventoTurno`): el texto llega
 * a medida que el modelo lo escribe, los pasos de herramienta se anuncian
 * mientras corren y una escritura propuesta llega como tarjeta de aprobación.
 *
 * El agente lo decide el servidor con el rol de la sesión (`configDelAgente`);
 * el cuerpo de la petición solo trae el texto, nunca un agente ni un rol.
 */

const MAXIMO_TOKENS = 4096;

export const maxDuration = 60;

/**
 * Qué está viendo la persona, para que Elly pueda trabajar sobre esa pantalla («ponle
 * estas notas» en el expediente de alguien). Solo se acepta una ruta con forma de ruta:
 * el valor llega del navegador y es dato, nunca instrucción.
 */
function pantallaActual(ruta: string): string {
  if (!/^\/[\w\-/.]{0,200}$/.test(ruta)) return "";

  const limpia = ruta.replace(/^\/(es|en)(?=\/|$)/, "") || "/";
  const estudiante = /^\/expedientes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(limpia)?.[1];

  return `\n\nPANTALLA ACTUAL de la persona: ${limpia}.${estudiante ? ` Está viendo el expediente del estudiante con id ${estudiante}: si pide notas o materias «de este estudiante», usa ese id sin preguntárselo.` : ""}`;
}

export async function POST(peticion: NextRequest) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) return new NextResponse("No autorizado", { status: 401 });

  // Texto solo (JSON) o texto con un adjunto (multipart: `contenido` + `adjunto`).
  let crudo = "";
  let archivo: File | null = null;
  let ruta = "";

  if ((peticion.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const datos = await peticion.formData().catch(() => null);
    const adjunto = datos?.get("adjunto");

    crudo = String(datos?.get("contenido") ?? "").trim();
    ruta = String(datos?.get("ruta") ?? "");
    archivo = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  } else {
    const cuerpo = (await peticion.json().catch(() => null)) as { contenido?: unknown; ruta?: unknown } | null;

    ruta = typeof cuerpo?.ruta === "string" ? cuerpo.ruta : "";

    crudo = typeof cuerpo?.contenido === "string" ? cuerpo.contenido.trim() : "";
  }

  // Los adjuntos son del equipo: el estudiante no sube documentos al asistente.
  if (archivo && usuario.rol === "estudiante") return NextResponse.json({ error: "adjuntoNoPermitido" }, { status: 403 });

  // Un adjunto sin texto es una petición válida: «mira esto».
  if (!crudo && archivo) crudo = usuario.idioma === "en" ? "Review this document." : "Revisa este documento.";

  if (!crudo) return NextResponse.json({ error: "mensajeVacio" }, { status: 400 });

  if (crudo.length > MAXIMO_CARACTERES_PREGUNTA) {
    return NextResponse.json({ error: "mensajeLargo" }, { status: 400 });
  }

  // Código, JSON, etiquetas, marcadores de rol u órdenes a la IA: se rechaza
  // antes de gastar una llamada. Es la primera capa, no la única (ver
  // `ia-seguridad.ts`).
  const revision = revisarEntrada(crudo);

  if (!revision.ok) {
    return NextResponse.json({ error: "entradaInvalida", motivo: revision.motivo }, { status: 400 });
  }

  let contenido = revision.texto;

  // El administrador maestro puede BLOQUEAR el asistente para un rol: sin botón
  // y también sin la ruta, que es lo que usaría quien armara la petición a mano.
  if (usuario.rol !== "super_admin") {
    const visibilidad = await visibilidadDeRol(usuario.rol);

    if (visibilidad.bloqueadas.has(FUNCION_ASISTENTE)) {
      return NextResponse.json({ error: "inactivo" }, { status: 403 });
    }
  }

  const config = await configDelAgente(usuario.rol);
  const acceso = await verificarAcceso(usuario, config);

  if (acceso !== "ok") {
    const codigo = acceso === "cuota" ? "cuota" : acceso === "limite" ? "limite" : "inactivo";

    return NextResponse.json({ error: codigo }, { status: 429 });
  }

  const proveedor = proveedorModelo();

  if (!proveedor) return NextResponse.json({ error: "sin_clave" }, { status: 503 });

  // El archivo se comprueba (tipo, tamaño y firma real) y se guarda unos minutos: el modelo lo ve
  // en este turno y las herramientas lo leen después por id.
  let documento: { mime: string; base64: string } | null = null;

  if (archivo) {
    const guardado = await guardarAdjunto(usuario.id, archivo);

    if (guardado.estado !== "ok") return NextResponse.json({ error: "adjuntoInvalido", motivo: guardado.estado }, { status: 400 });

    documento = { mime: guardado.adjunto.mime, base64: guardado.base64 };
    contenido += `\n\n[Adjunto: «${guardado.adjunto.nombre}» · id ${guardado.adjunto.id} · ${guardado.adjunto.mime}]`;
  }

  const turno = await prepararTurno(usuario, contenido);

  if ("error" in turno) return NextResponse.json({ error: turno.error }, { status: 409 });

  const codificador = new TextEncoder();

  const flujo = new ReadableStream({
    async start(controlador) {
      const emitir = (evento: EventoFlujo) =>
        controlador.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`));

      try {
        const resultado = await ejecutarTurno({
          proveedor,
          usuario,
          idioma: usuario.idioma,
          agente: config.clave,
          conversacionId: turno.conversacionId,
          sistema: ensamblarSistema(`${turno.sistema}${pantallaActual(ruta)}`, config.instrucciones),
          turnos: turno.turnos,
          documento,
          // Un modelo guardado de otro proveedor se ignora (ver `modeloIA`).
          modelo: modeloIA(config.modelo),
          maximoTokens: config.maximoTokens ?? MAXIMO_TOKENS,
          emitir,
        });

        if ("error" in resultado) {
          emitir({ t: "error", codigo: resultado.error });
        } else {
          const conversacionId = await turno.guardar(
            resultado.texto || "—",
            resultado.uso.salida,
          );

          await registrarUso(usuario, config.clave, conversacionId, resultado.uso).catch((e) =>
            console.error("[ia] no se pudo registrar el uso", e),
          );

          const consumo = await miConsumo(usuario);

          emitir({
            t: "fin",
            texto: resultado.texto,
            entrada: resultado.uso.entrada,
            salida: resultado.uso.salida,
          });
          emitir({ t: "consumo", usados: consumo.usados, tope: consumo.tope, aviso: consumo.aviso });
        }
      } catch (error) {
        console.error("[ia] fallo en el turno", error);
        emitir({ t: "error", codigo: "fallo" });
      } finally {
        controlador.close();
      }
    },
  });

  return new Response(flujo, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
