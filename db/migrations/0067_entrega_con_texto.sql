-- ================================================================
-- GLOBAL EFFECT NEXUS — 0067 · Entregas con texto escrito
-- ================================================================
-- Una tarea de 360 se puede resolver subiendo un documento o escribiendo la
-- respuesta en la propia plataforma. `comentario_estudiante` es una nota al
-- profesor, no la respuesta; la respuesta escrita va en `texto_respuesta`.
-- El servidor exige que la entrega lleve archivo, texto o ambos.
-- ================================================================

ALTER TABLE public.entrega_estudiante
  ADD COLUMN IF NOT EXISTS texto_respuesta TEXT;

ALTER TABLE public.entrega_estudiante
  DROP CONSTRAINT IF EXISTS entrega_texto_respuesta_largo;
ALTER TABLE public.entrega_estudiante
  ADD CONSTRAINT entrega_texto_respuesta_largo
  CHECK (texto_respuesta IS NULL OR length(texto_respuesta) <= 20000);
