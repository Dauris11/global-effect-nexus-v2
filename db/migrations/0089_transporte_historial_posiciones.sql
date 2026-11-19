-- ================================================================
-- GLOBAL EFFECT NEXUS — 0089 · Historial de posiciones GPS del viaje
-- ================================================================
-- `transporte_viaje` solo guarda la última posición. Esta tabla conserva cada
-- punto (con precisión) para poder reconstruir el recorrido real de un viaje.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.transporte_posicion (
  id bigserial PRIMARY KEY,
  viaje_id uuid NOT NULL REFERENCES public.transporte_viaje(id) ON DELETE CASCADE,
  lat numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  precision_m numeric(7,1),
  rumbo numeric(5,2),
  velocidad_kmh numeric(5,2),
  registrado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transporte_posicion_viaje_tiempo
  ON public.transporte_posicion (viaje_id, registrado_en);

COMMENT ON TABLE public.transporte_posicion IS
  'Punto GPS del recorrido de un viaje; se inserta como máximo cada 5 s por viaje.';
