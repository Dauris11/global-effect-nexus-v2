-- ================================================================
-- PORTAL GLOBALEFFECT — 0091 · Base de conocimiento editable
-- ================================================================
-- 1) `orden`: para poder editar un documento hay que reconstruir su texto, y
--    los fragmentos de un mismo documento se insertaban en una transacción
--    (mismo `created_at`), así que nada fijaba su secuencia. Los documentos
--    ya cargados se numeran con el orden físico de inserción (`ctid`), que
--    para inserciones seguidas coincide con el original; es la mejor
--    reconstrucción posible y quien edite verá el texto antes de guardar.
--
-- 2) `ia.conocimiento`: permiso propio para que `admin` mantenga los
--    documentos del agente de estudiantes SIN heredar `ia.administrar`, que
--    además cambia modelos, cuotas y límites de la IA.
-- ================================================================

ALTER TABLE public.fragmento_conocimiento
  ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;

WITH numerados AS (
  SELECT id,
         row_number() OVER (PARTITION BY fuente_id ORDER BY created_at, ctid) - 1 AS n
    FROM public.fragmento_conocimiento
   WHERE fuente_tipo = 'documento' AND fuente_id IS NOT NULL
)
UPDATE public.fragmento_conocimiento f
   SET orden = numerados.n
  FROM numerados
 WHERE f.id = numerados.id;

CREATE INDEX IF NOT EXISTS idx_fragmento_documento_orden
  ON public.fragmento_conocimiento (fuente_id, orden);

INSERT INTO public.permiso (codigo, descripcion)
VALUES ('ia.conocimiento',
        'Editar los documentos de la base de conocimiento del asistente de estudiantes.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  CROSS JOIN public.permiso p
 WHERE r.nombre IN ('admin', 'super_admin')
   AND p.codigo = 'ia.conocimiento'
ON CONFLICT DO NOTHING;
