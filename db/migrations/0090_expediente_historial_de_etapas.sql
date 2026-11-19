-- ================================================================
-- PORTAL GLOBALEFFECT — 0090 · Historial de etapas del expediente
-- ================================================================
-- El expediente recorre Habitudes → postulado → academia de liderazgo →
-- universidad (activo) o descarte (inactivo). Hasta hoy solo guardaba el
-- estado vigente: no había forma de saber quién lo movió, cuándo ni desde
-- dónde. Esta tabla lo registra; es la base de las alertas y sanciones
-- posteriores (docs/estado/plan-expediente-academico.md, fase 1).
-- ================================================================

CREATE TABLE IF NOT EXISTS public.estudiante_etapa (
  id bigserial PRIMARY KEY,
  estudiante_id uuid NOT NULL REFERENCES public.estudiante(id) ON DELETE CASCADE,
  estado_anterior public.estado_estudiante,
  estado_nuevo public.estado_estudiante NOT NULL,
  motivo text,
  usuario_id uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estudiante_etapa_estudiante
  ON public.estudiante_etapa (estudiante_id, creado_en DESC);

COMMENT ON TABLE public.estudiante_etapa IS
  'Cada cambio de estado del expediente. estado_anterior es NULL en el alta.';
