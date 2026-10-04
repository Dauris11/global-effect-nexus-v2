-- ================================================================
-- GLOBAL EFFECT NEXUS — 0021 · Psicólogo asignado al estudiante
-- ================================================================
-- Hasta ahora `cita_psicologia.psicologo_id` se llenaba solo cuando el
-- propio psicólogo creaba la cita desde su módulo. Cuando el joven la
-- pedía desde su portal, la cita nacía huérfana: sin psicólogo, no hay
-- a quién avisar y nadie la ve como suya hasta que alguien la reclama a
-- mano.
--
-- Este es el vínculo que faltaba: cada estudiante tiene un psicólogo de
-- cabecera. La cita que él solicita se asigna sola a esa persona, que
-- recibe el correo y la notificación interna.
--
-- Por qué en `estudiante` y no en una tabla de asignaciones:
--
--   • La relación es 1:1 y vigente —un joven tiene UN psicólogo ahora
--     mismo—, no un histórico que haya que consultar. Una tabla aparte
--     obligaría a un `ORDER BY vigente_desde DESC LIMIT 1` en cada
--     lectura para responder la única pregunta que se hace.
--
--   • El histórico de quién lo atendió ya existe y es más fiel: son las
--     citas mismas (`cita_psicologia.psicologo_id`), que registran quién
--     lo vio de verdad, no a quién estaba asignado en el papel.
--
-- `ON DELETE SET NULL` y no CASCADE: si el psicólogo se va de la
-- Fundación, sus estudiantes se quedan sin asignar —hay que reasignarlos—
-- pero no se borra a nadie. El expediente del joven no depende de que su
-- psicólogo siga trabajando aquí.
-- ================================================================

ALTER TABLE estudiante
  ADD COLUMN psicologo_id UUID REFERENCES usuario(id) ON DELETE SET NULL;

COMMENT ON COLUMN estudiante.psicologo_id IS
  'Psicólogo de cabecera. Recibe las citas que el estudiante solicita desde su portal.';

-- Se consulta al revés de lo habitual: "dame los estudiantes de este
-- psicólogo" (su bandeja), no "dame el psicólogo de este estudiante".
CREATE INDEX idx_estudiante_psicologo ON estudiante(psicologo_id);

-- ---------------------------------------------------------------
-- Origen de la cita
-- ---------------------------------------------------------------
-- Una cita que pidió el joven y otra que agendó el psicólogo no son lo
-- mismo para quien mira la agenda: la primera está esperando que alguien
-- la confirme. Sin esta columna, ambas se ven idénticas en estado
-- 'programada' y la solicitud se pierde entre las citas ya pactadas.
ALTER TABLE cita_psicologia
  ADD COLUMN solicitada_por_estudiante BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN cita_psicologia.solicitada_por_estudiante IS
  'TRUE si la pidió el propio joven desde su portal; FALSE si la agendó el equipo.';

-- El motivo que el estudiante escribe al pedirla. Va aquí y no en
-- `nota_psicologica` a propósito: esa tabla es la nota clínica del
-- psicólogo —contenido confidencial que el joven no escribe ni lee—.
-- Esto es lo que él mismo dijo al pedir la cita.
ALTER TABLE cita_psicologia
  ADD COLUMN motivo_estudiante TEXT;

COMMENT ON COLUMN cita_psicologia.motivo_estudiante IS
  'Lo que el estudiante escribió al solicitar la cita. No es nota clínica.';
