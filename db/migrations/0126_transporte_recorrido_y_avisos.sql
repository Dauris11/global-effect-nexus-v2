-- 0126 · Recorrido real de la guagua y avisos a los pasajeros.
--
-- La guagua solo va a UCATECI y a la oficina de la Fundación. El viaje sale de
-- la casa del chofer (su posición en vivo, no una parada), baja por la autopista
-- a Controba, Rincón y Jima Abajo, se devuelve por La Ceivita, El Ranchito y
-- Sabana Rey, entra por dentro de El Ranchito a La Vega y termina en UCATECI y
-- en la oficina. Se reordenan las paradas de la ruta principal SIN cambiar sus
-- ids: las inscripciones apuntan a ellos.

DO $$
DECLARE
  v_ruta uuid;
BEGIN
  SELECT id INTO v_ruta FROM public.transporte_ruta WHERE codigo = 'RUTA_PRINCIPAL';
  IF v_ruta IS NULL THEN
    RETURN;
  END IF;

  -- Primero se apartan los órdenes: (ruta_id, orden) es único.
  UPDATE public.transporte_parada SET orden = orden + 100 WHERE ruta_id = v_ruta;

  UPDATE public.transporte_parada p
     SET orden = n.orden, minutos_estimados = n.minutos
    FROM (VALUES
      ('Cruce de Controba',                        1,  20),
      ('Rincón',                                   2,  35),
      ('Jima Abajo (Cimabajo)',                    3,  50),
      ('La Ceivita (La Cevita)',                   4,  65),
      ('El Ranchito',                              5,  78),
      ('Sabana Rey',                               6,  92),
      ('Camino por dentro / Periferia',            7, 105),
      ('UCATECI',                                  8, 120),
      ('Oficina Central Fundación Global Effect',  9, 130)
    ) AS n(nombre, orden, minutos)
   WHERE p.ruta_id = v_ruta AND p.nombre = n.nombre;
END $$;

-- Un aviso por viaje, tipo y parada: la posición llega cada pocos segundos y
-- sin esto cada lectura repetiría la notificación.
CREATE TABLE IF NOT EXISTS public.transporte_aviso (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id   uuid NOT NULL REFERENCES public.transporte_viaje(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN ('arranco', 'paso', 'llegando')),
  parada_id  uuid REFERENCES public.transporte_parada(id) ON DELETE CASCADE,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_transporte_aviso
  ON public.transporte_aviso (viaje_id, tipo, COALESCE(parada_id, '00000000-0000-0000-0000-000000000000'::uuid));
