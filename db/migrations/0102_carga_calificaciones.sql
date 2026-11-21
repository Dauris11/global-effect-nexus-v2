-- ================================================================
-- PORTAL GLOBALEFFECT — 0102 · Carga guiada de calificaciones por universidad
-- ================================================================
-- Un administrativo sube el listado de notas de una universidad (PDF, foto o lista
-- pegada); el programa y la IA lo leen, emparejan cada fila con su estudiante y su
-- materia del pénsum y una PERSONA revisa antes de que nada llegue a
-- `resultado_materia`. Aquí vive el borrador de esa revisión.
--
-- El archivo NO se guarda (misma política que el OCR de identidad: una foto de
-- notas es dato personal de muchas personas y no se conserva sin decisión
-- expresa). Solo queda lo leído, que además es lo que se audita.
--
-- Además, parámetros de la universidad para el índice: máximo de la escala y
-- umbrales de alerta del período y del acumulado. NULL = «sin definir» y se usa
-- el umbral global (`becas.indice_minimo`); los define cada administrador en la
-- ficha de la universidad.
-- ================================================================

ALTER TABLE universidad
  ADD COLUMN indice_maximo           NUMERIC(3,2) CHECK (indice_maximo IS NULL OR indice_maximo > 0),
  ADD COLUMN indice_minimo_periodo   NUMERIC(3,2) CHECK (indice_minimo_periodo IS NULL OR indice_minimo_periodo >= 0),
  ADD COLUMN indice_minimo_acumulado NUMERIC(3,2) CHECK (indice_minimo_acumulado IS NULL OR indice_minimo_acumulado >= 0);

-- UCATECI: acumulado máximo 4,00 y régimen por cuatrimestres (indicado por la dirección).
UPDATE universidad SET indice_maximo = 4.00 WHERE siglas = 'UCATECI';

ALTER TABLE resultado_materia DROP CONSTRAINT IF EXISTS resultado_materia_fuente_check;
ALTER TABLE resultado_materia
  ADD CONSTRAINT resultado_materia_fuente_check CHECK (fuente IN ('gradua', 'calificaciones', 'manual', 'carga'));

CREATE TABLE carga_calificaciones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universidad_id UUID NOT NULL REFERENCES universidad(id) ON DELETE CASCADE,
  anio           SMALLINT NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  ronda          SMALLINT NOT NULL CHECK (ronda BETWEEN 1 AND 3),
  medio          TEXT NOT NULL CHECK (medio IN ('pdf', 'imagen', 'lista')),
  estado         TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'confirmada', 'descartada')),
  creado_por     UUID REFERENCES usuario(id) ON DELETE SET NULL,
  confirmada_por UUID REFERENCES usuario(id) ON DELETE SET NULL,
  confirmada_at  TIMESTAMPTZ,
  -- Cuántas notas se escribieron al confirmar, para la bitácora y la pantalla.
  escritas       INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_carga_calificaciones_estado ON carga_calificaciones(estado, created_at DESC);
CREATE TRIGGER trg_carga_calificaciones_updated BEFORE UPDATE ON carga_calificaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE carga_calificaciones_fila (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id      UUID NOT NULL REFERENCES carga_calificaciones(id) ON DELETE CASCADE,
  orden         INTEGER NOT NULL,
  -- Lo que se leyó, tal cual.
  matricula     TEXT,
  nombre_leido  TEXT,
  codigo_leido  TEXT,
  materia_leida TEXT,
  letra         TEXT,
  nota          NUMERIC(5,2) CHECK (nota IS NULL OR nota BETWEEN 0 AND 100),
  confianza     SMALLINT CHECK (confianza IS NULL OR confianza BETWEEN 0 AND 100),
  -- Lo que el programa resolvió. `estudiante_id` NULL = sin emparejar (se elige a mano).
  estudiante_id UUID REFERENCES estudiante(id) ON DELETE SET NULL,
  codigo        TEXT,
  -- Cómo se emparejó al estudiante: por matrícula, por nombre único o a mano.
  emparejado_por TEXT CHECK (emparejado_por IS NULL OR emparejado_por IN ('matricula', 'nombre', 'manual')),
  problemas     TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (carga_id, orden)
);
CREATE INDEX idx_carga_fila_carga ON carga_calificaciones_fila(carga_id);
