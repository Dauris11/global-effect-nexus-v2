-- 0080 · Asientos "Sin procesar" y "Procesado" (Observaciones #1 de Contabilidad).
--
-- Antes todo asiento entraba a los libros en cuanto se registraba y la lista
-- decía "Vigente". El departamento trabaja como en papel: el asiento se
-- revisa y se PROCESA (pasa al mayor); hasta entonces no cuenta en el
-- diario, el mayor, la balanza ni los estados financieros.
--
-- `procesado_en` NULL = sin procesar. Los asientos que ya existían quedan
-- procesados: ya estaban en los libros y sacarlos ahora cambiaría balances
-- que alguien pudo haber presentado. Se rellenan con el DEFAULT del ALTER
-- (que no dispara los disparadores por fila, así que también entran los de
-- períodos cerrados) y enseguida se quita el DEFAULT para que lo nuevo
-- nazca sin procesar.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'contabilidad' AND table_name = 'asiento'
       AND column_name = 'procesado_en'
  ) THEN
    ALTER TABLE contabilidad.asiento
      ADD COLUMN procesado_en timestamptz DEFAULT now(),
      ADD COLUMN procesado_por uuid REFERENCES public.usuario(id);
    ALTER TABLE contabilidad.asiento ALTER COLUMN procesado_en DROP DEFAULT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_asiento_sin_procesar
  ON contabilidad.asiento (periodo_id) WHERE procesado_en IS NULL;

-- Un período no se cierra con asientos sin procesar: quedarían fuera de los
-- libros de un mes que ya nadie puede tocar.
CREATE OR REPLACE FUNCTION contabilidad._fn_periodo_sin_pendientes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 'cerrado' AND OLD.estado IS DISTINCT FROM 'cerrado'
     AND EXISTS (SELECT 1 FROM contabilidad.asiento a
                  WHERE a.periodo_id = NEW.id AND a.procesado_en IS NULL AND NOT a.anulado) THEN
    RAISE EXCEPTION
      'contabilidad.periodo_contable: hay asientos sin procesar en el período. Procésalos antes de cerrarlo.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_periodo_sin_pendientes ON contabilidad.periodo_contable;
CREATE TRIGGER tg_periodo_sin_pendientes
  BEFORE UPDATE OF estado ON contabilidad.periodo_contable
  FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_periodo_sin_pendientes();
