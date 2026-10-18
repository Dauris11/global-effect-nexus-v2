"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BLANCO, TINTA } from "@/lib/paleta";

interface EtiquetaQrImprimibleProps {
  codigo: string;
  nombre: string;
  categoria: string;
  numeroSerie?: string | null;
  ubicacion: string;
}

/**
 * Componente de etiqueta patrimonial con código QR de alta resolución
 * listo para imprimir en etiquetas adhesivas o imprimir en hoja física.
 */
export function EtiquetaQrImprimible({
  codigo,
  nombre,
  categoria,
  numeroSerie,
  ubicacion,
}: EtiquetaQrImprimibleProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // Generar código QR de alta resolución con margen ajustado
    QRCode.toDataURL(
      JSON.stringify({
        codigo,
        nombre,
        nexus: "global-effect-nexus",
        verificar: `https://nexus.globaleffect.org/inventario/${codigo}`,
      }),
      {
        width: 320,
        margin: 1,
        color: {
          dark: TINTA,
          light: BLANCO,
        },
        errorCorrectionLevel: "M",
      }
    )
      .then(setDataUrl)
      .catch((err) => console.error("Error al generar QR:", err));
  }, [codigo, nombre]);

  const imprimir = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Contenedor de la etiqueta con estilo corporativo */}
      <div
        id="etiqueta-imprimible"
        className="w-full max-w-[340px] rounded-xl border-2 border-linea bg-white p-4 text-tinta shadow-sm print:max-w-none print:border-black print:p-6 print:shadow-none"
      >
        <div className="flex items-center justify-between border-b border-linea pb-2 print:border-black">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-marca-600 uppercase">
              Fundación Global Effect
            </p>
            <p className="text-xs font-semibold text-tinta-2">Control Patrimonial</p>
          </div>
          <span className="inline-flex items-center rounded-md bg-marca-50 px-2 py-0.5 text-xs font-bold text-marca-700 uppercase">
            {categoria}
          </span>
        </div>

        <div className="my-3 flex items-center justify-center">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`Código QR de ${codigo}`}
              className="size-44 rounded-lg border border-linea/60 object-contain p-1 print:size-48"
            />
          ) : (
            <div className="flex size-44 items-center justify-center rounded-lg border border-dashed border-linea text-tinta-2">
              <QrCode className="size-12 animate-pulse" />
            </div>
          )}
        </div>

        <div className="space-y-1 text-center">
          <p className="font-mono text-xl font-extrabold tracking-wider text-tinta">{codigo}</p>
          <p className="line-clamp-2 text-xs font-medium text-tinta-2">{nombre}</p>
          {numeroSerie && (
            <p className="text-[11px] text-tinta-3">
              <span className="font-semibold">S/N:</span> {numeroSerie}
            </p>
          )}
          <p className="text-[10px] text-tinta-3">
            <span className="font-semibold">Ubicación:</span> {ubicacion}
          </p>
        </div>
      </div>

      <Button
        onClick={imprimir}
        className="flex w-full items-center justify-center gap-2 print:hidden"
      >
        <Printer className="size-4" />
        <span>Imprimir Etiqueta QR</span>
      </Button>
    </div>
  );
}
