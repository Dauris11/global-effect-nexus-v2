/**
 * Elimina los archivos de icono de carpeta de macOS ("Icon\r").
 *
 * Google Drive para escritorio marca cada carpeta que sincroniza con un
 * archivo llamado `Icon` terminado en retorno de carro. Turbopack no espera
 * ese archivo dentro de `.next` y aborta con "Unexpected file in persistence
 * directory"; git tampoco puede con él dentro de `.git/refs`.
 *
 * Se ejecuta solo antes de `dev` y de `build` (ganchos `predev`/`prebuild`).
 *
 * Arreglo de fondo: sacar el proyecto de la carpeta que sincroniza Google
 * Drive, o excluirla en sus preferencias. Esto solo evita el síntoma.
 */
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Carpetas que no vale la pena recorrer.
 *
 * `.git` **sí** se recorre, aunque cueste unos milisegundos más: es donde el
 * problema hace verdadero daño. Con un `Icon\r` dentro de `.git/refs`, git lo
 * lee como una referencia y todo `fetch` y `push` muere con
 * `fatal: bad object refs/Icon?`; dentro de `.git/objects` aparece como
 * "garbage found" en cada directorio. Excluirlo era dejar fuera el único sitio
 * donde el síntoma bloquea el trabajo en vez de solo molestar.
 */
const IGNORAR = new Set(["node_modules"]);

/** El nombre real lleva un retorno de carro final. */
const NOMBRE = "Icon\r";

let borrados = 0;

function recorrer(dir) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // carpeta ilegible o borrada mientras recorríamos
  }

  for (const entrada of entradas) {
    if (entrada.name === NOMBRE) {
      try {
        rmSync(join(dir, entrada.name), { force: true });
        borrados++;
      } catch {
        /* si no se puede borrar, seguimos: el aviso llega abajo */
      }
    } else if (entrada.isDirectory() && !IGNORAR.has(entrada.name)) {
      recorrer(join(dir, entrada.name));
    }
  }
}

recorrer(process.cwd());

if (borrados > 0) {
  console.log(`limpiar-iconos: ${borrados} archivo(s) "Icon" de macOS eliminados`);
}
