/**
 * Entrada de página del portal.
 *
 * Un `template` y no el `layout`: Next vuelve a montar el template cada vez
 * que cambia el segmento hijo, así que la animación se repite al pasar de un
 * módulo a otro, mientras que el armazón (barra lateral, topbar) sigue montado
 * y no parpadea. La animación es CSS (`.entrada-pagina` en globals.css): corre
 * fuera del hilo principal, que en ese momento está ocupado hidratando la
 * página nueva, y se apaga sola con `prefers-reduced-motion`.
 */
export default function PlantillaPortal({ children }: { children: React.ReactNode }) {
  return <div className="entrada-pagina">{children}</div>;
}
