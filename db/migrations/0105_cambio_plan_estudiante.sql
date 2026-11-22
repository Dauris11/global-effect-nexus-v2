-- ================================================================
-- PORTAL GLOBALEFFECT — 0105 · Historial de cambio de universidad, carrera o plan
-- ================================================================
-- Cada vez que a un estudiante que ya tenía universidad, carrera o plan de estudios se le
-- cambia alguno, queda una fila con cómo estaba y cómo quedó. Se guardan los NOMBRES y no
-- los ids: si luego se borra o renombra una carrera, el historial se sigue leyendo igual.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.estudiante_cambio_plan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES public.estudiante(id) ON DELETE CASCADE,
  de_universidad text,
  de_carrera     text,
  de_plan        text,
  a_universidad  text,
  a_carrera      text,
  a_plan         text,
  usuario_id    uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estudiante_cambio_plan_estudiante_idx
  ON public.estudiante_cambio_plan (estudiante_id, creado_en DESC);

ALTER TABLE public.estudiante_cambio_plan ENABLE ROW LEVEL SECURITY;
