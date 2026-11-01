import { requerirPermiso } from "@/lib/auth";
import {
  obtenerBalanceGeneral,
  obtenerEstadoActividades,
  obtenerEstadoFlujoEfectivo,
  obtenerEstadoCambiosPatrimonio,
  obtenerMayorAnalitico,
  obtenerFlujoCajaProyectado,
  listarSnapshotsFinancieros,
} from "@/server/contabilidad/reportes/consultas";
import { VistaReportes } from "@/components/contabilidad/reportes/vista-reportes";

export const metadata = {
  title: "Estados Financieros y Reportes — Contabilidad | Global Effect Nexus",
};

export default async function PaginaReportesContables() {
  await requerirPermiso("contabilidad.leer");

  const [
    balanceInicial,
    actividadesInicial,
    flujoInicial,
    patrimonioInicial,
    mayorInicial,
    proyeccionInicial,
    snapshotsInicial,
  ] = await Promise.all([
    obtenerBalanceGeneral(),
    obtenerEstadoActividades(),
    obtenerEstadoFlujoEfectivo(),
    obtenerEstadoCambiosPatrimonio(),
    obtenerMayorAnalitico({}),
    obtenerFlujoCajaProyectado({ mesesProyeccion: 6 }),
    listarSnapshotsFinancieros(),
  ]);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-entrada">
      <VistaReportes
        balanceInicial={balanceInicial}
        actividadesInicial={actividadesInicial}
        flujoInicial={flujoInicial}
        patrimonioInicial={patrimonioInicial}
        mayorInicial={mayorInicial}
        proyeccionInicial={proyeccionInicial}
        snapshotsInicial={snapshotsInicial}
      />
    </div>
  );
}
