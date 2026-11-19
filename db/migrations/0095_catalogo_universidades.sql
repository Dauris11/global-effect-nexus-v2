-- ================================================================
-- PORTAL GLOBALEFFECT — 0095 · Catálogo de universidades y pénsum
-- ================================================================
-- Fase 2 del plan del expediente académico: universidad → carrera →
-- pénsum → materias con créditos, y el vínculo de cada estudiante con
-- ese catálogo. `estudiante.universidad` y `.programa` (texto libre) se
-- conservan: son lo que ya está escrito y el expediente los sigue
-- mostrando hasta que se elija del catálogo.
-- ================================================================

CREATE TABLE universidad (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siglas     TEXT NOT NULL UNIQUE,
  nombre     TEXT NOT NULL,
  -- Cómo parte el año cada universidad; las notas por período (fase 3) se
  -- agrupan según esto.
  regimen    TEXT NOT NULL DEFAULT 'cuatrimestre'
             CHECK (regimen IN ('cuatrimestre', 'trimestre', 'semestre')),
  activa     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE carrera (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universidad_id UUID NOT NULL REFERENCES universidad(id) ON DELETE RESTRICT,
  nombre        TEXT NOT NULL,
  activa        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universidad_id, nombre)
);
CREATE INDEX idx_carrera_universidad ON carrera(universidad_id);

-- Una carrera puede tener varios pénsums (planes de estudio por año); el
-- estudiante cursa el que estaba vigente cuando entró.
CREATE TABLE pensum (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrera_id UUID NOT NULL REFERENCES carrera(id) ON DELETE RESTRICT,
  version    TEXT NOT NULL,
  vigente    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (carrera_id, version)
);
CREATE INDEX idx_pensum_carrera ON pensum(carrera_id);

CREATE TABLE pensum_materia (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pensum_id       UUID NOT NULL REFERENCES pensum(id) ON DELETE CASCADE,
  codigo          TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  creditos        SMALLINT NOT NULL DEFAULT 3 CHECK (creditos >= 0),
  -- Período del plan en que se recomienda cursarla (1 = primero).
  periodo_sugerido SMALLINT CHECK (periodo_sugerido IS NULL OR periodo_sugerido > 0),
  -- Códigos de otras materias del mismo pénsum; no es FK a propósito: el
  -- pénsum se carga por listas y un prerrequisito puede llegar antes que su fila.
  prerrequisitos  TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pensum_id, codigo)
);
CREATE INDEX idx_pensum_materia_pensum ON pensum_materia(pensum_id);

ALTER TABLE estudiante
  ADD COLUMN universidad_id UUID REFERENCES universidad(id) ON DELETE SET NULL,
  ADD COLUMN carrera_id     UUID REFERENCES carrera(id)     ON DELETE SET NULL,
  ADD COLUMN pensum_id      UUID REFERENCES pensum(id)      ON DELETE SET NULL,
  ADD COLUMN matricula      TEXT;
CREATE INDEX idx_estudiante_universidad ON estudiante(universidad_id);
CREATE INDEX idx_estudiante_pensum ON estudiante(pensum_id);

CREATE TRIGGER trg_universidad_updated BEFORE UPDATE ON universidad FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_carrera_updated     BEFORE UPDATE ON carrera     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pensum_updated      BEFORE UPDATE ON pensum      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Las cuatro del circuito de transporte. El régimen es el de cuatrimestre
-- que usa la Fundación; el admin lo corrige desde la pantalla si alguna
-- universidad parte el año distinto.
INSERT INTO universidad (siglas, nombre) VALUES
  ('UCATECI', 'Universidad Católica Tecnológica del Cibao'),
  ('UNPHU',   'Universidad Nacional Pedro Henríquez Ureña'),
  ('UTESA',   'Universidad Tecnológica de Santiago'),
  ('UASD',    'Universidad Autónoma de Santo Domingo');

-- Enlaza lo ya escrito a mano (siglas o nombre dentro del texto).
UPDATE estudiante e
   SET universidad_id = u.id
  FROM universidad u
 WHERE e.universidad IS NOT NULL
   AND (e.universidad ILIKE '%' || u.siglas || '%' OR e.universidad ILIKE '%' || u.nombre || '%');
