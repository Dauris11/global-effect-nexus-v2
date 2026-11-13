import type { FiltroLibros } from "@/server/contabilidad/libros/consultas";

/**
 * La URL de los libros a partir del filtro. Todo el estado vive en la URL
 * para que un enlace copiado abra el mismo libro, y la descarga a Excel
 * use exactamente lo que se ve.
 *
 * Solo se escriben las fechas, nunca `periodo`: así un rango editado a
 * mano no queda pisado por un mes viejo que seguía en la URL.
 */
export function consultaLibros(f: FiltroLibros, cambios: Partial<FiltroLibros> = {}): string {
  const v = { ...f, ...cambios };
  const p = new URLSearchParams({ vista: v.vista, desde: v.desde, hasta: v.hasta });
  if (v.cuentaDesde) p.set("cdesde", v.cuentaDesde);
  if (v.cuentaHasta) p.set("chasta", v.cuentaHasta);
  if (v.ceros) p.set("ceros", "1");
  return p.toString();
}
