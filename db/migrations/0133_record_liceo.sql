-- ================================================================
-- PORTAL GLOBALEFFECT — 0133 · Récord de notas de secundaria (liceo)
-- ================================================================
-- El récord que el MINERD certifica por grado (1.º a 6.º), con las notas de cada
-- materia o módulo técnico y el centro de procedencia de CADA grado (un
-- estudiante puede haber pasado por varios liceos).
--
-- Tres cosas, y ninguna toca el índice universitario:
--   1. `record_liceo` (uno por estudiante), `record_liceo_grado` y
--      `record_liceo_nota`: lo CONFIRMADO. El borrador de una lectura con IA o de
--      una captura a mano vive en `record_liceo.borrador` (JSONB) hasta que una
--      persona lo revisa y lo confirma; nada llega a las tablas de abajo sin eso.
--   2. `estudiante.promedio_secundaria` (global: suma de todas las notas entre la
--      cantidad de notas) y `estudiante.promedio_secundaria_anual` (promedio de
--      los promedios de cada grado). Se calculan en el servidor al confirmar, con
--      la misma función que usa la pantalla. Escala 0–100: NO alimentan
--      `indice_estudiante()`, `historial_calificacion` ni `becas.indice_minimo`
--      (el índice universitario es sobre 4,00 y tiene su propia regla).
--   3. Las fotos del récord van en `archivo_academico` (tipo `record_notas`) con
--      su `mime` (ya no son solo PDF), el récord al que pertenecen y `pendiente`
--      mientras no se haya confirmado la lectura (si se descarta, se borran).
--
-- Idempotente.
-- ================================================================

CREATE TABLE IF NOT EXISTS record_liceo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id   UUID NOT NULL UNIQUE REFERENCES estudiante(id) ON DELETE CASCADE,
  -- Lo que se leyó o se escribió y aún no se confirmó. NULL = no hay borrador.
  borrador        JSONB,
  confirmado_por  UUID REFERENCES usuario(id) ON DELETE SET NULL,
  confirmado_at   TIMESTAMPTZ,
  creado_por      UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un bloque por grado cursado. La clave incluye el año escolar y el centro: así
-- un grado repetido, o un cambio de liceo a mitad del camino, no se pisan.
CREATE TABLE IF NOT EXISTS record_liceo_grado (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id    UUID NOT NULL REFERENCES record_liceo(id) ON DELETE CASCADE,
  grado        SMALLINT NOT NULL CHECK (grado BETWEEN 1 AND 6),
  anio_inicio  SMALLINT NOT NULL CHECK (anio_inicio BETWEEN 1990 AND 2100),
  anio_fin     SMALLINT NOT NULL CHECK (anio_fin = anio_inicio + 1),
  centro       TEXT NOT NULL CHECK (length(btrim(centro)) > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_record_liceo_grado
  ON record_liceo_grado (record_id, grado, anio_inicio, lower(btrim(centro)));

CREATE TABLE IF NOT EXISTS record_liceo_nota (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grado_id   UUID NOT NULL REFERENCES record_liceo_grado(id) ON DELETE CASCADE,
  orden      SMALLINT NOT NULL CHECK (orden > 0),
  materia    TEXT NOT NULL CHECK (length(btrim(materia)) > 0),
  es_modulo  BOOLEAN NOT NULL DEFAULT false,
  nota       NUMERIC(5,2) NOT NULL CHECK (nota BETWEEN 0 AND 100),
  UNIQUE (grado_id, orden)
);

ALTER TABLE estudiante
  ADD COLUMN IF NOT EXISTS promedio_secundaria       NUMERIC(5,2) CHECK (promedio_secundaria BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS promedio_secundaria_anual NUMERIC(5,2) CHECK (promedio_secundaria_anual BETWEEN 0 AND 100);

ALTER TABLE archivo_academico
  ADD COLUMN IF NOT EXISTS mime TEXT NOT NULL DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS record_liceo_id UUID REFERENCES record_liceo(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pendiente BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_archivo_academico_record_liceo
  ON archivo_academico(record_liceo_id) WHERE record_liceo_id IS NOT NULL;
