-- ================================================================
-- GLOBAL EFFECT NEXUS — 0063 · Torre de control por usuario
-- ================================================================
-- La 0041 repartía proyectos por ROL (`proyecto_rol`) y `proyecto.responsable`
-- era texto libre. Con eso no se puede contestar "¿qué lleva Fulano?": un
-- nombre escrito a mano no se une con nada y un rol agrupa a gente que no
-- trabaja en lo mismo. Esta migración ata proyectos y comentarios a personas.
--
--   1. `proyecto.responsable_id`: el líder como cuenta, no como texto. El
--      texto se conserva porque hay pantallas e informes que lo leen.
--   2. `proyecto_miembro`: quién trabaja en el proyecto.
--   3. `tarea_comentario`: la conversación de una tarea, para que el avance
--      no se pierda en WhatsApp.
--
-- Idempotente: todo con IF NOT EXISTS.
-- ================================================================

ALTER TABLE public.proyecto
  ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES public.usuario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proyecto_responsable ON public.proyecto(responsable_id);

-- Si el texto del responsable coincide exactamente con el nombre de una sola
-- cuenta activa, se enlaza. Si hay dos con el mismo nombre no se adivina.
UPDATE public.proyecto p
   SET responsable_id = u.id
  FROM public.usuario u
 WHERE p.responsable_id IS NULL
   AND p.responsable IS NOT NULL
   AND u.activo
   AND lower(trim(u.nombre)) = lower(trim(p.responsable))
   AND (SELECT count(*) FROM public.usuario u2
         WHERE u2.activo AND lower(trim(u2.nombre)) = lower(trim(p.responsable))) = 1;

CREATE TABLE IF NOT EXISTS public.proyecto_miembro (
  proyecto_id  UUID NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  usuario_id   UUID NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  asignado_por UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proyecto_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_miembro_usuario ON public.proyecto_miembro(usuario_id);

-- El responsable es miembro: así "mis proyectos" no depende de dos consultas.
INSERT INTO public.proyecto_miembro (proyecto_id, usuario_id)
SELECT p.id, p.responsable_id
  FROM public.proyecto p
 WHERE p.responsable_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tarea_comentario (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id   UUID NOT NULL REFERENCES public.tarea(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  texto      TEXT NOT NULL CHECK (length(trim(texto)) > 0 AND length(texto) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarea_comentario_tarea
  ON public.tarea_comentario(tarea_id, created_at);
