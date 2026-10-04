-- ================================================================
-- GLOBAL EFFECT NEXUS — 0006 · Académico
-- ================================================================
-- Períodos, materias, cursos técnicos, matrícula (inscripcion),
-- calificaciones detalladas e historial académico consolidado (GPA).
-- ================================================================

CREATE TYPE tipo_evaluacion AS ENUM ('examen', 'tarea', 'proyecto', 'participacion', 'final');

-- Períodos / cuatrimestres institucionales
CREATE TABLE periodo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL UNIQUE,   -- '2026-I', '2026-II'
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  estado       TEXT NOT NULL DEFAULT 'planificado',   -- planificado, activo, completado
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

-- Materias académicas (becados universitarios)
CREATE TABLE materia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  codigo          TEXT,
  descripcion     TEXT,
  periodo_id      UUID REFERENCES periodo(id) ON DELETE SET NULL,
  creditos        INTEGER DEFAULT 3 CHECK (creditos >= 0),
  profesor_nombre TEXT,
  estado          TEXT NOT NULL DEFAULT 'activa',   -- activa, inactiva
  horario         TEXT,
  aula            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_materia_periodo ON materia(periodo_id);

-- Cursos técnicos
CREATE TABLE curso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  docente     TEXT,
  periodo_id  UUID REFERENCES periodo(id) ON DELETE SET NULL,
  estado      TEXT NOT NULL DEFAULT 'activo',       -- activo, finalizado, planificado
  capacidad   INTEGER DEFAULT 30 CHECK (capacidad >= 0),
  inscritos   INTEGER DEFAULT 0  CHECK (inscritos >= 0),
  horario     TEXT,
  modalidad   TEXT NOT NULL DEFAULT 'presencial',   -- presencial, virtual, mixto
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_curso_periodo ON curso(periodo_id);

-- Matrícula: estudiante ↔ materia ↔ periodo (prematrícula)
CREATE TABLE inscripcion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  materia_id    UUID NOT NULL REFERENCES materia(id) ON DELETE CASCADE,
  periodo_id    UUID NOT NULL REFERENCES periodo(id) ON DELETE CASCADE,
  estado        TEXT NOT NULL DEFAULT 'activa',   -- activa, retirada, aprobada, reprobada
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, materia_id, periodo_id)
);
CREATE INDEX idx_inscripcion_estudiante ON inscripcion(estudiante_id);
CREATE INDEX idx_inscripcion_materia    ON inscripcion(materia_id);

-- Calificaciones detalladas por evaluación (cursos técnicos)
CREATE TABLE calificacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id   UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  curso_id        UUID NOT NULL REFERENCES curso(id) ON DELETE CASCADE,
  periodo_id      UUID NOT NULL REFERENCES periodo(id) ON DELETE CASCADE,
  nota            NUMERIC(5,2) NOT NULL CHECK (nota >= 0.00 AND nota <= 100.00),
  tipo_evaluacion tipo_evaluacion NOT NULL DEFAULT 'examen',
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calificacion_estudiante ON calificacion(estudiante_id);
CREATE INDEX idx_calificacion_curso      ON calificacion(curso_id);

-- Historial académico consolidado (GPA por materia/cuatrimestre)
CREATE TABLE historial_calificacion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  cuatrimestre  TEXT NOT NULL,   -- '2025-I'
  materia       TEXT NOT NULL,
  nota_numerica NUMERIC(5,2) NOT NULL CHECK (nota_numerica >= 0.00 AND nota_numerica <= 100.00),
  nota_letra    TEXT NOT NULL,   -- A, B, C, D, F
  gpa           NUMERIC(3,2) NOT NULL CHECK (gpa >= 0.00 AND gpa <= 4.00),
  estado        TEXT NOT NULL DEFAULT 'aprobada',   -- aprobada, prueba_academica, reprobada
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_historial_estudiante ON historial_calificacion(estudiante_id);

CREATE TRIGGER trg_periodo_updated      BEFORE UPDATE ON periodo      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_materia_updated      BEFORE UPDATE ON materia      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_curso_updated        BEFORE UPDATE ON curso        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_calificacion_updated BEFORE UPDATE ON calificacion FOR EACH ROW EXECUTE FUNCTION set_updated_at();
