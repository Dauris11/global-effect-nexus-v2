import {
  EsqueletoChips,
  EsqueletoEncabezado,
  EsqueletoLista,
  EsqueletoPagina,
} from "@/components/estudiante/esqueletos";

/** Calendario: encabezado, chips de mes y los días con sus entradas. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="">
      <EsqueletoEncabezado />
      <EsqueletoChips />
      <EsqueletoLista filas={3} />
      <EsqueletoLista filas={2} />
    </EsqueletoPagina>
  );
}
