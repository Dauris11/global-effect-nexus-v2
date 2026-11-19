-- ================================================================
-- PORTAL GLOBALEFFECT — 0087 · Circuito Universitario de Transporte (TIMOB)
-- ================================================================
-- Actualiza las rutas y paradas oficiales del transporte institucional
-- para conectar en vivo el Edificio Fundación Global Effect con las
-- universidades del programa (UNPHU, UASD, UCATECI y UTESA), conservando
-- la integridad referencial de las inscripciones y viajes existentes.
-- ================================================================

DO $$
DECLARE
  v_ruta_principal uuid;
  v_ruta_inversa uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
  v_p4 uuid;
  v_p5 uuid;
BEGIN
  SELECT id INTO v_ruta_principal FROM public.transporte_ruta WHERE codigo = 'RUTA_PRINCIPAL' LIMIT 1;
  SELECT id INTO v_ruta_inversa   FROM public.transporte_ruta WHERE codigo = 'RUTA_INVERSA'   LIMIT 1;

  IF v_ruta_principal IS NOT NULL THEN
    UPDATE public.transporte_ruta
       SET nombre = 'Circuito Universitario: Edificio Global Effect – UNPHU – UASD – UCATECI – UTESA',
           descripcion = 'Recorrido institucional en vivo entre el Edificio Fundación Global Effect y los recintos universitarios UNPHU, UASD, UCATECI y UTESA en La Vega.'
     WHERE id = v_ruta_principal;

    -- Asegurar que existan las 5 paradas base (orden 1..5)
    UPDATE public.transporte_parada
       SET nombre = 'Edificio Fundación Global Effect',
           referencia = 'Av. Pedro A. Rivera #325, Sede Central La Vega',
           lat = 19.224800,
           lng = -70.525500,
           minutos_estimados = 0
     WHERE ruta_id = v_ruta_principal AND orden = 1
     RETURNING id INTO v_p1;

    UPDATE public.transporte_parada
       SET nombre = 'UNPHU — Recinto La Vega',
           referencia = 'Av. Federico García Godoy #71, Villa Fresca',
           lat = 19.221500,
           lng = -70.527300,
           minutos_estimados = 6
     WHERE ruta_id = v_ruta_principal AND orden = 2
     RETURNING id INTO v_p2;

    UPDATE public.transporte_parada
       SET nombre = 'UASD — Centro La Vega',
           referencia = 'Av. Monseñor Panal esq. José Cabrera',
           lat = 19.218800,
           lng = -70.531200,
           minutos_estimados = 12
     WHERE ruta_id = v_ruta_principal AND orden = 3
     RETURNING id INTO v_p3;

    UPDATE public.transporte_parada
       SET nombre = 'UCATECI — Campus Universitario',
           referencia = 'Av. Universitaria esq. Av. Pedro A. Rivera, Las Carolinas',
           lat = 19.231800,
           lng = -70.518700,
           minutos_estimados = 18
     WHERE ruta_id = v_ruta_principal AND orden = 4
     RETURNING id INTO v_p4;

    UPDATE public.transporte_parada
       SET nombre = 'UTESA — Recinto / Conexión Universitaria',
           referencia = 'Av. Pedro A. Rivera esq. Autopista Duarte',
           lat = 19.236800,
           lng = -70.514200,
           minutos_estimados = 25
     WHERE ruta_id = v_ruta_principal AND orden = 5
     RETURNING id INTO v_p5;

    -- Reasignar referencias de paradas antiguas (orden > 5) antes de depurarlas
    IF v_p1 IS NOT NULL AND v_p4 IS NOT NULL THEN
      UPDATE public.transporte_viaje
         SET parada_actual_id = v_p4
       WHERE parada_actual_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_principal AND orden > 5
       );

      UPDATE public.transporte_inscripcion_recurrente
         SET parada_abordaje_id = CASE WHEN parada_destino_id = v_p4 THEN v_p2 ELSE v_p4 END
       WHERE parada_abordaje_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_principal AND orden > 5
       );

      UPDATE public.transporte_inscripcion_recurrente
         SET parada_destino_id = CASE WHEN parada_abordaje_id = v_p1 THEN v_p4 ELSE v_p1 END
       WHERE parada_destino_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_principal AND orden > 5
       );

      UPDATE public.transporte_inscripcion_diaria
         SET parada_abordaje_id = CASE WHEN parada_destino_id = v_p4 THEN v_p2 ELSE v_p4 END
       WHERE parada_abordaje_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_principal AND orden > 5
       );

      UPDATE public.transporte_inscripcion_diaria
         SET parada_destino_id = CASE WHEN parada_abordaje_id = v_p1 THEN v_p4 ELSE v_p1 END
       WHERE parada_destino_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_principal AND orden > 5
       );

      DELETE FROM public.transporte_parada
       WHERE ruta_id = v_ruta_principal AND orden > 5;
    END IF;
  END IF;

  IF v_ruta_inversa IS NOT NULL THEN
    UPDATE public.transporte_ruta
       SET nombre = 'Circuito Universitario (Retorno): UTESA – UCATECI – UASD – UNPHU – Edificio Global Effect',
           descripcion = 'Recorrido de retorno desde los recintos universitarios hacia el Edificio Fundación Global Effect en La Vega.'
     WHERE id = v_ruta_inversa;

    UPDATE public.transporte_parada
       SET nombre = 'UTESA — Recinto / Conexión Universitaria',
           referencia = 'Av. Pedro A. Rivera esq. Autopista Duarte',
           lat = 19.236800,
           lng = -70.514200,
           minutos_estimados = 0
     WHERE ruta_id = v_ruta_inversa AND orden = 1
     RETURNING id INTO v_p1;

    UPDATE public.transporte_parada
       SET nombre = 'UCATECI — Campus Universitario',
           referencia = 'Av. Universitaria esq. Av. Pedro A. Rivera, Las Carolinas',
           lat = 19.231800,
           lng = -70.518700,
           minutos_estimados = 7
     WHERE ruta_id = v_ruta_inversa AND orden = 2
     RETURNING id INTO v_p2;

    UPDATE public.transporte_parada
       SET nombre = 'UASD — Centro La Vega',
           referencia = 'Av. Monseñor Panal esq. José Cabrera',
           lat = 19.218800,
           lng = -70.531200,
           minutos_estimados = 14
     WHERE ruta_id = v_ruta_inversa AND orden = 3
     RETURNING id INTO v_p3;

    UPDATE public.transporte_parada
       SET nombre = 'UNPHU — Recinto La Vega',
           referencia = 'Av. Federico García Godoy #71, Villa Fresca',
           lat = 19.221500,
           lng = -70.527300,
           minutos_estimados = 20
     WHERE ruta_id = v_ruta_inversa AND orden = 4
     RETURNING id INTO v_p4;

    UPDATE public.transporte_parada
       SET nombre = 'Edificio Fundación Global Effect',
           referencia = 'Av. Pedro A. Rivera #325, Sede Central La Vega',
           lat = 19.224800,
           lng = -70.525500,
           minutos_estimados = 25
     WHERE ruta_id = v_ruta_inversa AND orden = 5
     RETURNING id INTO v_p5;

    IF v_p1 IS NOT NULL AND v_p5 IS NOT NULL THEN
      UPDATE public.transporte_viaje
         SET parada_actual_id = v_p2
       WHERE parada_actual_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_inversa AND orden > 5
       );

      UPDATE public.transporte_inscripcion_recurrente
         SET parada_abordaje_id = CASE WHEN parada_destino_id = v_p2 THEN v_p3 ELSE v_p2 END
       WHERE parada_abordaje_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_inversa AND orden > 5
       );

      UPDATE public.transporte_inscripcion_recurrente
         SET parada_destino_id = CASE WHEN parada_abordaje_id = v_p5 THEN v_p2 ELSE v_p5 END
       WHERE parada_destino_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_inversa AND orden > 5
       );

      UPDATE public.transporte_inscripcion_diaria
         SET parada_abordaje_id = CASE WHEN parada_destino_id = v_p2 THEN v_p3 ELSE v_p2 END
       WHERE parada_abordaje_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_inversa AND orden > 5
       );

      UPDATE public.transporte_inscripcion_diaria
         SET parada_destino_id = CASE WHEN parada_abordaje_id = v_p5 THEN v_p2 ELSE v_p5 END
       WHERE parada_destino_id IN (
         SELECT id FROM public.transporte_parada WHERE ruta_id = v_ruta_inversa AND orden > 5
       );

      DELETE FROM public.transporte_parada
       WHERE ruta_id = v_ruta_inversa AND orden > 5;
    END IF;
  END IF;
END $$;
