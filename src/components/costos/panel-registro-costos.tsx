import { RegistroMateriales } from "@/components/costos/registro-materiales";
import { RegistroTransporte } from "@/components/costos/registro-transporte";
import type { DatosRegistroCostos } from "@/server/costos/consultas";

/** Materiales y transporte de un estudiante: lo comparten la pantalla de contabilidad y la pestaña «Costos». */
export function PanelRegistroCostos({ datos }: { datos: DatosRegistroCostos }) {
  return (
    <div className="space-y-8">
      <RegistroMateriales estudianteId={datos.estudianteId} materiales={datos.materiales} articulos={datos.articulos} />
      <RegistroTransporte
        estudianteId={datos.estudianteId}
        registros={datos.transporte}
        periodos={datos.periodos}
        diasTransporte={datos.diasTransporte}
      />
    </div>
  );
}
