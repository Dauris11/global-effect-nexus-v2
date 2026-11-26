-- 0127 · La guagua solo va a UCATECI y a la oficina de la Fundación.
--
-- La 0087 la había convertido en un circuito entre la Fundación y cuatro
-- universidades (UNPHU, UASD, UCATECI y UTESA) y la 0126 reordenó paradas que ya
-- no existían. Aquí se deja el recorrido real, en orden:
--   Controba → Rincón → Jima Abajo → La Ceivita → El Ranchito → Sabana Rey →
--   camino por dentro de El Ranchito → UCATECI → oficina de la Fundación.
-- La salida es la posición en vivo del chofer, no una parada.
--
-- LAS COORDENADAS DE LAS PARADAS NUEVAS SON APROXIMADAS: hay que ajustarlas
-- sobre el mapa con el chofer en el sitio. Las inscripciones y los viajes que
-- apuntaban a las otras universidades pasan a UCATECI para no romper su
-- integridad; coordinación debe revisar esas paradas de abordaje.

DO $$
DECLARE
  v_ruta uuid;
  v_ucateci uuid;
  v_fundacion uuid;
BEGIN
  SELECT id INTO v_ruta FROM public.transporte_ruta WHERE codigo = 'RUTA_PRINCIPAL';
  IF v_ruta IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_ucateci FROM public.transporte_parada
   WHERE ruta_id = v_ruta AND nombre ILIKE 'UCATECI%' LIMIT 1;
  SELECT id INTO v_fundacion FROM public.transporte_parada
   WHERE ruta_id = v_ruta AND nombre ILIKE '%Fundaci%' LIMIT 1;

  IF v_ucateci IS NULL OR v_fundacion IS NULL THEN
    RAISE EXCEPTION 'La ruta principal no tiene UCATECI o la Fundación';
  END IF;

  -- Todo lo que apuntaba a otra universidad pasa a UCATECI.
  UPDATE public.transporte_inscripcion_recurrente SET parada_abordaje_id = v_ucateci
   WHERE parada_abordaje_id IN (SELECT id FROM public.transporte_parada WHERE nombre ~* '^(UNPHU|UASD|UTESA)');
  UPDATE public.transporte_inscripcion_recurrente SET parada_destino_id = v_ucateci
   WHERE parada_destino_id IN (SELECT id FROM public.transporte_parada WHERE nombre ~* '^(UNPHU|UASD|UTESA)');
  UPDATE public.transporte_inscripcion_diaria SET parada_abordaje_id = v_ucateci
   WHERE parada_abordaje_id IN (SELECT id FROM public.transporte_parada WHERE nombre ~* '^(UNPHU|UASD|UTESA)');
  UPDATE public.transporte_inscripcion_diaria SET parada_destino_id = v_ucateci
   WHERE parada_destino_id IN (SELECT id FROM public.transporte_parada WHERE nombre ~* '^(UNPHU|UASD|UTESA)');
  UPDATE public.transporte_viaje SET parada_actual_id = NULL
   WHERE parada_actual_id IN (SELECT id FROM public.transporte_parada WHERE nombre ~* '^(UNPHU|UASD|UTESA)');

  DELETE FROM public.transporte_parada WHERE nombre ~* '^(UNPHU|UASD|UTESA)';

  -- La ruta inversa ya no tiene sentido sin esas paradas y ningún horario la usa.
  UPDATE public.transporte_ruta SET activo = false WHERE codigo = 'RUTA_INVERSA';

  UPDATE public.transporte_ruta
     SET nombre = 'Recorrido: comunidades – La Vega – UCATECI – Fundación',
         descripcion = 'Sale de la posición del chofer, baja por la autopista a Controba, Rincón y Jima Abajo, se devuelve por La Ceivita, El Ranchito y Sabana Rey, entra por dentro de El Ranchito a La Vega y termina en UCATECI y en la oficina de la Fundación.'
   WHERE id = v_ruta;

  -- Paradas nuevas (coordenadas aproximadas) con un orden que no choca.
  INSERT INTO public.transporte_parada (ruta_id, orden, nombre, referencia, lat, lng, minutos_estimados)
  SELECT v_ruta, n.orden + 200, n.nombre, n.referencia, n.lat, n.lng, n.minutos
    FROM (VALUES
      ('Cruce de Controba',              1, 'Autopista Duarte, entrada a Rincón', 19.182000, -70.472000,  20),
      ('Rincón',                         2, 'Parque central de Rincón',           19.155000, -70.408000,  35),
      ('Jima Abajo',                     3, 'Centro de Jima Abajo',               19.133000, -70.380000,  50),
      ('La Ceivita',                     4, 'Carretera principal de La Ceivita',  19.152000, -70.355000,  65),
      ('El Ranchito',                    5, 'Cruce de El Ranchito',               19.185000, -70.362000,  78),
      ('Sabana Rey',                     6, 'Entrada de Sabana Rey',              19.208000, -70.395000,  92),
      ('Camino por dentro de El Ranchito', 7, 'Conexión interior hacia La Vega',  19.220000, -70.470000, 105)
    ) AS n(nombre, orden, referencia, lat, lng, minutos)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.transporte_parada p WHERE p.ruta_id = v_ruta AND p.nombre = n.nombre
   );

  UPDATE public.transporte_parada SET orden = orden - 200 WHERE ruta_id = v_ruta AND orden > 200;
  UPDATE public.transporte_parada SET orden = 8, minutos_estimados = 120 WHERE id = v_ucateci;
  UPDATE public.transporte_parada SET orden = 9, minutos_estimados = 130 WHERE id = v_fundacion;
END $$;
