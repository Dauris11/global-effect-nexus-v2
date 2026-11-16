-- 0084 · Toda solicitud de tipo `compra` debe llevar su cotización en `solicitud_adjunto`.
--
-- `crearCompra` inserta primero en `solicitud` y enseguida en
-- `solicitud_adjunto` dentro de la misma transacción. Un disparador de
-- restricción DIFERIDO (`DEFERRABLE INITIALLY DEFERRED`) se ejecuta al hacer
-- `COMMIT`, garantizando en la base de datos que ninguna compra quede guardada
-- sin su archivo adjunto.

CREATE OR REPLACE FUNCTION public._fn_solicitud_compra_con_adjunto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tipo = 'compra'
     AND NOT EXISTS (
       SELECT 1
         FROM public.solicitud_adjunto a
        WHERE a.solicitud_id = NEW.id
     ) THEN
    RAISE EXCEPTION
      'public.solicitud: una solicitud de tipo compra (%) exige cotización adjunta en solicitud_adjunto.',
      NEW.id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_solicitud_compra_con_adjunto ON public.solicitud;
CREATE CONSTRAINT TRIGGER tg_solicitud_compra_con_adjunto
  AFTER INSERT OR UPDATE OF tipo ON public.solicitud
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.tipo = 'compra')
  EXECUTE FUNCTION public._fn_solicitud_compra_con_adjunto();
