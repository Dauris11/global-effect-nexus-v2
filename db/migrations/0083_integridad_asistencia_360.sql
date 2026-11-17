-- 0083 · Integridad entre `sesion_360` e `inscripcion_360` en `asistencia_360`.
--
-- `asistencia_360` enlaza una sesión (`sesion_id`) con una inscripción
-- (`inscripcion_id`). Las dos tablas llevan `materia` y `periodo_id`, pero las
-- llaves foráneas por separado no impedían cruzar la sesión de una clase con la
-- inscripción de otra materia o de otro cuatrimestre. Este disparador lo
-- comprueba en la base de datos antes de insertar o actualizar.

CREATE OR REPLACE FUNCTION public._fn_integridad_asistencia_360()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sesion_materia  uuid;
  v_sesion_periodo  uuid;
  v_insc_materia    uuid;
  v_insc_periodo    uuid;
BEGIN
  SELECT s.materia_360_id, s.periodo_id
    INTO v_sesion_materia, v_sesion_periodo
    FROM public.sesion_360 s
   WHERE s.id = NEW.sesion_id;

  SELECT i.materia_id, i.periodo_id
    INTO v_insc_materia, v_insc_periodo
    FROM public.inscripcion_360 i
   WHERE i.id = NEW.inscripcion_id;

  IF v_sesion_materia IS DISTINCT FROM v_insc_materia
     OR (v_insc_periodo IS NOT NULL AND v_sesion_periodo IS DISTINCT FROM v_insc_periodo) THEN
    RAISE EXCEPTION
      'public.asistencia_360: la inscripción (%) no pertenece a la misma materia y período de la sesión (%).',
      NEW.inscripcion_id, NEW.sesion_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_integridad_asistencia_360 ON public.asistencia_360;
CREATE TRIGGER tg_integridad_asistencia_360
  BEFORE INSERT OR UPDATE ON public.asistencia_360
  FOR EACH ROW EXECUTE FUNCTION public._fn_integridad_asistencia_360();

