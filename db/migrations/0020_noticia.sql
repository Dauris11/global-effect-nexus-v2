-- ================================================================
-- GLOBAL EFFECT NEXUS — 0020 · Noticias del sitio público
-- ================================================================
-- La landing ya tiene una sección configurable por administración —el
-- carrusel del hero, en `landing_slide` (0015)— y otra que sale sola de
-- la operación: los próximos eventos, leídos de `evento`.
--
-- Falta la tercera: lo que la Fundación quiere **contar**. Una entrega
-- de becas que ya ocurrió, un convenio firmado, un reconocimiento. Eso
-- no es un evento futuro ni un anuncio rotatorio del hero, y hoy no
-- tiene dónde vivir.
--
-- Por qué una tabla propia y no reutilizar `evento`:
--
--   • Un evento tiene fecha, hora, ubicación y estado porque sirve para
--     organizar algo que va a pasar. Una noticia no se organiza: se
--     publica. Meter noticias en `evento` obligaría a inventar fechas y
--     ubicaciones falsas para filas que no las tienen.
--
--   • `evento` alimenta el calendario interno y las tareas espejo
--     (0009). Una noticia publicada no debe aparecerle a nadie en su
--     agenda.
--
-- La landing muestra **las dos cosas juntas** —noticias y eventos ya
-- celebrados— ordenadas por fecha. Son piezas distintas en la base de
-- datos y una sola sección en pantalla, que es como las lee el visitante.
--
-- `publicada` separa el borrador de lo visible, igual que `activo` en
-- `landing_slide`: se redacta con calma y se publica cuando toca.
-- ================================================================

CREATE TABLE IF NOT EXISTS noticia (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT        NOT NULL,
  -- Entradilla para la tarjeta del listado. Si se deja vacía, la UI
  -- recorta el contenido; tenerla aparte permite escribir un resumen
  -- que se lea bien en dos líneas.
  resumen       TEXT,
  contenido     TEXT,
  imagen_url    TEXT,
  -- Fecha que se muestra y por la que se ordena. No es `created_at`:
  -- una nota sobre algo de marzo puede redactarse en agosto.
  fecha         DATE        NOT NULL DEFAULT CURRENT_DATE,
  autor         TEXT,
  publicada     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb
);

-- La landing pide siempre lo mismo: publicadas, de la más reciente a la
-- más antigua. El índice parcial cubre justo esa consulta y no crece con
-- los borradores.
CREATE INDEX IF NOT EXISTS idx_noticia_publicada_fecha
  ON noticia (fecha DESC)
  WHERE publicada;

-- `updated_at` automático, mismo patrón que el resto del esquema.
DROP TRIGGER IF EXISTS trg_noticia_updated_at ON noticia;
CREATE TRIGGER trg_noticia_updated_at
  BEFORE UPDATE ON noticia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
