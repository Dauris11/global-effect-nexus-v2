-- 0128 · La oficina de la Fundación está junto a Gold's Gym, cerca de UCATECI
-- (Av. Pedro A. Rivera, La Vega). Coordenadas de OpenStreetMap (way 414210887).
UPDATE public.transporte_parada
   SET lat = 19.227441,
       lng = -70.523918,
       referencia = 'Junto a Gold''s Gym, Av. Pedro A. Rivera (cerca de UCATECI)'
 WHERE nombre ILIKE '%Fundaci%';
