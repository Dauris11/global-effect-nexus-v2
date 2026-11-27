-- ================================================================
-- 0136 · Motor de prioridades: qué atiende cada persona
-- ================================================================
-- Los inicios dejan de mostrar conteos y pasan a mostrar «lo que te toca hoy».
-- Qué le toca a quién lo decide esta tabla:
--   · `responsabilidades_personal`: los tipos de pendiente que atiende una
--     persona. Sin filas, rige el reparto de fábrica de su rol
--     (src/lib/prioridades/defaults.ts); con la fila marcador `__configurado__`
--     rige solo lo marcado (así se puede desmarcar todo sin volver al default).
--   · `prioridad_pospuesta`: «posponer» un ítem hasta una fecha. El ítem sigue
--     existiendo en su módulo; solo sale de la lista de esa persona.
--
-- Aditiva e idempotente. Con RLS activada y sin políticas, igual que el resto
-- de las tablas de la app: el acceso es por el servidor, que ya autoriza.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.responsabilidades_personal (
  user_id        UUID NOT NULL REFERENCES public.usuario (id) ON DELETE CASCADE,
  tipo_prioridad TEXT NOT NULL CHECK (char_length(tipo_prioridad) BETWEEN 3 AND 60),
  PRIMARY KEY (user_id, tipo_prioridad)
);

CREATE TABLE IF NOT EXISTS public.prioridad_pospuesta (
  user_id   UUID NOT NULL REFERENCES public.usuario (id) ON DELETE CASCADE,
  item_id   TEXT NOT NULL CHECK (char_length(item_id) BETWEEN 3 AND 120),
  hasta     DATE NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_prioridad_pospuesta_hasta
  ON public.prioridad_pospuesta (user_id, hasta);

COMMENT ON TABLE public.responsabilidades_personal IS
  'Tipos de pendiente (src/lib/prioridades/catalogo.ts) que atiende cada persona. Fila __configurado__ = la persona ya fue personalizada.';
COMMENT ON TABLE public.prioridad_pospuesta IS
  'Ítems del motor de prioridades que una persona pospuso hasta una fecha (día RD).';

ALTER TABLE public.responsabilidades_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridad_pospuesta ENABLE ROW LEVEL SECURITY;
