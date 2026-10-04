-- ================================================================
-- GLOBAL EFFECT NEXUS — 0015 · Landing pública configurable
-- ================================================================
-- Contenido editable por el administrador para la página de inicio:
-- las diapositivas (publicidad) del hero rotativo. Las estadísticas y
-- los eventos de la landing se leen en vivo de la BD (no se configuran).
-- Añade el permiso `landing.administrar` y lo asigna a super_admin/admin.
-- ================================================================

-- Diapositivas del hero (publicidad configurable)
CREATE TABLE IF NOT EXISTS landing_slide (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     TEXT NOT NULL,
  subtitulo  TEXT,
  texto      TEXT,
  imagen_url TEXT,                       -- URL o storage key de la imagen de fondo
  cta_texto  TEXT,                       -- etiqueta del botón (opcional)
  cta_enlace TEXT,                       -- ruta/URL del botón (opcional)
  orden      INTEGER NOT NULL DEFAULT 0, -- orden de aparición
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_landing_slide_orden ON landing_slide(activo, orden);

CREATE TRIGGER trg_landing_slide_updated
  BEFORE UPDATE ON landing_slide FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Permiso de administración de la landing
INSERT INTO permiso (codigo, descripcion) VALUES
  ('landing.administrar', 'Editar la página de inicio (diapositivas del hero y contenido público).')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignar a super_admin y admin
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r, permiso p
 WHERE r.nombre IN ('super_admin', 'admin')
   AND p.codigo = 'landing.administrar'
ON CONFLICT DO NOTHING;

-- Diapositivas de ejemplo, para que el panel tenga algo que editar.
-- NOTA: la migración 0018 las desactiva. La landing tiene su propio hero
-- escrito y estas rotaban solas en la página pública sin decir nada.
-- Se conservan aquí para no reescribir el historial de migraciones.
INSERT INTO landing_slide (titulo, subtitulo, texto, cta_texto, cta_enlace, orden) VALUES
  ('Becas universitarias', 'Transformando vidas a través de la educación',
   'Apoyamos a jóvenes con potencial para que alcancen su título universitario.',
   'Conocer más', '/login', 1),
  ('Cursos técnicos', 'Formación para el empleo',
   'Instituto de Carreras Técnicas: contabilidad, computación y más.',
   'Ver cursos', '/login', 2),
  ('Programa Habitudes', 'Liderazgo y desarrollo de habilidades',
   'Academias de liderazgo que forman el carácter de nuestros estudiantes.',
   NULL, NULL, 3)
ON CONFLICT DO NOTHING;
