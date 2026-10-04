"use server";

import { revalidatePath, updateTag } from "next/cache";

import { registrar } from "@/lib/auditoria";
import { requerirRol } from "@/lib/auth";
import { consultar, consultarUna, enTransaccion } from "@/lib/db";
import { tienePermiso } from "@/lib/rbac";
import { TAG_LANDING } from "@/server/landing/consultas";

/**
 * Anuncios del hero de la portada, desde administración.
 *
 * Las cuatro acciones comparten la misma puerta: rol `admin` o `super_admin` y
 * permiso `landing.administrar`, que existe en la base desde la migración 0015 y
 * está asignado a esos dos roles. El rol se comprueba con `requerirRol` —que
 * redirige a quien no toca— y el permiso aparte, porque un rol puede perderlo y
 * la base es la autoridad, no esta lista.
 *
 * Todas devuelven estado en vez de lanzar: "ese anuncio ya no existe" es una
 * respuesta normal cuando dos personas editan la portada a la vez, no un fallo.
 *
 * Y todas tiran la caché pública con `updateTag`. Sin eso, publicar un anuncio
 * no se vería en la portada hasta cinco minutos después, que es lo que dura la
 * caché, y quien acaba de pulsar "Publicar" pensaría que no funcionó.
 *
 * Queda rastro en `audit_log`: la portada es lo único que ve cualquiera sin
 * cuenta, así que quién publicó qué y cuándo importa.
 */

export type EstadoAnuncio = {
  estado:
    | "inicial"
    | "ok"
    | "eliminado"
    | "no_permitido"
    | "no_encontrado"
    | "invalido"
    | "error";
  /** Qué campo hay que marcar en rojo cuando el estado es `invalido`. */
  campo?: "titulo" | "imagen" | "enlace";
};

/** Topes de longitud, para que un pegado accidental no rompa el hero. */
const LARGO = { titulo: 160, subtitulo: 80, texto: 400, cta: 40, url: 500 };

/**
 * Ruta interna o URL con TLS. Nada más.
 *
 * Sin esto, `cta_enlace` es texto libre que acaba en un `href` de la página
 * pública: `javascript:` en un enlace de la portada sería un XSS almacenado
 * servido a todo el que entra.
 */
function enlaceValido(valor: string): boolean {
  return valor.startsWith("/") || valor.startsWith("https://");
}

