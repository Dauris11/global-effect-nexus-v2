"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ArbolCatalogo } from "@/server/universidades/consultas";

/** Textos ya traducidos por el servidor (el formulario no tiene proveedor de `catalog`). */
export type TextosCatalogo = {
  university: string;
  career: string;
  pensum: string;
  matricula: string;
  none: string;
  /** Con `{text}`: lo que había escrito a mano antes de existir el catálogo. */
  legacy: string;
  /** «Plan {version}», con `{version}`. */
  plan: string;
  previous: string;
  invalid: string;
  incompleteActive: string;
};

export type CatalogoDelFormulario = { arbol: ArbolCatalogo; textos: TextosCatalogo };

const CLASE_SELECT =
  "h-11 w-full rounded-control border border-linea-fuerte bg-background px-3 text-base text-tinta outline-none focus-visible:border-tinta focus-visible:ring-1 focus-visible:ring-tinta disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]";

/**
 * Universidad → carrera → pénsum (+ matrícula) como desplegables en cascada. Es
 * lo que reemplaza a los campos de texto libre «Universidad» y «Programa»: la
 * universidad se elige del catálogo, así el expediente, el pénsum y las reglas
 * de la universidad hablan del mismo registro. Al cambiar un nivel se vacían los
 * de abajo; el servidor vuelve a validar la cadena.
 */
export function CamposCatalogo({
  catalogo,
  valores,
  soloLectura,
}: {
  catalogo: CatalogoDelFormulario;
  valores?: { universidad?: string | null; universidad_id?: string | null; carrera_id?: string | null; pensum_id?: string | null; matricula?: string | null };
  soloLectura?: boolean;
}) {
  const { arbol, textos } = catalogo;
  const [uni, setUni] = useState(valores?.universidad_id ?? "");
  const [carrera, setCarrera] = useState(valores?.carrera_id ?? "");
  const [pensum, setPensum] = useState(valores?.pensum_id ?? "");

  const carreras = arbol.carreras.filter((c) => c.universidad_id === uni);
  const pensums = arbol.pensums.filter((p) => p.carrera_id === carrera);
  // Texto antiguo sin catálogo: se enseña para que no se pierda de vista, y se
  // conserva en la base hasta que se elija una universidad.
  const antiguo = !valores?.universidad_id && valores?.universidad ? valores.universidad : null;

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="cat-uni">{textos.university}</Label>
        <select id="cat-uni" name="universidad_id" value={uni} disabled={soloLectura} className={CLASE_SELECT}
          onChange={(e) => { setUni(e.target.value); setCarrera(""); setPensum(""); }}>
          <option value="">{textos.none}</option>
          {arbol.universidades.map((u) => <option key={u.id} value={u.id}>{u.siglas}</option>)}
        </select>
        {antiguo && <p className="texto-meta">{textos.legacy.replace("{text}", antiguo)}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cat-carrera">{textos.career}</Label>
        <select id="cat-carrera" name="carrera_id" value={carrera} disabled={soloLectura || !uni} className={CLASE_SELECT}
          onChange={(e) => { setCarrera(e.target.value); setPensum(""); }}>
          <option value="">{textos.none}</option>
          {carreras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cat-pensum">{textos.pensum}</Label>
        <select id="cat-pensum" name="pensum_id" value={pensum} disabled={soloLectura || !carrera} className={CLASE_SELECT}
          onChange={(e) => setPensum(e.target.value)}>
          <option value="">{textos.none}</option>
          {pensums.map((p) => (
            <option key={p.id} value={p.id}>
              {textos.plan.replace("{version}", p.version)}{p.vigente ? "" : ` · ${textos.previous}`}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cat-matricula">{textos.matricula}</Label>
        <Input id="cat-matricula" name="matricula" defaultValue={valores?.matricula ?? ""} maxLength={40} disabled={soloLectura} />
      </div>
    </>
  );
}
