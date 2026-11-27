import { CalendarCheck, ClipboardCheck, FileText, Inbox, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionTile } from "@/components/app/action-tile";
import { EmptyState } from "@/components/app/empty-state";
import { PageContainer } from "@/components/app/page-container";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { MAPA_ESTADOS, type TokenEstado } from "@/lib/status-map";
import { DemoCliente } from "./demo-cliente";

/**
 * Muestra de los componentes base (docs/ux-rules.md) y de TODOS los estados del mapa
 * central. Solo en desarrollo: en producción responde 404. El texto de esta página es de
 * demostración y no va a i18n.
 */
const TOKENS: readonly TokenEstado[] = ["success", "warning", "danger", "info", "progress", "done", "neutral"];

export default function PaginaUiKit() {
  if (process.env.NODE_ENV === "production") notFound();

  const porToken = TOKENS.map((t) => ({ token: t, estados: Object.entries(MAPA_ESTADOS).flatMap(([estado, tk]) => (tk === t ? [estado] : [])) }));

  return (
    <PageContainer className="space-y-10 py-8">
      <PageHeader
        title="UI kit"
        subtitle="Componentes base y estados del sistema"
        primaryAction={<Button><Plus className="size-4" />Nuevo expediente</Button>}
        secondaryActions={<Button variant="outline">Exportar</Button>}
      />

      <section className="space-y-3">
        <h2 className="text-section">Tipografía</h2>
        <div className="space-y-1 rounded-card border border-linea bg-card p-5">
          <p className="text-page">text-page · Título de página</p>
          <p className="text-section">text-section · Título de sección</p>
          <p className="text-body">text-body · Texto general de 14 px con interlineado 1,55.</p>
          <p className="text-label">text-label · Etiqueta de formulario</p>
          <p className="text-meta">text-meta · Metadatos y fechas</p>
          <p className="text-kpi">1.234.567,89 <span className="text-meta font-normal">text-kpi</span></p>
          <p className="font-mono text-sm">AS-000063 · CE-000023 · 402-1234567-8 (Plex Mono)</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section">Botones</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Pequeño 32</Button>
          <Button>Normal 36</Button>
          <Button size="lg">Grande 44</Button>
          <Button variant="outline">Secundario</Button>
          <Button variant="ghost">Fantasma</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section">StatusBadge · {Object.keys(MAPA_ESTADOS).length} estados</h2>
        <div className="space-y-4 rounded-card border border-linea bg-card p-5">
          {porToken.map(({ token, estados }) => (
            <div key={token} className="space-y-2">
              <p className="text-label">{token} ({estados.length})</p>
              <div className="flex flex-wrap gap-2">{estados.map((e) => <StatusBadge key={e} status={e} />)}</div>
            </div>
          ))}
          <div className="space-y-2">
            <p className="text-label">Estado desconocido (cae en neutral)</p>
            <StatusBadge status="valor_inexistente" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section">ActionTile</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionTile icon={ClipboardCheck} title="Subir calificaciones" hint="Por clase" href="/ui-kit" />
          <ActionTile icon={CalendarCheck} title="Registrar visita" href="/ui-kit" />
          <ActionTile icon={FileText} title="Pedir una constancia" hint="Respuesta en 2 días" href="/ui-kit" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section">EmptyState</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState icon={Inbox} title="Todavía no hay solicitudes" description="Cuando alguien pida algo, aparecerá aquí." action={<Button><Plus className="size-4" />Nueva solicitud</Button>} />
          <EmptyState readOnly icon={Inbox} title="No hay clases asignadas" description="Pídele a coordinación que te asigne una clase." />
        </div>
      </section>

      <Suspense fallback={null}>
        <DemoCliente />
      </Suspense>
    </PageContainer>
  );
}
