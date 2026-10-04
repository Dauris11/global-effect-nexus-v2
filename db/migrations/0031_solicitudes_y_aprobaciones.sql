-- ================================================================
-- GLOBAL EFFECT NEXUS — 0031 · Solicitudes y aprobaciones
-- ================================================================
-- Con psicología fuera (0030), lo que el estudiante pedía —una cita—
-- se lo pide ahora a administración, y no siempre es una cita: una
-- constancia, una carta, un permiso. Y dentro del personal había
-- decisiones que se tomaban de palabra —dar de alta a un candidato,
-- asignar una beca, aprobar un gasto— sin rastro de quién dijo que
-- sí ni cuándo.
--
-- Las dos cosas son lo mismo: alguien pide, otro revisa, alguien
-- decide, y alguien lo ejecuta. Por eso una sola tabla con un flujo
-- por pasos y no una tabla por trámite.
--
--   enviada → en_revision → [pendiente_direccion] → aprobada → completada
--                     ↘ rechazada              ↘ rechazada
--   (el solicitante puede cancelar en enviada o en_revision)
--
-- Decisiones que conviene no deshacer sin pensarlo:
--
--   · `tipo` y `estado` son TEXT con CHECK y no ENUM. Añadir un trámite
--     nuevo es un ALTER del CHECK dentro de una transacción; un ENUM
--     obliga a `ALTER TYPE ... ADD VALUE`, que no se puede usar en la
--     misma transacción en que se añade, y el runner aplica cada
--     migración en una.
--
--   · `requiere_direccion` se fija AL CREAR. Si mañana sube el umbral
--     del gasto, las solicitudes que ya iban por el segundo nivel no
--     pueden saltárselo a mitad de camino.
--
--   · "aprobada" es la decisión; "completada", que el módulo dueño ya
--     la ejecutó. La solicitud no toca otras tablas por su cuenta: la
--     constancia la entrega administración, el gasto lo asienta
--     contabilidad. Así el flujo no necesita saber escribir en ocho
--     módulos, y cada módulo conserva sus propias validaciones.
--
--   · `estudiante_id` es ON DELETE RESTRICT: una solicitud es un
--     documento con folio, y borrar el expediente no puede llevársela
--     por delante sin que nadie se entere. El borrado del expediente ya
--     comprueba esta tabla antes y lo explica en pantalla.
--
--   · `solicitud_paso` es la línea de tiempo: quién, cuándo, de qué
--     estado a cuál y por qué. Es lo que el solicitante ve, y es
--     distinto de `audit_log`, que es para auditar y no se enseña.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

CREATE TABLE solicitud (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Número legible para nombrarla por teléfono o en un papel. El UUID
  -- sigue siendo la clave; el folio es solo para personas.
  folio              BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  tipo               TEXT NOT NULL CHECK (tipo IN (
                       -- Trámites del estudiante
                       'constancia', 'carta', 'cita_administracion', 'permiso', 'otro',
                       -- Aprobaciones internas
                       'alta_expediente', 'beca', 'gasto')),
  estado             TEXT NOT NULL DEFAULT 'enviada' CHECK (estado IN (
                       'enviada', 'en_revision', 'pendiente_direccion',
                       'aprobada', 'rechazada', 'completada', 'cancelada')),
  titulo             TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 160),
  detalle            TEXT CHECK (detalle IS NULL OR length(detalle) <= 2000),
  solicitante_id     UUID REFERENCES usuario(id) ON DELETE SET NULL,
  estudiante_id      UUID REFERENCES estudiante(id) ON DELETE RESTRICT,
  monto              NUMERIC(12,2) CHECK (monto IS NULL OR monto > 0),
  fecha_requerida    DATE,
  hora_preferida     TEXT,
  requiere_direccion BOOLEAN NOT NULL DEFAULT FALSE,
  -- Quién la tomó. Se llena al pasar a revisión.
  responsable_id     UUID REFERENCES usuario(id) ON DELETE SET NULL,
  -- Lo último que se le dijo al solicitante: la hora confirmada, el
  -- motivo del rechazo, dónde recoger la constancia.
  respuesta          TEXT CHECK (respuesta IS NULL OR length(respuesta) <= 2000),
  resuelta_en        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lo que cada tipo no puede no tener. Se impone aquí y no solo en el
  -- servidor porque una solicitud de beca sin estudiante no significa
  -- nada, venga de donde venga.
  CONSTRAINT solicitud_con_estudiante CHECK (
    tipo NOT IN ('alta_expediente', 'beca') OR estudiante_id IS NOT NULL
  ),
  CONSTRAINT solicitud_gasto_con_monto CHECK (
    tipo <> 'gasto' OR monto IS NOT NULL
  )
);

CREATE INDEX idx_solicitud_solicitante ON solicitud(solicitante_id, created_at DESC);
CREATE INDEX idx_solicitud_estudiante  ON solicitud(estudiante_id);
-- La bandeja pregunta siempre por las abiertas; las cerradas crecen sin
-- parar y no hace falta recorrerlas para eso.
CREATE INDEX idx_solicitud_abiertas    ON solicitud(tipo, created_at)
  WHERE estado IN ('enviada', 'en_revision', 'pendiente_direccion', 'aprobada');

CREATE TRIGGER trg_solicitud_updated BEFORE UPDATE ON solicitud
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE solicitud_paso (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id    UUID NOT NULL REFERENCES solicitud(id) ON DELETE CASCADE,
  -- NULL en el primer paso: la solicitud no venía de ningún estado.
  estado_anterior TEXT,
  estado_nuevo    TEXT NOT NULL,
  comentario      TEXT CHECK (comentario IS NULL OR length(comentario) <= 2000),
  usuario_id      UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitud_paso ON solicitud_paso(solicitud_id, created_at);

-- ----------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------
INSERT INTO permiso (codigo, descripcion) VALUES
  ('solicitudes.gestionar',
   'Revisar, aprobar, rechazar y completar trámites de estudiantes, altas de expediente y becas.'),
  ('solicitudes.direccion',
   'Segundo nivel de aprobación: becas y gastos por encima del umbral.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r, permiso p
 WHERE (r.nombre IN ('admin', 'super_admin') AND p.codigo = 'solicitudes.gestionar')
    OR (r.nombre = 'super_admin'             AND p.codigo = 'solicitudes.direccion')
ON CONFLICT DO NOTHING;
