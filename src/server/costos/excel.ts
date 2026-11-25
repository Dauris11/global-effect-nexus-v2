import { crearLibroExcel } from "@/server/contabilidad/excel/generador-excel";

import { costoPorCarrera, costoPorEstudiante } from "./consultas";

/*
 * Excel del reporte de costo por estudiante. Los encabezados van en español
 * fijo, como el resto de exportaciones de contabilidad: el archivo se entrega
 * a la Junta y a donantes, no depende del idioma de la interfaz.
 */

export async function exportarCostoPorCarreraExcel(): Promise<Buffer> {
  const filas = await costoPorCarrera();

  return crearLibroExcel({
    tituloHoja: "Costo por carrera",
    columnas: [
      { header: "Universidad", key: "universidad", width: 16 },
      { header: "Carrera", key: "carrera", width: 36 },
      { header: "Becados", key: "becados", width: 11, formato: "entero" },
      { header: "Con costo registrado", key: "con_costo", width: 16, formato: "entero" },
      { header: "Graduados", key: "graduados", width: 11, formato: "entero" },
      { header: "Total invertido", key: "total_invertido", width: 18, formato: "moneda" },
      { header: "Promedio por becado", key: "promedio_por_becado", width: 20, formato: "moneda" },
      { header: "Promedio por cuatrimestre", key: "promedio_por_cuatrimestre", width: 22, formato: "moneda" },
      { header: "Promedio por graduado", key: "promedio_por_graduado", width: 20, formato: "moneda" },
    ],
    filas: filas.map((f) => ({ ...f })),
    totales: {
      universidad: "Total",
      becados: filas.reduce((s, f) => s + f.becados, 0),
      con_costo: filas.reduce((s, f) => s + f.con_costo, 0),
      graduados: filas.reduce((s, f) => s + f.graduados, 0),
      total_invertido: filas.reduce((s, f) => s + f.total_invertido, 0),
    },
  });
}

export async function exportarCostoPorEstudianteExcel(): Promise<Buffer> {
  const filas = await costoPorEstudiante();

  return crearLibroExcel({
    tituloHoja: "Costo por estudiante",
    columnas: [
      { header: "Estudiante", key: "nombre", width: 32 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Universidad", key: "universidad", width: 14 },
      { header: "Carrera", key: "carrera", width: 32 },
      { header: "Universidad (pagos)", key: "total_universidad", width: 18, formato: "moneda" },
      { header: "Materiales", key: "total_materiales", width: 16, formato: "moneda" },
      { header: "Transporte", key: "total_transporte", width: 16, formato: "moneda" },
      { header: "Trámites y rendiciones", key: "total_rendiciones", width: 20, formato: "moneda" },
      { header: "Costo total", key: "costo_total_acumulado", width: 18, formato: "moneda" },
      { header: "Cuatrimestres", key: "cuatrimestres_cursados", width: 14, formato: "entero" },
      { header: "Aportes del patrocinador (estimado)", key: "aportes_patrocinador", width: 24, formato: "moneda" },
    ],
    filas: filas.map((f) => ({ ...f })),
    totales: {
      nombre: "Total",
      total_universidad: filas.reduce((s, f) => s + f.total_universidad, 0),
      total_materiales: filas.reduce((s, f) => s + f.total_materiales, 0),
      total_transporte: filas.reduce((s, f) => s + f.total_transporte, 0),
      total_rendiciones: filas.reduce((s, f) => s + f.total_rendiciones, 0),
      costo_total_acumulado: filas.reduce((s, f) => s + f.costo_total_acumulado, 0),
      aportes_patrocinador: filas.reduce((s, f) => s + f.aportes_patrocinador, 0),
    },
  });
}
