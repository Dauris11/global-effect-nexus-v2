-- ================================================================
-- GLOBAL EFFECT NEXUS — 0027 · Global Effect 360
-- ================================================================
-- Programa de materias técnicas que los BECADOS UNIVERSITARIOS deben
-- cursar a lo largo de su carrera: cuatro obligatorias y el resto
-- opcionales. El estudiante ve en su portal lo que ya dio, lo que le
-- falta, y se prematricula desde ahí cuando la ventana está abierta.
--
-- Por qué tablas propias y no las que ya hay:
--
--   · `materia` es de la carrera universitaria del becado (cuelga de
--     `inscripcion` → `materia` y de ahí sale su índice académico). Una
--     materia de 360 no cuenta para ese índice: es formación técnica de
--     la Fundación, con su propia obligatoriedad.
--   · `curso` es el curso técnico del estudiante `regular`, con cupo,
--     docente e `inscritos`, y cuelga de `calificacion`. Meter 360 ahí
--     mezclaría dos programas con reglas distintas en la misma tabla y
--     rompería el recuento de cupos.
--
-- Los estudiantes de curso técnico NO entran en 360: llevan sus propias
-- métricas. La restricción no se puede expresar en una clave ajena
-- —depende de `estudiante.tipo`— así que la impone un CHECK con función
-- y, sobre todo, el servidor.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Catálogo de materias del programa
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materia_360 (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  codigo      TEXT UNIQUE,
  descripcion TEXT,
  -- Cuatro son obligatorias. El número no se fija aquí: se cuenta, para
  -- que administración pueda corregir el catálogo sin migrar nada.
  obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
  creditos    INTEGER NOT NULL DEFAULT 0 CHECK (creditos >= 0),
  horas       INTEGER CHECK (horas IS NULL OR horas > 0),
  -- Una materia retirada del programa deja de ofrecerse, pero no se
  -- borra: las inscripciones pasadas siguen apuntando a ella.
  activa      BOOLEAN NOT NULL DEFAULT TRUE,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materia_360_activa
  ON materia_360(activa, obligatoria, orden);

-- ----------------------------------------------------------------
-- 2) Ventanas de prematrícula
-- ----------------------------------------------------------------
-- Con hora, no solo fecha: el anuncio dice "del 1 al 5 de septiembre,
-- de 8:00 a 17:00", y `abre`/`cierra` en TIMESTAMPTZ es lo único que
-- permite decir eso y compararlo sin depender de la zona del proceso.
CREATE TABLE IF NOT EXISTS ventana_prematricula (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES periodo(id) ON DELETE CASCADE,
  abre       TIMESTAMPTZ NOT NULL,
  cierra     TIMESTAMPTZ NOT NULL,
  -- Nota opcional para el anuncio, por si hay algo que aclarar.
  mensaje    TEXT,
  activa     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cierra > abre)
);
CREATE INDEX IF NOT EXISTS idx_ventana_abierta
  ON ventana_prematricula(activa, abre, cierra);

-- ----------------------------------------------------------------
-- 3) Inscripciones del programa
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inscripcion_360 (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  materia_id    UUID NOT NULL REFERENCES materia_360(id) ON DELETE RESTRICT,
  periodo_id    UUID NOT NULL REFERENCES periodo(id) ON DELETE CASCADE,
  -- prematriculada → la eligió en la ventana
  -- cursando      → el período empezó
  -- aprobada      → cuenta como "materia dada"
  -- reprobada     → la dio y no la pasó; sigue faltándole
  -- retirada      → se dio de baja
  estado        TEXT NOT NULL DEFAULT 'prematriculada',
  nota          NUMERIC(5,2) CHECK (nota IS NULL OR (nota >= 0 AND nota <= 100)),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (estado IN ('prematriculada', 'cursando', 'aprobada', 'reprobada', 'retirada')),
  -- La misma materia, en el mismo período, una sola vez. Repetirla en
  -- OTRO período sí se puede: es lo que pasa cuando se reprueba.
  UNIQUE (estudiante_id, materia_id, periodo_id)
);
CREATE INDEX IF NOT EXISTS idx_inscripcion_360_estudiante
  ON inscripcion_360(estudiante_id, estado);
CREATE INDEX IF NOT EXISTS idx_inscripcion_360_periodo
  ON inscripcion_360(periodo_id);

-- ----------------------------------------------------------------
-- 4) Solo becados universitarios
-- ----------------------------------------------------------------
-- Un CHECK no puede consultar otra tabla, así que va como trigger. Es la
-- regla del programa —los de curso técnico llevan sus propias métricas—
-- y conviene que la base la sostenga y no solo la pantalla: una
-- inscripción de 360 para un `regular` sería un dato que nadie sabría
-- interpretar después.
CREATE OR REPLACE FUNCTION solo_becado_en_360()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM estudiante
     WHERE id = NEW.estudiante_id
       AND tipo = 'becado'
  ) THEN
    RAISE EXCEPTION 'Global Effect 360 es solo para becados universitarios (estudiante %)', NEW.estudiante_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inscripcion_360_becado ON inscripcion_360;
CREATE TRIGGER trg_inscripcion_360_becado
  BEFORE INSERT OR UPDATE OF estudiante_id ON inscripcion_360
  FOR EACH ROW EXECUTE FUNCTION solo_becado_en_360();

CREATE TRIGGER trg_materia_360_updated
  BEFORE UPDATE ON materia_360 FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ventana_updated
  BEFORE UPDATE ON ventana_prematricula FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_inscripcion_360_updated
  BEFORE UPDATE ON inscripcion_360 FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE materia_360 IS
  'Catálogo de Global Effect 360: materias técnicas de la Fundación para becados universitarios. `obligatoria` marca las cuatro que no se pueden esquivar.';
COMMENT ON TABLE ventana_prematricula IS
  'Cuándo se puede prematricular, con hora. Lo configura administración y el anuncio sale en los portales y en la cabecera.';
COMMENT ON TABLE inscripcion_360 IS
  'Qué materias de 360 lleva cada becado y en qué estado. `aprobada` es lo que cuenta como "materia dada".';
