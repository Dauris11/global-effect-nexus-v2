-- ================================================================
-- GLOBAL EFFECT NEXUS — 0085 · Asistencia por materia asignada
-- ================================================================
-- Extiende el pase de lista a las materias académicas (`materia`) asignadas a
-- un profesor (`profesor_usuario_id`), de forma simétrica a `sesion_360` y
-- `asistencia_360`.
--
--   sesion_materia      una fecha de clase de una materia en un período
--   asistencia_materia  la marca de un inscrito (`inscripcion`) en una sesión
--
-- Idempotente: se puede correr dos veces.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.sesion_materia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id  UUID NOT NULL REFERENCES public.materia(id) ON DELETE CASCADE,
  periodo_id  UUID NOT NULL REFERENCES public.periodo(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  hora_inicio TIME,
  hora_fin    TIME,
  creado_por  UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (materia_id, periodo_id, fecha),
  CHECK (hora_fin IS NULL OR hora_inicio IS NULL OR hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_sesion_materia_materia
  ON public.sesion_materia (materia_id, periodo_id, fecha);

CREATE TABLE IF NOT EXISTS public.asistencia_materia (
  sesion_id      UUID NOT NULL REFERENCES public.sesion_materia(id) ON DELETE CASCADE,
  inscripcion_id UUID NOT NULL REFERENCES public.inscripcion(id) ON DELETE CASCADE,
  presente       BOOLEAN NOT NULL,
  marcado_por    UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  marcado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sesion_id, inscripcion_id)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_materia_inscripcion
  ON public.asistencia_materia (inscripcion_id);

-- Integridad entre `sesion_materia` e `inscripcion`: evita cruzar una sesión
-- de una materia/período con la inscripción de otra materia o período.
CREATE OR REPLACE FUNCTION public._fn_integridad_asistencia_materia()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sesion_materia uuid;
  v_sesion_periodo uuid;
  v_insc_materia   uuid;
  v_insc_periodo   uuid;
BEGIN
  SELECT s.materia_id, s.periodo_id
    INTO v_sesion_materia, v_sesion_periodo
    FROM public.sesion_materia s
   WHERE s.id = NEW.sesion_id;

  SELECT i.materia_id, i.periodo_id
    INTO v_insc_materia, v_insc_periodo
    FROM public.inscripcion i
   WHERE i.id = NEW.inscripcion_id;

  IF v_sesion_materia IS DISTINCT FROM v_insc_materia
     OR (v_insc_periodo IS NOT NULL AND v_sesion_periodo IS DISTINCT FROM v_insc_periodo) THEN
    RAISE EXCEPTION
      'public.asistencia_materia: la inscripción (%) no pertenece a la misma materia y período de la sesión (%).',
      NEW.inscripcion_id, NEW.sesion_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_integridad_asistencia_materia ON public.asistencia_materia;
CREATE TRIGGER tg_integridad_asistencia_materia
  BEFORE INSERT OR UPDATE ON public.asistencia_materia
  FOR EACH ROW EXECUTE FUNCTION public._fn_integridad_asistencia_materia();

COMMENT ON TABLE public.sesion_materia IS
  'Fechas de clase de una materia asignada a docente en un período. Ahí el profesor pasa lista.';
COMMENT ON TABLE public.asistencia_materia IS
  'Presente o ausente de una inscripción universitaria en una sesión de materia.';

