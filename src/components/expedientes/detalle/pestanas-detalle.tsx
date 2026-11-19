"use client";

import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Las pestañas del detalle del expediente. Son del CLIENTE a propósito: cada
 * apertura de la ficha deja UNA fila en el registro de lecturas
 * (`expediente.consultado`), y con pestañas por enlace cada clic recargaría la
 * página y contaría otra apertura. Todo el contenido llega una sola vez y las
 * pestañas solo lo muestran.
 *
 * La pestaña activa se refleja en la URL (`?seccion=`) con `replaceState`, sin
 * navegar: el enlace se puede compartir y volver a abrir en el mismo sitio.
 */
export function PestanasDetalle({
  pestanas,
  inicial,
  contenido,
}: {
  pestanas: readonly { clave: string; etiqueta: string }[];
  inicial: string;
  contenido: Record<string, React.ReactNode>;
}) {
  const [activa, setActiva] = useState(inicial);

  const cambiar = (clave: string) => {
    setActiva(clave);

    try {
      const url = new URL(window.location.href);

      url.searchParams.set("seccion", clave);
      url.searchParams.delete("editar");
      window.history.replaceState(null, "", url);
    } catch {
      /* sin historial: la pestaña cambia igual */
    }
  };

  return (
    <Tabs value={activa} onValueChange={cambiar}>
      <TabsList className="mb-1">
        {pestanas.map((p) => (
          <TabsTrigger key={p.clave} value={p.clave}>
            {p.etiqueta}
          </TabsTrigger>
        ))}
      </TabsList>

      {pestanas.map((p) => (
        <TabsContent key={p.clave} value={p.clave} className="min-w-0 space-y-6">
          {contenido[p.clave]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
