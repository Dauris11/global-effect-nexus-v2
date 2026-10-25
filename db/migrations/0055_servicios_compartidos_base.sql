-- ================================================================
-- GLOBAL EFFECT NEXUS — 0055 · Servicios Compartidos Base
-- ================================================================
-- Rol 'colaborador' (operativo: choferes, cocina, auxiliares, mantenimiento),
-- departamentos institucionales y membresías, y soporte para Notificaciones
-- Push (Web Push API / VAPID).
-- ================================================================

-- 1. Insertar el rol base 'colaborador' si no existe
INSERT INTO public.rol (nombre, descripcion)
VALUES ('colaborador', 'Personal operativo y de apoyo: choferes, mantenimiento, cocina y auxiliares. Acceso esencial a chat, solicitudes, tareas y rendición de comprobantes.')
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- 2. Permisos base para colaborador
-- rendicion.enviar (rendir gastos con fotos/comprobantes)
-- solicitudes.gestionar (crear y ver solicitudes personales)
-- ia.usar (asistente interno)
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo IN (
    'rendicion.enviar',
    'solicitudes.gestionar',
    'ia.usar'
  )
 WHERE r.nombre = 'colaborador'
ON CONFLICT DO NOTHING;

-- 3. Tabla de Departamentos institucionales
CREATE TABLE IF NOT EXISTS public.departamento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      TEXT NOT NULL UNIQUE, -- 'direccion', 'administracion', 'contabilidad', 'operaciones', 'academico', 'habitudes', 'flota'
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers de updated_at para departamento
DROP TRIGGER IF EXISTS trg_departamento_updated ON public.departamento;
CREATE TRIGGER trg_departamento_updated
  BEFORE UPDATE ON public.departamento
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Insertar departamentos oficiales de la Fundación
INSERT INTO public.departamento (codigo, nombre, descripcion) VALUES
  ('direccion', 'Dirección General y Junta', 'Gobernanza institucional y relaciones estratégicas.'),
  ('administracion', 'Administración y RR. HH.', 'Gestión operativa, compras, flota, inventario y personal.'),
  ('contabilidad', 'Contabilidad y Finanzas', 'Registro contable, cuentas por pagar, tesorería, impuestos y auditoría.'),
  ('operaciones', 'Operaciones y Logística', 'Mantenimiento, servicios generales, transporte y cocina.'),
  ('academico', 'Académico y Formación', 'Global Effect 360, formación docente y seguimiento estudiantil.'),
  ('habitudes', 'Programa Habitudes', 'Liderazgo y valores en liceos de La Vega y reclutamiento de becados.')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;

-- 4. Pertenencia de usuarios a departamentos (N:M con departamento principal)
CREATE TABLE IF NOT EXISTS public.departamento_colaborador (
  departamento_id UUID NOT NULL REFERENCES public.departamento(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  cargo           TEXT,
  es_responsable  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (departamento_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_dept_colab_usuario ON public.departamento_colaborador(usuario_id);

-- 5. Suscripciones para Notificaciones Push (Web Push / Service Worker / VAPID)
CREATE TABLE IF NOT EXISTS public.usuario_push_subscription (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  activa     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_sub_usuario ON public.usuario_push_subscription(usuario_id) WHERE activa = true;

DROP TRIGGER IF EXISTS trg_push_sub_updated ON public.usuario_push_subscription;
CREATE TRIGGER trg_push_sub_updated
  BEFORE UPDATE ON public.usuario_push_subscription
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 6. Cola asíncrona de correos transaccionales
CREATE TABLE IF NOT EXISTS public.correo_cola (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario   TEXT NOT NULL,
  asunto         TEXT NOT NULL,
  cuerpo_html    TEXT NOT NULL,
  cuerpo_texto   TEXT,
  adjuntos       JSONB,
  estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'fallido')),
  intentos       INTEGER NOT NULL DEFAULT 0,
  ultimo_error   TEXT,
  enviado_en     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_correo_cola_estado ON public.correo_cola(estado) WHERE estado = 'pendiente';
