"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText, Printer, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { enlaceExportar, FORMATOS_DE, type FormatoExportacion, type TipoExportacion } from "@/lib/exportar";

export type DocumentoExportable = {
  tipo: TipoExportacion;
  /** Cómo se llama el documento para quien lo pide: «Ficha completa con foto». */
  etiqueta: string;
  /** Qué estudiante, universidad, clase… (`id`, `materia`, `periodo`, o los filtros de la lista). */
  params?: Record<string, string>;
};

const ICONO = { pdf: FileText, docx: FileText, xlsx: FileSpreadsheet, csv: Table2 } as const;

/**
 * El botón «Exportar» de una pantalla: lista los DOCUMENTOS que se pueden sacar de ella (la
 * ficha de un estudiante, la lista de una clase…) y, de cada uno, los formatos que tienen
 * sentido: ver e imprimir (PDF en el navegador), PDF, Word, Excel y CSV. No imprime la
 * pantalla: genera el documento ordenado, con el logo de la Fundación.
 */
export function MenuExportar({ documentos, className }: { documentos: readonly DocumentoExportable[]; className?: string }) {
  const t = useTranslations("export");

  if (documentos.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Download className="size-4" />
          {t("button")}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        {documentos.map((d, i) => {
          const formatos: readonly FormatoExportacion[] = FORMATOS_DE[d.tipo];
          const params = d.params ?? {};

          return (
            <div key={`${d.tipo}-${i}`}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-sm font-semibold">{d.etiqueta}</DropdownMenuLabel>

              {formatos.includes("pdf") && (
                <DropdownMenuItem asChild>
                  <a href={enlaceExportar(d.tipo, params, "pdf", true)} target="_blank" rel="noopener noreferrer">
                    <Printer />
                    {t("viewPrint")}
                  </a>
                </DropdownMenuItem>
              )}

              {formatos.map((f) => {
                const Icono = ICONO[f];

                return (
                  <DropdownMenuItem key={f} asChild>
                    <a href={enlaceExportar(d.tipo, params, f)} download>
                      <Icono />
                      {t(`download.${f}`)}
                    </a>
                  </DropdownMenuItem>
                );
              })}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
