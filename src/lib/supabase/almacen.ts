/**
 * Subidas a Supabase Storage, desde el servidor.
 *
 * Por REST y con la clave de servicio, igual que la API de cuentas: así la
 * subida no depende de que el navegador tenga una sesión válida en Storage, y
 * las reglas de qué se admite se comprueban en el servidor y no en el cliente,
 * donde se pueden saltar.
 *
 * NUNCA importar desde un componente cliente: usa `SUPABASE_SECRET_KEY`.
 */

/** Fotos de perfil. Público: un estudiante ve la foto de quien lleva su trámite. */
const AVATARES = "avatares";

/**
 * Documentos: entregas de tareas y fichas escaneadas del expediente.
 *
 * PRIVADO, y no es un detalle. Aquí acaba el trabajo de menores de edad y las
 * fichas de sus expedientes: un bucket público significaría que cualquiera con
 * la URL —o que la adivine— lo descarga sin sesión. Se sirve con enlaces
 * firmados y de vida corta.
 */
const DOCUMENTOS = "documentos";

function credenciales() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreto = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secreto) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY para subir archivos.");
  }

  return { url, secreto };
}

/**
 * El POST a Storage, uno para las tres subidas de arriba.
 *
 * Estaba escrito tres veces con la misma cabecera y el mismo manejo de error, y
 * repetido es como una de las tres se queda sin el `x-upsert` que necesita o
 * sin el `console.error` que dice por qué falló.
 *
 * `upsert` no es un detalle de rendimiento: con la foto de perfil y con la
 * entrega la ruta la manda el id de la fila, así que subir de nuevo tiene que
 * SUSTITUIR; un material de academia, en cambio, estrena ruta cada vez y no
 * debe poder pisar a otro.
 */
async function subir(
  bucket: string,
  ruta: string,
  archivo: File,
  upsert: boolean,
): Promise<{ ok: true; ruta: string } | { ok: false }> {
  const { url, secreto } = credenciales();

  const res = await fetch(`${url}/storage/v1/object/${bucket}/${ruta}`, {
    method: "POST",
    headers: {
      apikey: secreto,
      Authorization: `Bearer ${secreto}`,
      "Content-Type": archivo.type,
      "x-upsert": upsert ? "true" : "false",
    },
    body: await archivo.arrayBuffer(),
  });

  if (!res.ok) {
    console.error(
      `[almacen] no se pudo subir a ${bucket}:`,
      res.status,
      await res.text(),
    );
    return { ok: false };
  }

  return { ok: true, ruta };
}

/**
 * Sube (o reemplaza) la foto de perfil y devuelve su ruta dentro del bucket.
 *
 * `x-upsert: true` porque el nombre del archivo es el id de la cuenta: subir una
 * foto nueva sustituye la anterior en lugar de dejar basura acumulada. Se guarda
 * la RUTA y no la URL completa: el host cambia si el proyecto se recrea, y una
 * URL guardada quedaría muerta.
 */
export async function subirAvatar(
  ruta: string,
  archivo: File,
): Promise<{ ok: true; ruta: string } | { ok: false }> {
  return subir(AVATARES, ruta, archivo, true);
}

/**
 * URL pública de una foto de perfil.
 *
 * Se construye al mostrar y no se guarda, por lo dicho arriba. Devuelve `null`
 * si la cuenta no tiene foto, para que quien la use dibuje la inicial.
 */
export function urlDeAvatar(ruta: string | null): string | null {
  if (!ruta) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return base ? `${base}/storage/v1/object/public/${AVATARES}/${ruta}` : null;
}

/** Lo que se admite como entrega. Se vuelve a comprobar en el servidor. */
export const TIPOS_ENTREGA = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const MAXIMO_ENTREGA = 10 * 1024 * 1024;

/**
 * Sube la entrega de un estudiante y devuelve su ruta.
 *
 * La ruta la compone quien llama con ids de la base —nunca con el nombre del
 * archivo que subió—: un nombre de archivo es texto que elige el estudiante y
 * acabaría formando parte de una URL.
 *
 * `x-upsert` va en TRUE: volver a entregar sustituye la entrega anterior en vez
 * de acumular archivos que nadie va a mirar. Lo que sí queda es el rastro de la
 * fecha en `entrega_estudiante.fecha_entrega`.
 */
