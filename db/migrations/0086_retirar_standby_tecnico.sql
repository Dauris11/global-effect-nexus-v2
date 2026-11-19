-- ================================================================
-- GLOBAL EFFECT NEXUS — 0086 · Retirar estado standby_tecnico activo
-- ================================================================
-- Tras el cierre de los cursos técnicos (0047), el estado
-- `standby_tecnico` dejó de formar parte del embudo activo de
-- reclutamiento. Cualquier expediente que hubiera quedado en
-- `standby_tecnico` pasa a `postulado` para permanecer en el embudo
-- de entrada de becas universitarias sin quedar huérfano en los filtros.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0086_retirar_standby_tecnico.sql', true);

UPDATE public.estudiante
   SET estado = 'postulado'::public.estado_estudiante,
       updated_at = now()
 WHERE estado = 'standby_tecnico'::public.estado_estudiante;
