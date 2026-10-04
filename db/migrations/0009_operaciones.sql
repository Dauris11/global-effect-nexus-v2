-- ================================================================
-- GLOBAL EFFECT NEXUS — 0009 · Operaciones
-- ================================================================
-- Proyectos, tareas (Kanban) con asignación N:M, eventos de
-- calendario y registro mensual de servicio comunitario.
-- ================================================================

CREATE TABLE proyecto (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  responsable  TEXT,
  estado       TEXT NOT NULL DEFAULT 'planificacion',   -- planificacion, en_curso, completado, pausado
  fecha_inicio DATE,
  fecha_fin    DATE,
  progreso     INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tarea (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  proyecto_id  UUID REFERENCES proyecto(id) ON DELETE SET NULL,
  visibilidad  TEXT NOT NULL DEFAULT 'asignados',   -- todos, asignados
  estado       TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente, en_progreso, completada, cancelada
  prioridad    TEXT NOT NULL DEFAULT 'media',       -- baja, media, alta, urgente
  fecha_limite DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarea_proyecto ON tarea(proyecto_id);
CREATE INDEX idx_tarea_estado   ON tarea(estado);

-- Asignación N:M de tareas a usuarios
CREATE TABLE tarea_asignado (
  tarea_id   UUID NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  PRIMARY KEY (tarea_id, usuario_id)
);
CREATE INDEX idx_tarea_asignado_usuario ON tarea_asignado(usuario_id);

CREATE TABLE evento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT NOT NULL,
  descripcion TEXT,
  tipo        TEXT NOT NULL DEFAULT 'otro',        -- academico, administrativo, social, reunion, otro
  fecha       DATE NOT NULL,
  hora_inicio TEXT,
  hora_fin    TEXT,
  ubicacion   TEXT,
  responsable TEXT,
  estado      TEXT NOT NULL DEFAULT 'programado',  -- programado, en_curso, completado, cancelado
  tarea_id    UUID REFERENCES tarea(id) ON DELETE SET NULL,  -- si fue autogenerado por una tarea
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evento_fecha ON evento(fecha);

-- Registro mensual de servicio comunitario y asistencia a reunión
CREATE TABLE registro_servicio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id   UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  mes             TEXT NOT NULL,   -- formato YYYY-MM
  hizo_servicio   BOOLEAN NOT NULL DEFAULT FALSE,
  asistio_reunion BOOLEAN NOT NULL DEFAULT FALSE,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, mes)
);
CREATE INDEX idx_reg_servicio_estudiante ON registro_servicio(estudiante_id);
CREATE INDEX idx_reg_servicio_mes        ON registro_servicio(mes);

CREATE TRIGGER trg_proyecto_updated BEFORE UPDATE ON proyecto FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tarea_updated    BEFORE UPDATE ON tarea    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_evento_updated   BEFORE UPDATE ON evento   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
