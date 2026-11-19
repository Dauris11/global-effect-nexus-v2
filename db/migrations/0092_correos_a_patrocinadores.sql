-- ================================================================
-- PORTAL GLOBALEFFECT — 0092 · Cartas de los estudiantes a sus patrocinadores
-- ================================================================
-- Cada mes el becado escribe a su patrocinador. Antes las leía, traducía y
-- filtraba una persona externa; ahora llegan al buzón de la Fundación y las
-- procesa un agente. Esta tabla guarda cada carta recibida, qué decidió el
-- agente y qué pasó después. El cumplimiento del mes SE DERIVA de aquí (no hay
-- casilla que el agente marque): ver `planillaDelMes`.
--
-- Estados:
--   sin_identificar  el remitente no coincide con un estudiante activo
--   sin_patrocinador el estudiante no tiene una asignación activa con correo
--   retenido         espera revisión de administración
--   reenviado        entregada (traducida) al patrocinador
--   rechazado        administración la descartó
--   duplicado        ya había una carta válida de ese estudiante ese mes
-- ================================================================

ALTER TABLE public.patrocinador
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'en'
  CHECK (idioma IN ('es', 'en'));

COMMENT ON COLUMN public.patrocinador.idioma IS
  'Idioma al que se traducen las cartas de sus becados.';

CREATE TABLE IF NOT EXISTS public.correo_patrocinador (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       text NOT NULL UNIQUE,            -- los proveedores reintentan
  remitente        citext NOT NULL,
  asunto           text,
  estudiante_id    uuid REFERENCES public.estudiante(id) ON DELETE SET NULL,
  -- Foto de la asignación al recibir: una reasignación posterior no reescribe
  -- a quién iba dirigida cada carta.
  asignacion_id    uuid REFERENCES public.asignacion_beca(id) ON DELETE SET NULL,
  patrocinador_id  uuid REFERENCES public.patrocinador(id) ON DELETE SET NULL,
  mes              text NOT NULL CHECK (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  a_tiempo         boolean NOT NULL,
  recibido_en      timestamptz NOT NULL,
  texto_original   text NOT NULL,
  traduccion       text,
  veredicto        text CHECK (veredicto IN ('limpio', 'revisar')),
  motivos          text[] NOT NULL DEFAULT '{}',
  autenticacion    text NOT NULL DEFAULT 'desconocida'
                   CHECK (autenticacion IN ('pass', 'fail', 'desconocida')),
  estado           text NOT NULL
                   CHECK (estado IN ('sin_identificar', 'sin_patrocinador', 'retenido',
                                     'reenviado', 'rechazado', 'duplicado')),
  revisado_por     uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  revisado_en      timestamptz,
  correo_cola_id   uuid REFERENCES public.correo_cola(id) ON DELETE SET NULL,
  creado_en        timestamptz NOT NULL DEFAULT now()
);

-- Una sola carta válida por estudiante y mes. La unicidad la impone la base y
-- no el código: dos cartas simultáneas no pueden contar las dos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_correo_patrocinador_estudiante_mes
  ON public.correo_patrocinador (estudiante_id, mes)
  WHERE estado IN ('retenido', 'reenviado') AND estudiante_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_correo_patrocinador_mes_estado
  ON public.correo_patrocinador (mes, estado);

-- RLS activa sin políticas, como el resto: la app entra como postgres y nada
-- más debe poder leer cartas de estudiantes.
ALTER TABLE public.correo_patrocinador ENABLE ROW LEVEL SECURITY;

-- Agente que procesa las cartas (para el medidor de uso de la IA).
INSERT INTO public.ai_agente (clave, roles, limite_hora)
VALUES ('agente_correos', '{}', 600)
ON CONFLICT (clave) DO NOTHING;
