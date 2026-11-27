/**
 * Baja una foto del celular a un JPEG de lado largo ≤ 2000 px antes de mandarla.
 * Una foto de teléfono pesa 3–8 MB: pasa el tope de lectura del servidor (5 MB) y
 * dos juntas rozan el de la Server Action. A 2000 px el texto impreso del récord
 * se sigue leyendo bien y cada foto queda por debajo de 1 MB.
 *
 * `createImageBitmap` respeta la orientación EXIF, así que una foto tomada con el
 * teléfono de lado llega derecha. Si el navegador no puede decodificarla (un HEIC
 * fuera de Safari, un PDF), se devuelve tal cual y decide el servidor.
 */
export async function reducirImagen(archivo: File, ladoMaximo = 2000, calidad = 0.85): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;

  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");

    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();

    const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", calidad));

    return blob ? new File([blob], `${archivo.name.replace(/\.[^.]+$/, "") || "record"}.jpg`, { type: "image/jpeg" }) : archivo;
  } catch {
    return archivo;
  }
}
