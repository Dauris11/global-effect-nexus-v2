"use client";

import { Inbox, Plus, Save } from "lucide-react";
import { useState } from "react";

import { ActionTile } from "@/components/app/action-tile";
import { AttentionList, type ItemAtencion } from "@/components/app/attention-list";
import { FilterBar } from "@/components/app/filter-bar";
import { MenuMasAcciones } from "@/components/app/menu-mas-acciones";
import { SidePanelForm } from "@/components/app/side-panel-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Parte interactiva de la página de muestra (los componentes con estado y URL). Texto solo de demostración. */
const DEMO = {
  chips: [
    { value: "activo", label: "Activos", count: 6 },
    { value: "en_riesgo", label: "En riesgo", count: 2 },
    { value: "graduado", label: "Graduados", count: 1 },
  ],
  abrir: "Abrir panel lateral",
  titulo: "Nuevo expediente",
  guardar: "Guardar expediente",
  nombre: "Nombre completo",
  cedula: "Cédula",
  telefono: "Teléfono",
  correo: "Correo",
  masFiltros: "Filtro de ejemplo",
};

const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const ITEMS: ItemAtencion[] = [
  { id: "1", status: "vencida", title: "Rendición RG-000012", context: "Contabilidad", date: dia(-2), action: { label: "Revisar", onClick: () => {} } },
  { id: "2", status: "en_revision", title: "Solicitud de beca de transporte", context: "Dirección", date: dia(0), action: { label: "Aprobar", onClick: () => {} } },
  { id: "3", status: "por_vencer", title: "Cuota de promesa PD-000004", context: "Patrocinadores", date: dia(3), action: { label: "Ver", href: "/ui-kit" } },
];

export function DemoCliente() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-section">ActionTile (con onClick, desde un componente cliente)</h2>
        <div className="max-w-xs"><ActionTile icon={Plus} title="Nuevo recibo" hint="Abre un panel" onClick={() => setAbierto(true)} /></div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section">FilterBar</h2>
        <FilterBar chips={DEMO.chips} moreFilters={<Label className="text-label">{DEMO.masFiltros}</Label>} />
      </section>

      <section className="space-y-3">
        <h2 className="text-section">SidePanelForm + MenuMasAcciones</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setAbierto(true)}>{DEMO.abrir}</Button>
          <MenuMasAcciones acciones={[{ etiqueta: DEMO.abrir, icono: Inbox, onClick: () => setAbierto(true) }]} />
        </div>
        <SidePanelForm
          open={abierto}
          onOpenChange={setAbierto}
          title={DEMO.titulo}
          submitLabel={DEMO.guardar}
          submitIcon={<Save className="size-4" />}
          onSubmit={(e) => {
            e.preventDefault();
            setAbierto(false);
          }}
          moreDetails={
            <>
              <div className="space-y-1.5"><Label className="text-label">{DEMO.telefono}</Label><Input /></div>
              <div className="space-y-1.5"><Label className="text-label">{DEMO.correo}</Label><Input type="email" /></div>
            </>
          }
        >
          <div className="space-y-1.5"><Label className="text-label">{DEMO.nombre}</Label><Input required /></div>
          <div className="space-y-1.5"><Label className="text-label">{DEMO.cedula}</Label><Input className="font-mono" /></div>
        </SidePanelForm>
      </section>

      <AttentionList items={ITEMS} viewAllHref="/ui-kit" />
    </div>
  );
}