/** Un mismo formulario crea y edita: con `id` vacío, es un alta. */
export async function guardarAnuncio(
  _previo: EstadoAnuncio,
  datos: FormData,
): Promise<EstadoAnuncio> {
  const permiso = await comprobarPermiso();
  if (permiso) return permiso;

  const usuario = await requerirRol(["admin", "super_admin"]);

  const id = String(datos.get("id") ?? "").trim();
  const titulo = recortar(datos.get("titulo"), LARGO.titulo);
  const subtitulo = recortar(datos.get("subtitulo"), LARGO.subtitulo);
  const texto = recortar(datos.get("texto"), LARGO.texto);
  const imagen = recortar(datos.get("imagen"), LARGO.url);
  const ctaTexto = recortar(datos.get("cta_texto"), LARGO.cta);
  const ctaEnlace = recortar(datos.get("cta_enlace"), LARGO.url);

  if (!titulo) return { estado: "invalido", campo: "titulo" };
  if (imagen && !enlaceValido(imagen)) {
    return { estado: "invalido", campo: "imagen" };
  }
  if (ctaEnlace && !enlaceValido(ctaEnlace)) {
    return { estado: "invalido", campo: "enlace" };
  }

  if (id && !esUuid(id)) return { estado: "invalido" };

  try {
    if (id) {
      const editado = await consultarUna<{ id: string }>(
        `UPDATE landing_slide
            SET titulo = $2, subtitulo = $3, texto = $4,
                imagen_url = $5, cta_texto = $6, cta_enlace = $7
          WHERE id = $1
          RETURNING id`,
        [id, titulo, subtitulo, texto, imagen, ctaTexto, ctaEnlace],
      );

      if (!editado) return { estado: "no_encontrado" };

      await anotar(usuario.id, "anuncio.editado", editado.id, { titulo });
    } else {
      /*
       * Un alta entra al final y OCULTA. Publicar y que aparezca de golpe en la
       * portada, con la imagen todavía sin poner, es justo lo que no debe pasar:
       * se escribe, se mira la vista previa y se activa aparte.
       *
       * `orden` sale del máximo que haya, no del DEFAULT 0 de la tabla: con el
       * cero, cada anuncio nuevo se colaría delante de los demás.
       */
      const creado = await consultarUna<{ id: string }>(
        `INSERT INTO landing_slide
                (titulo, subtitulo, texto, imagen_url, cta_texto, cta_enlace, orden, activo)
         VALUES ($1, $2, $3, $4, $5, $6,
                 coalesce((SELECT max(orden) + 1 FROM landing_slide), 0), FALSE)
         RETURNING id`,
        [titulo, subtitulo, texto, imagen, ctaTexto, ctaEnlace],
      );

      if (!creado) return { estado: "error" };

      await anotar(usuario.id, "anuncio.creado", creado.id, { titulo });
    }
  } catch (error) {
    console.error("[landing] no se pudo guardar el anuncio", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/** Activa u oculta. El destino viaja en el formulario, no se deduce. */
export async function alternarAnuncio(
  _previo: EstadoAnuncio,
  datos: FormData,
): Promise<EstadoAnuncio> {
  const permiso = await comprobarPermiso();
  if (permiso) return permiso;

  const usuario = await requerirRol(["admin", "super_admin"]);

  const id = String(datos.get("id") ?? "");
  const activar = String(datos.get("activar") ?? "") === "1";

  if (!esUuid(id)) return { estado: "invalido" };

  try {
    /*
     * `activo <> $2` en el WHERE: si otra persona ya lo dejó en ese estado entre
     * que se pintó la pantalla y se pulsó el botón, esta escritura no encuentra
     * fila y se dice; no se sobreescribe su decisión en silencio.
     */
    const cambiado = await consultarUna<{ id: string }>(
      `UPDATE landing_slide
          SET activo = $2
        WHERE id = $1
          AND activo <> $2
        RETURNING id`,
      [id, activar],
    );

    if (!cambiado) return { estado: "no_encontrado" };

    await anotar(
      usuario.id,
      activar ? "anuncio.activado" : "anuncio.oculto",
      cambiado.id,
    );
  } catch (error) {
    console.error("[landing] no se pudo alternar el anuncio", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "ok" };
}

/**
 * Sube o baja un anuncio dentro de su grupo.
 *
 * Renumera antes de intercambiar, en la misma transacción. Hace falta porque
 * `orden` tiene DEFAULT 0 y cualquier fila creada por fuera del panel —el seed
 * de la 0015, una inserción a mano— puede compartir número con otra: sobre dos
 * ceros, un intercambio no cambia nada y el botón parecería roto.
 *
 * El grupo es el estado `activo`, que es como se ve la lista: mover un anuncio
 * oculto entre los visibles no significaría nada en la portada.
 */
export async function moverAnuncio(
  _previo: EstadoAnuncio,
  datos: FormData,
): Promise<EstadoAnuncio> {
  const permiso = await comprobarPermiso();
  if (permiso) return permiso;

  const usuario = await requerirRol(["admin", "super_admin"]);

  const id = String(datos.get("id") ?? "");
  const direccion = String(datos.get("direccion") ?? "");

  if (!esUuid(id) || (direccion !== "arriba" && direccion !== "abajo")) {
    return { estado: "invalido" };
  }

  try {
    const movido = await enTransaccion(async (cliente) => {
      const fila = await cliente.query<{ activo: boolean }>(
        "SELECT activo FROM landing_slide WHERE id = $1 FOR UPDATE",
        [id],
      );

      if (fila.rowCount === 0) return null;

      const hermanas = await cliente.query<{ id: string }>(
        `SELECT id FROM landing_slide
          WHERE activo = $1
          ORDER BY orden, created_at`,
        [fila.rows[0].activo],
      );

      const ids = hermanas.rows.map((h) => h.id);
      const desde = ids.indexOf(id);
      const hasta = direccion === "arriba" ? desde - 1 : desde + 1;

      // Ya está en el extremo: no es un error, simplemente no hay nada que hacer.
      if (hasta < 0 || hasta >= ids.length) return "sin_cambio";

      [ids[desde], ids[hasta]] = [ids[hasta], ids[desde]];

      // Un UPDATE con la posición nueva de cada id, en un solo viaje.
      await cliente.query(
        `UPDATE landing_slide AS s
            SET orden = nuevo.orden
           FROM (SELECT * FROM unnest($1::uuid[], $2::int[]) AS t(id, orden)) AS nuevo
          WHERE s.id = nuevo.id`,
        [ids, ids.map((_, indice) => indice)],
      );

      return "movido";
    });

    if (movido === null) return { estado: "no_encontrado" };

    if (movido === "movido") {
      await anotar(usuario.id, "anuncio.movido", id, { direccion });
      refrescar();
    }
  } catch (error) {
    console.error("[landing] no se pudo mover el anuncio", error);
    return { estado: "error" };
  }

  return { estado: "ok" };
}

/** Borra de verdad: para quitarlo de la portada sin perderlo está "Ocultar". */
export async function eliminarAnuncio(
  _previo: EstadoAnuncio,
  datos: FormData,
): Promise<EstadoAnuncio> {
  const permiso = await comprobarPermiso();
  if (permiso) return permiso;

  const usuario = await requerirRol(["admin", "super_admin"]);

  const id = String(datos.get("id") ?? "");

  if (!esUuid(id)) return { estado: "invalido" };

  try {
    const borrado = await consultarUna<{ id: string; titulo: string }>(
      "DELETE FROM landing_slide WHERE id = $1 RETURNING id, titulo",
      [id],
    );

    if (!borrado) return { estado: "no_encontrado" };

    // El título va al registro porque la fila ya no existe para consultarlo.
    await anotar(usuario.id, "anuncio.eliminado", borrado.id, {
      titulo: borrado.titulo,
    });
  } catch (error) {
    console.error("[landing] no se pudo eliminar el anuncio", error);
    return { estado: "error" };
  }

  refrescar();

  return { estado: "eliminado" };
}

/**
 * La puerta común de las cuatro acciones.
 *
 * Devuelve `null` cuando se puede pasar, para que quien llama haga
 * `if (permiso) return permiso;` y no se olvide de comprobarlo.
 */
async function comprobarPermiso(): Promise<EstadoAnuncio | null> {
  const usuario = await requerirRol(["admin", "super_admin"]);

  return tienePermiso(usuario.rol, "landing.administrar")
    ? null
    : { estado: "no_permitido" };
}

/** Texto de un campo del formulario: recortado, y `null` si queda vacío. */
function recortar(valor: FormDataEntryValue | null, tope: number): string | null {
  const texto = String(valor ?? "").trim().slice(0, tope);

  return texto === "" ? null : texto;
}

function anotar(
  usuarioId: string,
  accion: string,
  entidadId: string,
  extra?: Record<string, unknown>,
) {
  return registrar({
    usuarioId,
    accion,
    entidad: "landing_slide",
    entidadId,
    datos: extra,
  });
}

/**
 * Tira la caché pública y la pantalla del panel.
 *
 * La etiqueta es lo que de verdad importa: las consultas de la portada están
 * envueltas en `unstable_cache` con `TAG_LANDING`, y sin este aviso el cambio
 * tardaría en verse lo que dure su `revalidate`.
 *
 * `updateTag` y no `revalidateTag`: el primero es el que Next 16 reserva para
 * las acciones, y vacía la entrada al momento en lugar de marcarla como vieja
 * para la siguiente petición. Es la diferencia entre pulsar "Publicar" y verlo,
 * o pulsar y tener que recargar.
 */
function refrescar() {
  updateTag(TAG_LANDING);
  revalidatePath("/[locale]/configuracion/landing", "page");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
