import { EsqueletoEncabezado, EsqueletoLista, EsqueletoPagina } from "@/components/estudiante/esqueletos";

export default function Cargando() {
  return (
    <EsqueletoPagina className="space-y-6">
      <EsqueletoEncabezado />
      <EsqueletoLista filas={5} />
      <EsqueletoLista filas={3} />
    </EsqueletoPagina>
  );
}
