-- ================================================================
-- PORTAL GLOBALEFFECT — 0098 · Archivos académicos
-- ================================================================
-- PDFs que se suben al expediente de un estudiante («gradua»: validación de
-- asignaturas según el pénsum, récord de notas) y al pénsum de una carrera (el
-- PDF oficial del plan). Viven en el bucket PRIVADO `documentos`; aquí solo la
-- ruta y quién lo subió. Con FK y ON DELETE CASCADE a su dueño, para que borrar
-- el estudiante o el pénsum no deje filas huérfanas.
-- ================================================================

CREATE TABLE archivo_academico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID REFERENCES estudiante(id) ON DELETE CASCADE,
  pensum_id     UUID REFERENCES pensum(id)     ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('gradua', 'record_notas', 'pensum_pdf')),
  ruta          TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  tamano        INTEGER NOT NULL CHECK (tamano > 0),
  subido_por    UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- De un estudiante o de un pénsum, nunca de los dos ni de ninguno, y el tipo
  -- tiene que corresponder al dueño.
  CHECK (
    (estudiante_id IS NOT NULL AND pensum_id IS NULL AND tipo IN ('gradua', 'record_notas'))
    OR (pensum_id IS NOT NULL AND estudiante_id IS NULL AND tipo = 'pensum_pdf')
  )
);
CREATE INDEX idx_archivo_academico_estudiante ON archivo_academico(estudiante_id) WHERE estudiante_id IS NOT NULL;
CREATE INDEX idx_archivo_academico_pensum ON archivo_academico(pensum_id) WHERE pensum_id IS NOT NULL;
