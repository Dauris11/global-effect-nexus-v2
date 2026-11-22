import { CargaPagina } from "@/components/ui/carga-pagina";

/** Red de seguridad del portal: cualquier módulo sin carga propia muestra esta mientras llega. */
export default function CargandoPortal() {
  return <CargaPagina variante="lista" />;
}
