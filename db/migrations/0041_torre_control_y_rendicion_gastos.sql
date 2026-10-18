-- ================================================================
-- GLOBAL EFFECT NEXUS — 0041 · Torre de Control del Colaborador,
-- Asignación de Proyectos por Rol y Rendición de Gastos con OCR
-- ================================================================
-- Requerimientos de la Fundación Global Effect:
--   1. Centro operativo diario del colaborador ("Lo que me toca hoy"):
--      tareas para hoy, vencidas y por hacer, estados reales de avance
--      (por_hacer, en_progreso, en_revision, completada), bitácora del día
--      y autoasignación de tareas prioritarias (mandados, compras, pagos).
--   2. Asignación de proyectos por rol:
--      Gobernado exclusivamente por el superadmin para todo el personal.
--   3. Rendición de gastos de empleados hacia Contabilidad:
--      Envío de facturas con foto u OCR, asignación a programa institucional
--      (Casa de Herramientas, Juan Bosch, Becas, etc.) y persona responsable,
--      con validación formal ante DGII.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0041_torre_control_y_rendicion_gastos.sql', true);

-- ----------------------------------------------------------------
-- 1. Permisos RBAC
-- ----------------------------------------------------------------

INSERT INTO public.permiso (codigo, descripcion) VALUES
  ('rendicion.enviar', 'Rendir facturas y comprobantes fiscales con foto u OCR desde el panel del colaborador.'),
  ('rendicion.revisar', 'Validar, aprobar y contabilizar comprobantes de gastos rendidos por el personal.'),
  ('proyectos.asignar_rol', 'Gobernanza exclusiva de asignación de proyectos institucionales a los roles del personal.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignación de permisos por rol
-- super_admin: todo
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo IN (
    'rendicion.enviar',
    'rendicion.revisar',
    'proyectos.asignar_rol'
  )
 WHERE r.nombre = 'super_admin'
ON CONFLICT DO NOTHING;

-- admin: rendir y revisar
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo IN (
    'rendicion.enviar',
    'rendicion.revisar'
  )
 WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

-- contabilidad: rendir y revisar para contabilizar
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo IN (
    'rendicion.enviar',
    'rendicion.revisar'
  )
 WHERE r.nombre = 'contabilidad'
ON CONFLICT DO NOTHING;

-- docente y habitudes: pueden rendir gastos operativos
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo = 'rendicion.enviar'
 WHERE r.nombre IN ('docente', 'habitudes')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 2. Asignación de Proyectos por Rol (Gobernado por superadmin)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.proyecto_rol (
  proyecto_id uuid NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  rol         text NOT NULL CHECK (rol IN ('admin', 'docente', 'contabilidad', 'habitudes')),
  asignado_por uuid REFERENCES public.usuario(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proyecto_id, rol)
);

CREATE INDEX IF NOT EXISTS idx_proyecto_rol_rol ON public.proyecto_rol (rol);

-- ----------------------------------------------------------------
-- 3. Bitácora de Actividades Diarias del Colaborador
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.colaborador_bitacora_diaria (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        uuid NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  fecha             date NOT NULL DEFAULT CURRENT_DATE,
  descripcion       text NOT NULL,
  tarea_id          uuid REFERENCES public.tarea(id) ON DELETE SET NULL,
  minutos_dedicados integer NOT NULL DEFAULT 0 CHECK (minutos_dedicados >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bitacora_usuario_fecha
  ON public.colaborador_bitacora_diaria (usuario_id, fecha DESC);

-- ----------------------------------------------------------------
-- 4. Secuencia y Tabla de Rendición de Gastos de Empleados
-- ----------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.seq_rendicion_gasto START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.rendicion_gasto (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo               text NOT NULL UNIQUE,
  empleado_id          uuid NOT NULL REFERENCES public.usuario(id),
  programa_id          uuid REFERENCES public.proyecto(id),
  proveedor_nombre     text NOT NULL,
  proveedor_rnc        text,
  ncf                  text CHECK (ncf IS NULL OR ncf ~ '^[BE][0-9]{8,12}$'),
  fecha_comprobante    date NOT NULL DEFAULT CURRENT_DATE,
  moneda               text NOT NULL DEFAULT 'DOP' CHECK (moneda IN ('DOP', 'USD')),
  monto_total          numeric(14,2) NOT NULL CHECK (monto_total > 0),
  monto_itbis          numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_itbis >= 0),
  concepto             text NOT NULL,
  comprobante_url      text,
  ocr_data             jsonb,
  estado               text NOT NULL DEFAULT 'enviada' CHECK (
                         estado IN ('enviada', 'en_revision', 'aprobada', 'rechazada', 'contabilizada')
                       ),
  factura_proveedor_id uuid REFERENCES contabilidad.factura_proveedor(id) ON DELETE SET NULL,
  movimiento_caja_id   uuid REFERENCES contabilidad.caja_movimiento(id) ON DELETE SET NULL,
  motivo_rechazo       text,
  revisado_por         uuid REFERENCES public.usuario(id),
  revisado_en          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Trigger de updated_at para rendicion_gasto
DROP TRIGGER IF EXISTS trg_rendicion_gasto_updated_at ON public.rendicion_gasto;
CREATE TRIGGER trg_rendicion_gasto_updated_at
  BEFORE UPDATE ON public.rendicion_gasto
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rendicion_empleado ON public.rendicion_gasto (empleado_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rendicion_estado ON public.rendicion_gasto (estado);
CREATE INDEX IF NOT EXISTS idx_rendicion_programa ON public.rendicion_gasto (programa_id);

-- Función para generar correlativo de rendición RDG-XXXX
CREATE OR REPLACE FUNCTION public.siguiente_codigo_rendicion()
RETURNS text AS $$
DECLARE
  v_num bigint;
BEGIN
  v_num := nextval('public.seq_rendicion_gasto');
  RETURN 'RDG-' || lpad(v_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- 5. Normalización de estados en public.tarea
-- ----------------------------------------------------------------
-- Migra tareas en estado 'pendiente' al estándar unificado 'por_hacer'
UPDATE public.tarea SET estado = 'por_hacer' WHERE estado = 'pendiente';
