import {
  EsqueletoChips,
  EsqueletoCifras,
  EsqueletoEncabezado,
  EsqueletoLista,
  EsqueletoPagina,
} from "@/components/estudiante/esqueletos";

/** Calificaciones: encabezado, cifras, chips de período y la lista de notas. */
export default function Cargando() {
  return (
    <EsqueletoPagina className="mx-auto max-w-5xl md:space-y-10">
      <EsqueletoEncabezado />
      <EsqueletoCifras />
      <EsqueletoChips />
      <EsqueletoLista filas={5} />
      <EsqueletoLista filas={5} />
    </EsqueletoPagina>
  );
}
