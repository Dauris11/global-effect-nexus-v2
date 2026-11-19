"use server";

import { revalidatePath } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirUsuario } from "@/lib/auth";
import { consultarUna } from "@/lib/db";
import { subirAvatar } from "@/lib/supabase/almacen";

/**
 * El perfil propio. Cualquier rol, y solo el suyo.
 *
 * No hay parámetro de "de quién": el id sale de la sesión con
 * `requerirUsuario()`. Aceptarlo del formulario permitiría editar el perfil de
 * otra persona cambiando un campo oculto, y con él su foto y su presentación.
 *
 * Tampoco se toca el rol ni el correo. El rol lo asigna el super admin en
 * `/administrativo/personal`; poder cambiárselo uno mismo desde su propio perfil
 * sería una escalada de privilegios en un formulario. El correo es la identidad
 * con la que se entra, y cambiarlo aquí dejaría la fila y Supabase Auth
 * apuntando a sitios distintos.
 */

export type EstadoPerfil = {
  estado:
    | "inicial"
    | "ok"
    | "nombre_vacio"
    | "descripcion_larga"
    | "foto_invalida"
    | "foto_grande"
    | "error";
};

/** Lo mismo que impone el bucket: solo imágenes y 2 MB. */
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAXIMO_FOTO = 2 * 1024 * 1024;
const MAXIMO_DESCRIPCION = 280;

export async function guardarPerfil(
  _previo: EstadoPerfil,
  datos: FormData,
): Promise<EstadoPerfil> {
  const usuario = await requerirUsuario();

  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 120);
  const descripcion = String(datos.get("descripcion") ?? "").trim();
  const idioma = String(datos.get("idioma") ?? "");
  const foto = datos.get("foto");
  const fotoDataUrl = String(datos.get("foto_data_url") ?? "").trim();

  if (!nombre) return { estado: "nombre_vacio" };
  if (descripcion.length > MAXIMO_DESCRIPCION) {
    return { estado: "descripcion_larga" };
  }

  let rutaFoto: string | null = null;

  // 1. Si el cliente envió la versión normalizada en base64 (<= 360x360 JPEG),
  // la convertimos a File para subirla al bucket público `avatares` y, si el
  // bucket fallara, la conservamos como respaldo directo en base de datos.
  if (
    fotoDataUrl.startsWith("data:image/") &&
    fotoDataUrl.includes(";base64,") &&
    fotoDataUrl.length < 750_000
  ) {
    const [cabecera, cuerpoBase64] = fotoDataUrl.split(";base64,");
    const mime = cabecera.replace("data:", "");
    if (TIPOS_FOTO.includes(mime) && cuerpoBase64) {
      const bytes = Buffer.from(cuerpoBase64, "base64");
      const extension =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const archivoNormalizado = new File(
        [bytes],
        `${usuario.id}.${extension}`,
        { type: mime },
      );
      const subida = await subirAvatar(
        `${usuario.id}.${extension}`,
        archivoNormalizado,
      );
      rutaFoto = subida.ok
        ? `${subida.ruta}?v=${Date.now()}`
        : fotoDataUrl;
    }
  }

  // 2. Si no vino `foto_data_url` pero sí un `File` directo en el campo `foto`
  if (!rutaFoto && foto instanceof File && foto.size > 0) {
    if (!TIPOS_FOTO.includes(foto.type)) return { estado: "foto_invalida" };
    if (foto.size > MAXIMO_FOTO) return { estado: "foto_grande" };

    const extension =
      foto.type === "image/png"
        ? "png"
        : foto.type === "image/webp"
          ? "webp"
          : "jpg";
    const subida = await subirAvatar(`${usuario.id}.${extension}`, foto);

    if (!subida.ok) return { estado: "error" };

    rutaFoto = `${subida.ruta}?v=${Date.now()}`;
  }

  try {
    await consultarUna(
      `UPDATE usuario
          SET nombre = $2,
              descripcion = NULLIF($3, ''),
              idioma = CASE WHEN $4 IN ('es', 'en') THEN $4 ELSE idioma END,
              foto_url = coalesce($5, foto_url)
        WHERE id = $1
      RETURNING id`,
      [usuario.id, nombre, descripcion, idioma, rutaFoto],
    );

    if (rutaFoto) {
      await consultarUna(
        `UPDATE estudiante
            SET foto_url = $2
          WHERE usuario_id = $1
        RETURNING id`,
        [usuario.id, rutaFoto],
      );
    }
  } catch (error) {
    console.error("[perfil] no se pudo guardar", error);
    return { estado: "error" };
  }

  await registrar({
    usuarioId: usuario.id,
    accion: "perfil.editado",
    entidad: "usuario",
    entidadId: usuario.id,
    datos: { foto: rutaFoto !== null },
  });

  // El nombre y la foto salen en la barra lateral de todas las pantallas, así
  // que se refresca el armazón entero y no solo esta ruta.
  revalidatePath("/[locale]", "layout");

  return { estado: "ok" };
}
