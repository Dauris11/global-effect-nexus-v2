-- ================================================================
-- GLOBAL EFFECT NEXUS — 0005 · Estudiantes (expediente normalizado)
-- ================================================================
-- La entidad estudiante se descompone en tablas hijas para cumplir
-- 2NF/3NF: datos familiares (1:N), vivienda, salud y socioeconómico
-- (1:1). Incluye el pipeline de reclutamiento en estado_estudiante.
-- ================================================================

CREATE TYPE tipo_estudiante   AS ENUM ('becado', 'regular');
CREATE TYPE estado_estudiante AS ENUM (
  'reclutado', 'postulado', 'academia_liderazgo', 'standby_tecnico',
  'activo', 'inactivo', 'graduado', 'suspendido'
);
CREATE TYPE genero     AS ENUM ('masculino', 'femenino', 'otro');
CREATE TYPE parentesco AS ENUM ('padre', 'madre', 'tutor', 'madrastra', 'padrastro', 'hermano', 'hermana', 'otro');

-- ---------------------------------------------------------------
-- Tabla núcleo del expediente
-- ---------------------------------------------------------------
CREATE TABLE estudiante (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                    TEXT NOT NULL,
  cedula                    TEXT UNIQUE,
  email                     CITEXT,
  telefono                  TEXT,
  fecha_nacimiento          DATE,
  lugar_nacimiento          TEXT,
  nacionalidad              TEXT DEFAULT 'Dominicana',
  genero                    genero,
  sexo_documento            TEXT,                      -- sexo biológico oficial
  religion                  TEXT,
  foto_id                   UUID REFERENCES documento(id) ON DELETE SET NULL,

  -- Situación académica / institucional
  tipo                      tipo_estudiante   NOT NULL DEFAULT 'regular',
  estado                    estado_estudiante NOT NULL DEFAULT 'activo',
  programa                  TEXT,                      -- carrera o curso técnico
  donde_estudia             TEXT,                      -- institución donde estudia
  universidad               TEXT,                      -- universidad física (becados)
  fecha_ingreso             DATE,
  patrocinador_id           UUID REFERENCES patrocinador(id) ON DELETE SET NULL,

  -- Programa de liderazgo (Habitudes)
  facilitador_habitudes     TEXT,
  centro_educativo          TEXT,                      -- escuela secundaria de procedencia
  director_centro           TEXT,
  imagen_habitudes_id       UUID REFERENCES documento(id) ON DELETE SET NULL,
  breve_historia_habitudes  TEXT,

  -- Seguimiento administrativo
  amonestaciones            TEXT,
  solicitudes_pendientes    TEXT,
  envio_correo_patrocinador TEXT DEFAULT 'pendiente',  -- pendiente, enviado, no_aplica
  asistio_reunion_mensual   TEXT DEFAULT 'no',         -- si, no, justificado

  expediente_id             UUID REFERENCES documento(id) ON DELETE SET NULL,  -- escaneo completo
  notas_adicionales         TEXT,
  usuario_id                UUID UNIQUE REFERENCES usuario(id) ON DELETE SET NULL,  -- credenciales

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_estudiante_estado       ON estudiante(estado);
CREATE INDEX idx_estudiante_tipo         ON estudiante(tipo);
CREATE INDEX idx_estudiante_patrocinador ON estudiante(patrocinador_id);
-- Búsqueda difusa por nombre (buscador inteligente en tiempo real)
CREATE INDEX idx_estudiante_nombre_trgm  ON estudiante USING GIN (nombre gin_trgm_ops);

-- ---------------------------------------------------------------
-- Familiares (1:N) — colapsa las columnas padre_*, madre_*, tutor_*...
-- ---------------------------------------------------------------
CREATE TABLE familiar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  parentesco    parentesco NOT NULL,
  nombre        TEXT NOT NULL,
  edad          INTEGER CHECK (edad >= 0),
  telefono      TEXT,
  profesion     TEXT
);
CREATE INDEX idx_familiar_estudiante ON familiar(estudiante_id);

-- ---------------------------------------------------------------
-- Perfil de vivienda (1:1)
-- ---------------------------------------------------------------
CREATE TABLE perfil_vivienda (
  estudiante_id                UUID PRIMARY KEY REFERENCES estudiante(id) ON DELETE CASCADE,
  con_quien_vive               TEXT,
  por_que_vive_con_esa_persona TEXT,
  hermanos_cantidad            INTEGER DEFAULT 0 CHECK (hermanos_cantidad >= 0),
  casa_propia                  TEXT,   -- si, no, alquilada, prestada
  tipo_casa                    TEXT,
  bano_dentro                  TEXT,   -- dentro, fuera
  habitaciones                 INTEGER DEFAULT 0 CHECK (habitaciones >= 0),
  camas                        INTEGER DEFAULT 0 CHECK (camas >= 0),
  quienes_duermen_cama         TEXT,
  direccion                    TEXT,
  comunidad                    TEXT,
  ciudad_residencia            TEXT,
  pais_residencia              TEXT DEFAULT 'República Dominicana'
);

-- ---------------------------------------------------------------
-- Perfil de salud (1:1)
-- ---------------------------------------------------------------
CREATE TABLE perfil_salud (
  estudiante_id                UUID PRIMARY KEY REFERENCES estudiante(id) ON DELETE CASCADE,
  enfermedades                 TEXT,
  alergias                     TEXT,
  contacto_emergencia_nombre   TEXT,
  contacto_emergencia_telefono TEXT
);

-- ---------------------------------------------------------------
-- Perfil socioeconómico y proyecto de vida (1:1)
-- ---------------------------------------------------------------
CREATE TABLE perfil_socioeconomico (
  estudiante_id       UUID PRIMARY KEY REFERENCES estudiante(id) ON DELETE CASCADE,
  historia_de_vida    TEXT,
  situacion_familiar  TEXT,
  situacion_economica TEXT,
  motivo_beca         TEXT,
  metas_academicas    TEXT
);

-- ---------------------------------------------------------------
-- Historial de asignaciones de becas (auditoría financiera)
-- ---------------------------------------------------------------
CREATE TABLE asignacion_beca (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id   UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  patrocinador_id UUID NOT NULL REFERENCES patrocinador(id) ON DELETE CASCADE,
  monto           NUMERIC(10,2) NOT NULL CHECK (monto >= 0.00),
  fecha_inicio    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin       DATE,
  estado          TEXT NOT NULL DEFAULT 'activo',   -- activo, finalizado
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asignacion_beca_estudiante   ON asignacion_beca(estudiante_id);
CREATE INDEX idx_asignacion_beca_patrocinador ON asignacion_beca(patrocinador_id);

CREATE TRIGGER trg_estudiante_updated BEFORE UPDATE ON estudiante FOR EACH ROW EXECUTE FUNCTION set_updated_at();
