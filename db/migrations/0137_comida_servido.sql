-- ================================================================
-- 0137 · Lista del comedor: «servido»
-- ================================================================
-- La cocina marca en la lista de inscritos a quién ya se le sirvió. Es una columna aditiva: las filas
-- existentes quedan como «sin servir». Sin servidor de otra cosa: sigue siendo el mismo comedor de una
-- sola comida por día.
-- ================================================================

ALTER TABLE public.inscripcion_comida
  ADD COLUMN IF NOT EXISTS servido BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.inscripcion_comida.servido IS
  'La cocina ya sirvió a esta persona (se marca en la lista del comedor).';
