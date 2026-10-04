-- ================================================================
-- GLOBAL EFFECT NEXUS — 0024 · Confirmación de la cita solicitada
-- ================================================================
-- La migración 0021 dejó que el joven pida cita desde su portal
-- (`solicitada_por_estudiante`, `motivo_estudiante`), pero no dejó
-- forma de decir "ya la vimos y esta es la hora".
--
-- El hueco se nota en las dos pantallas:
--
--   · En la bandeja de psicología, una solicitud recién llegada y otra
--     ya pactada están las dos en estado 'programada'. Sin una marca de
--     atendida, la lista de pendientes no se vacía nunca y hay que
--     recordar de memoria a quién ya se le contestó.
--
--   · En el portal del estudiante, "hora por confirmar" se decidía por
--     `hora IS NULL`. Pero la hora que él manda al pedir la cita es una
--     preferencia y se guarda en esa misma columna, así que quien
--     proponía una hora veía su cita como confirmada desde el primer
--     momento, sin que nadie la hubiera mirado.
--
-- Se añaden dos columnas y no un estado nuevo: 'programada' sigue
-- describiendo bien la cita —está en la agenda—, y lo que faltaba era
-- saber si el equipo ya la revisó. Meterlo en `estado` habría obligado a
-- que toda consulta que hoy busca 'programada' entienda dos valores.
-- ================================================================

ALTER TABLE cita_psicologia
  ADD COLUMN confirmada_en TIMESTAMPTZ,
  ADD COLUMN confirmada_por_id UUID REFERENCES usuario(id) ON DELETE SET NULL;

COMMENT ON COLUMN cita_psicologia.confirmada_en IS
  'Cuándo el equipo de psicología revisó y confirmó la cita. NULL en una solicitud del estudiante que nadie ha atendido todavía.';

COMMENT ON COLUMN cita_psicologia.confirmada_por_id IS
  'Quién la confirmó. Se queda en NULL si esa cuenta se elimina; la cita sigue confirmada.';

-- Las citas que agenda el propio equipo nacen confirmadas: las escribió
-- quien las atiende. Sin esto, todo el historial anterior aparecería como
-- pendiente de revisar en la bandeja el día que se despliegue.
UPDATE cita_psicologia
   SET confirmada_en = created_at
 WHERE NOT solicitada_por_estudiante
   AND confirmada_en IS NULL;

-- La bandeja pregunta siempre por lo mismo: solicitudes del estudiante,
-- programadas y sin confirmar. Índice parcial para que ese filtro no
-- recorra la tabla entera cuando el historial crezca.
CREATE INDEX idx_cita_psico_sin_confirmar
  ON cita_psicologia (fecha)
  WHERE solicitada_por_estudiante AND confirmada_en IS NULL;
