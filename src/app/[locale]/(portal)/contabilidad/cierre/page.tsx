import { requerirPermiso } from "@/lib/auth";
import {
  listarPeriodosContables,
  listarCierresAnuales,
  obtenerResumenPreCierreAnual,
} from "@/server/contabilidad/cierre/consultas";
import { VistaCierre } from "@/components/contabilidad/cierre/vista-cierre";

export const metadata = {
  title: "Cierre Contable y Períodos — Contabilidad | Global Effect Nexus",
};

export default async function PaginaCierreContable() {
  await requerirPermiso("contabilidad.cerrar_periodo");

  const anioActual = new Date().getFullYear();

  const [periodosIniciales, cierresAnualesIniciales, resumenPreCierreInicial] =
    await Promise.all([
      listarPeriodosContables(anioActual),
      listarCierresAnuales(),
      obtenerResumenPreCierreAnual(anioActual),
    ]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-entrada">
      <VistaCierre
        ejercicioSeleccionado={anioActual}
        periodosIniciales={periodosIniciales}
        cierresAnualesIniciales={cierresAnualesIniciales}
        resumenPreCierreInicial={resumenPreCierreInicial}
      />
    </div>
  );
}
