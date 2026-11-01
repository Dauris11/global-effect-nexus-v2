-- ================================================================
-- GLOBAL EFFECT NEXUS — 0066 · Transporte: nombres cortos e inscripción de terceros
-- ================================================================
-- 1. Los cuatro turnos pasan a llevar un nombre corto y definido; la hora
--    ya se muestra al lado en cada selector, así que no se repite en el nombre.
-- 2. Una inscripción diaria ahora dice quién la hizo y por qué vía llegó:
--      publica     la puerta pública /transporte, sin sesión
--      estudiante  un estudiante inscribió a otra persona desde su portal
--      asistida    el chofer o administración anotó a quien no tiene internet
-- ================================================================

UPDATE public.transporte_horario SET nombre = 'Mañana'   WHERE codigo = 'VIAJE_06AM';
UPDATE public.transporte_horario SET nombre = 'Mediodía' WHERE codigo = 'VIAJE_12M';
UPDATE public.transporte_horario SET nombre = 'Tarde'    WHERE codigo = 'VIAJE_06PM';
UPDATE public.transporte_horario SET nombre = 'Noche'    WHERE codigo = 'VIAJE_08PM';

ALTER TABLE public.transporte_inscripcion_diaria
  ADD COLUMN IF NOT EXISTS inscrito_por UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS via VARCHAR(12) NOT NULL DEFAULT 'publica';

ALTER TABLE public.transporte_inscripcion_diaria
  DROP CONSTRAINT IF EXISTS transporte_inscripcion_diaria_via_check;
ALTER TABLE public.transporte_inscripcion_diaria
  ADD CONSTRAINT transporte_inscripcion_diaria_via_check
  CHECK (via IN ('publica', 'estudiante', 'asistida'));

CREATE INDEX IF NOT EXISTS idx_transporte_diaria_inscrito_por
  ON public.transporte_inscripcion_diaria (inscrito_por, fecha)
  WHERE inscrito_por IS NOT NULL;

-- Origen y destino distintos también a nivel de base: la pantalla ya lo exige,
-- pero un registro que sube y baja en la misma parada no significa nada.
ALTER TABLE public.transporte_inscripcion_diaria
  DROP CONSTRAINT IF EXISTS transporte_diaria_paradas_distintas;
ALTER TABLE public.transporte_inscripcion_diaria
  ADD CONSTRAINT transporte_diaria_paradas_distintas
  CHECK (parada_abordaje_id <> parada_destino_id) NOT VALID;

ALTER TABLE public.transporte_inscripcion_recurrente
  DROP CONSTRAINT IF EXISTS transporte_recurrente_paradas_distintas;
ALTER TABLE public.transporte_inscripcion_recurrente
  ADD CONSTRAINT transporte_recurrente_paradas_distintas
  CHECK (parada_abordaje_id <> parada_destino_id) NOT VALID;
