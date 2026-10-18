import ExcelJS from "exceljs";

/**
 * Generador de libros Excel (.xlsx) para el departamento de contabilidad
 * de la Fundación Global Effect.
 *
 * Aplica los colores de la marca institucional (turquesa `#2096BA`, bordes grises
 * suaves, tipografía limpia y formatos numéricos dominicanos).
 */

const COLOR_CABECERA_FONDO = "2096BA";
const COLOR_CABECERA_TEXTO = "FFFFFF";
const COLOR_ZEBRA = "F8FAFC";

export type ColumnaExcel = {
  header: string;
  key: string;
  width?: number;
  formato?: "texto" | "moneda" | "fecha" | "entero" | "porcentaje";
};

export async function crearLibroExcel(params: {
  tituloHoja: string;
  columnas: ColumnaExcel[];
  filas: Record<string, unknown>[];
  totales?: Record<string, number | string>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Global Effect Nexus";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(params.tituloHoja, {
    views: [{ showGridLines: true }],
  });

  // Configurar columnas
  worksheet.columns = params.columnas.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 18,
  }));

  // Estilo de la fila de cabecera
  const cabecera = worksheet.getRow(1);
  cabecera.height = 28;
  cabecera.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_CABECERA_FONDO },
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: COLOR_CABECERA_TEXTO },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "0A6A8A" } },
      bottom: { style: "medium", color: { argb: "0A6A8A" } },
      left: { style: "thin", color: { argb: "0A6A8A" } },
      right: { style: "thin", color: { argb: "0A6A8A" } },
    };
  });

  // Agregar filas de datos con formato
  params.filas.forEach((fila, idx) => {
    const row = worksheet.addRow(fila);
    row.height = 20;

    const esPar = idx % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colDef = params.columnas[colNumber - 1];

      if (esPar) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR_ZEBRA },
        };
      }

      cell.font = { name: "Calibri", size: 10 };
      cell.border = {
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } },
      };

      if (colDef) {
        if (colDef.formato === "moneda") {
          cell.numFmt = '"RD$"#,##0.00;[Red]-"RD$"#,##0.00;"-"';
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else if (colDef.formato === "fecha") {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (colDef.formato === "porcentaje") {
          cell.numFmt = "0.00%";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { vertical: "middle" };
        }
      }
    });
  });

  // Fila de totales si se especificó
  if (params.totales) {
    const filaTotales = worksheet.addRow(params.totales);
    filaTotales.height = 24;
    filaTotales.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colDef = params.columnas[colNumber - 1];
      cell.font = { name: "Calibri", size: 10, bold: true };
      cell.border = {
        top: { style: "thin", color: { argb: "171A1D" } },
        bottom: { style: "double", color: { argb: "171A1D" } },
      };
      if (colDef && colDef.formato === "moneda") {
        cell.numFmt = '"RD$"#,##0.00;[Red]-"RD$"#,##0.00;"-"';
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
