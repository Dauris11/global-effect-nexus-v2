-- ================================================================
-- GLOBAL EFFECT NEXUS — 0021 · Aula Virtual
-- ================================================================

CREATE TYPE tipo_asignacion AS ENUM ('tarea', 'examen', 'material', 'anuncio');
CREATE TYPE estado_entrega AS ENUM ('pendiente', 'entregado', 'calificado', 'tarde');

-- Asignaciones publicadas en los cursos
CREATE TABLE asignacion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id          UUID NOT NULL REFERENCES materia(id) ON DELETE CASCADE,
  titulo              TEXT NOT NULL,
  descripcion         TEXT,
  tipo                tipo_asignacion NOT NULL DEFAULT 'tarea',
  archivo_url         TEXT, -- URL o path en storage
  fecha_publicacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_vencimiento   TIMESTAMPTZ, -- nulo si es material o anuncio sin fecha
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asignacion_materia ON asignacion(materia_id);
CREATE INDEX idx_asignacion_vencimiento ON asignacion(fecha_vencimiento);

-- Entregas de los estudiantes para las asignaciones evaluables (tareas/exámenes)
CREATE TABLE entrega_estudiante (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id       UUID NOT NULL REFERENCES asignacion(id) ON DELETE CASCADE,
  estudiante_id       UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  estado              estado_entrega NOT NULL DEFAULT 'pendiente',
  archivo_url         TEXT,
  fecha_entrega       TIMESTAMPTZ,
  calificacion        NUMERIC(5,2) CHECK (calificacion >= 0.00 AND calificacion <= 100.00),
  comentario_profesor TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asignacion_id, estudiante_id)
);
CREATE INDEX idx_entrega_asignacion ON entrega_estudiante(asignacion_id);
CREATE INDEX idx_entrega_estudiante ON entrega_estudiante(estudiante_id);

CREATE TRIGGER trg_asignacion_updated      BEFORE UPDATE ON asignacion      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_entrega_estudiante_updated BEFORE UPDATE ON entrega_estudiante FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Insertar datos de prueba (mock) para la materia ISC-215 Estructura de Datos
-- Asumimos que existe una materia con código ISC-215, si no, fallará pero no importa en el contexto de seed puro.
-- Lo ideal es hacer un script seed específico, pero para que el frontend no esté vacío, 
-- inyectaremos algunos datos si la tabla materia tiene registros.