export async function subirEntrega(
  ruta: string,
  archivo: File,
): Promise<{ ok: true; ruta: string } | { ok: false }> {
  return subir(DOCUMENTOS, ruta, archivo, true);
}

/**
 * Lo que se admite como material de una academia.
 *
 * Más tipos que una entrega —una academia reparte guías, presentaciones y
 * hojas de trabajo— pero la lista sigue siendo cerrada: un bucket donde se
 * pueda subir cualquier cosa es un bucket donde alguien sube un ejecutable.
 */
export const TIPOS_MATERIAL = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAXIMO_MATERIAL = 20 * 1024 * 1024;

/**
 * Sube un material de academia y devuelve su ruta.
 *
 * SIN upsert, al contrario que la foto y la entrega: aquí la ruta la compone
 * quien llama con un id nuevo por archivo, así que un `x-upsert: true` no
 * ahorraría basura —no hay archivo anterior que sustituir— y en cambio dejaría
 * que una ruta repetida por error pisara un material que ya estaba.
 */
export async function subirMaterial(
  ruta: string,
  archivo: File,
): Promise<{ ok: true; ruta: string } | { ok: false }> {
  return subir(DOCUMENTOS, ruta, archivo, false);
}

/**
 * Enlace firmado para descargar un objeto del bucket privado.
 *
 * El bucket es privado, así que no hay URL pública que valga: se pide a Supabase
 * un enlace con caducidad. Diez minutos, que es de sobra para abrir un PDF y
 * poco para que el enlace circule por ahí y siga sirviendo.
 *
 * Se llamaba `enlaceDeEntrega` cuando las entregas del aula virtual eran lo
 * único que vivía ahí. Firma cualquier clave de `documentos` —entregas, fichas
 * escaneadas y materiales de academia—, así que el nombre dice ahora lo que
 * hace, no quién fue su primer usuario.
 *
 * Devuelve `null` si algo falla, y quien llama dibuja la fila sin botón de
 * descarga: mejor eso que un enlace roto.
 */
export async function enlaceDeDocumento(
  ruta: string | null,
  segundos = 600,
): Promise<string | null> {
  if (!ruta) return null;

  const { url, secreto } = credenciales();

  const res = await fetch(
    `${url}/storage/v1/object/sign/${DOCUMENTOS}/${ruta}`,
    {
      method: "POST",
      headers: {
        apikey: secreto,
        Authorization: `Bearer ${secreto}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: segundos }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    console.error("[almacen] no se pudo firmar el enlace:", res.status);
    return null;
  }

  const { signedURL } = (await res.json()) as { signedURL: string };

  return `${url}/storage/v1${signedURL}`;
}

/**
 * Borra un objeto del bucket privado.
 *
 * Se usa al eliminar un material de academia: la fila de `material` desaparece
 * de la base y el archivo tiene que irse con ella. Sin esto, el bucket acumula
 * archivos que ninguna fila nombra —imposibles de encontrar por la interfaz y
 * imposibles de justificar en un bucket donde hay trabajo de menores—.
 *
 * No lanza. Si el borrado del archivo falla, la fila ya se fue y devolver un
 * error dejaría al usuario creyendo que el material sigue ahí; se anota en el
 * servidor y se sigue.
 */
export async function borrarDocumento(ruta: string | null): Promise<void> {
  if (!ruta) return;

  try {
    const { url, secreto } = credenciales();

    const res = await fetch(`${url}/storage/v1/object/${DOCUMENTOS}/${ruta}`, {
      method: "DELETE",
      headers: { apikey: secreto, Authorization: `Bearer ${secreto}` },
    });

    if (!res.ok) {
      console.error("[almacen] no se pudo borrar el archivo:", res.status);
    }
  } catch (error) {
    console.error("[almacen] no se pudo borrar el archivo", error);
  }
}
