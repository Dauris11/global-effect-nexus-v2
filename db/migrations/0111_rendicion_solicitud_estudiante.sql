-- Rendición de gastos: ligada a la solicitud que la autorizó y, si procede,
-- al estudiante becado a cuyo costo se imputa.
--
-- Sin `solicitud_id` el ciclo petición → aprobación → comprobantes → cierre
-- quedaba cortado: se podía rendir un gasto que nadie había autorizado.
-- `estudiante_id` alimenta el costo por estudiante (plan-costo-por-estudiante,
-- §3A punto 3).
--
-- Ambas columnas admiten NULL a propósito: las rendiciones anteriores no
-- tienen solicitud, y que una rendición NUEVA la lleve es regla de la acción
-- del servidor, no del esquema (un NOT NULL habría obligado a inventar
-- solicitudes para el histórico). ON DELETE SET NULL para que borrar una
-- solicitud o un expediente nunca arrastre el comprobante contable.
ALTER TABLE public.rendicion_gasto
  ADD COLUMN IF NOT EXISTS solicitud_id uuid REFERENCES public.solicitud(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estudiante_id uuid REFERENCES public.estudiante(id) ON DELETE SET NULL;

-- Parciales: la mayoría de las filas (históricas, sin estudiante) quedan fuera.
CREATE INDEX IF NOT EXISTS idx_rendicion_gasto_solicitud
  ON public.rendicion_gasto (solicitud_id)
  WHERE solicitud_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rendicion_gasto_estudiante
  ON public.rendicion_gasto (estudiante_id)
  WHERE estudiante_id IS NOT NULL;
