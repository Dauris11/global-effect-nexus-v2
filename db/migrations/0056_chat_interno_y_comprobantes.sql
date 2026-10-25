-- ================================================================
-- GLOBAL EFFECT NEXUS — 0056 · Chat Interno y Flujo de Comprobantes
-- ================================================================
-- Canales de comunicación interna (directos, grupos, departamentos e hilos por caso),
-- mensajes estructurados, soporte para comprobantes fotográficos de gastos de campo
-- y vinculación en tiempo real con la Bandeja de Comprobantes de Contabilidad.
-- ================================================================

-- 1. Tabla de Canales de Chat
CREATE TABLE IF NOT EXISTS public.chat_canal (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL CHECK (tipo IN ('directo', 'grupo', 'departamento', 'hilo_caso')),
  nombre          TEXT,
  departamento_id UUID REFERENCES public.departamento(id) ON DELETE SET NULL,
  entidad_tipo    TEXT CHECK (entidad_tipo IS NULL OR entidad_tipo IN ('gasto', 'solicitud', 'proyecto', 'estudiante')),
  entidad_id      UUID,
  creado_por      UUID NOT NULL REFERENCES public.usuario(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_canal_tipo ON public.chat_canal(tipo);
CREATE INDEX IF NOT EXISTS idx_chat_canal_entidad ON public.chat_canal(entidad_tipo, entidad_id);

DROP TRIGGER IF EXISTS trg_chat_canal_updated ON public.chat_canal;
CREATE TRIGGER trg_chat_canal_updated
  BEFORE UPDATE ON public.chat_canal
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 2. Participantes por Canal
CREATE TABLE IF NOT EXISTS public.chat_participante (
  canal_id                UUID NOT NULL REFERENCES public.chat_canal(id) ON DELETE CASCADE,
  usuario_id              UUID NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  rol                     TEXT NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin', 'miembro', 'observador')),
  ultimo_leido_mensaje_id UUID,
  silenciado              BOOLEAN NOT NULL DEFAULT false,
  unido_el                TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (canal_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_part_usuario ON public.chat_participante(usuario_id);

-- 3. Mensajes de Chat
CREATE TABLE IF NOT EXISTS public.chat_mensaje (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id     UUID NOT NULL REFERENCES public.chat_canal(id) ON DELETE CASCADE,
  remitente_id UUID NOT NULL REFERENCES public.usuario(id),
  contenido    TEXT,
  tipo         TEXT NOT NULL DEFAULT 'texto' CHECK (
                 tipo IN ('texto', 'imagen', 'archivo', 'nota_voz', 'comprobante_gasto', 'sistema')
               ),
  documento_id UUID REFERENCES public.documento(id) ON DELETE SET NULL,
  datos_extra  JSONB, -- { monto, rnc, ncf, comercio, estado, categoria, vehiculo_id, proyecto_id }
  editado      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_mensaje_canal_created ON public.chat_mensaje(canal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_mensaje_tipo ON public.chat_mensaje(tipo);

-- 4. Bandeja de Comprobantes Recibidos en Contabilidad
-- Conecta las fotos/rendiciones enviadas por choferes y personal de campo desde el chat
-- con la revisión, asignación presupuestaria y contabilización en Contabilidad.
CREATE TABLE IF NOT EXISTS contabilidad.comprobante_recibido (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio             BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  mensaje_id        UUID REFERENCES public.chat_mensaje(id) ON DELETE SET NULL,
  remitente_id      UUID NOT NULL REFERENCES public.usuario(id),
  documento_id      UUID REFERENCES public.documento(id) ON DELETE SET NULL,
  archivo_url       TEXT,
  archivo_sha256    TEXT,
  monto             NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  moneda            TEXT NOT NULL DEFAULT 'DOP' CHECK (moneda IN ('DOP', 'USD')),
  itbis             NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (itbis >= 0),
  proveedor_nombre  TEXT,
  proveedor_rnc     TEXT,
  ncf               TEXT,
  tipo_ncf          TEXT, -- 'B01', 'B02', 'B11', 'B13', etc.
  fecha_comprobante DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto          TEXT NOT NULL,
  categoria         TEXT, -- 'combustible', 'mantenimiento_vehiculo', 'alimentacion', 'materiales', 'peaje', 'otro'
  centro_costo_id   UUID REFERENCES contabilidad.centro_costo(id),
  fondo_id          UUID REFERENCES contabilidad.fondo(id),
  proyecto_id       UUID REFERENCES public.proyecto(id),
  caja_id           UUID REFERENCES contabilidad.caja(id),
  ocr_datos         JSONB,
  estado            TEXT NOT NULL DEFAULT 'recibido' CHECK (
                      estado IN ('recibido', 'validado', 'observado', 'rechazado', 'contabilizado')
                    ),
  asiento_id        UUID REFERENCES contabilidad.asiento(id),
  observaciones     TEXT,
  revisado_por      UUID REFERENCES public.usuario(id),
  revisado_en       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_recibido_estado ON contabilidad.comprobante_recibido(estado);
CREATE INDEX IF NOT EXISTS idx_comp_recibido_remitente ON contabilidad.comprobante_recibido(remitente_id);
CREATE INDEX IF NOT EXISTS idx_comp_recibido_fecha ON contabilidad.comprobante_recibido(fecha_comprobante DESC);

DROP TRIGGER IF EXISTS trg_comp_recibido_updated ON contabilidad.comprobante_recibido;
CREATE TRIGGER trg_comp_recibido_updated
  BEFORE UPDATE ON contabilidad.comprobante_recibido
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 5. Canales departamentales iniciales automáticos
INSERT INTO public.chat_canal (tipo, nombre, departamento_id, creado_por)
SELECT 'departamento', 'General: ' || d.nombre, d.id, u.id
  FROM public.departamento d
  CROSS JOIN (SELECT id FROM public.usuario WHERE email = 'sistema@globaleffect.org' LIMIT 1) u
ON CONFLICT DO NOTHING;
