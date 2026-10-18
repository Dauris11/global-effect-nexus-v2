-- ================================================================
-- GLOBAL EFFECT NEXUS — 0040 · Inventario de Activos Físicos con QR
-- y Auditoría Móvil In Situ
-- ================================================================
-- Módulo 30: Control patrimonial de mobiliario, equipos tecnológicos,
-- herramientas de talleres (Casa de Herramientas), electrodomésticos
-- y vehículos con generación de código QR único por activo y lector
-- móvil por cámara web para arqueos físicos y auditorías en sedes.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0040_inventario_activos_qr.sql', true);

-- ----------------------------------------------------------------
-- 1. Permisos RBAC para Inventario y Control Patrimonial
-- ----------------------------------------------------------------

INSERT INTO public.permiso (codigo, descripcion) VALUES
  ('inventario.leer', 'Ver catálogo de activos físicos, fichas técnicas, ubicaciones, custodios y códigos QR.'),
  ('inventario.escribir', 'Registrar y editar activos físicos, cambiar ubicaciones, asignar custodios y registrar mantenimientos.'),
  ('inventario.eliminar', 'Dar de baja definitiva o eliminar activos del catálogo institucional.'),
  ('inventario.auditar', 'Ejecutar escaneo móvil de códigos QR y registrar actas de auditoría física in situ.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignación de permisos por rol
-- Súper Administrador: control patrimonial total
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo IN (
    'inventario.leer',
    'inventario.escribir',
    'inventario.eliminar',
    'inventario.auditar'
  )
 WHERE r.nombre = 'super_admin'
ON CONFLICT DO NOTHING;

-- Administrador: lectura, registro, edición y auditoría
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo IN (
    'inventario.leer',
    'inventario.escribir',
    'inventario.auditar'
  )
 WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

-- Contabilidad: lectura y auditoría para conciliación de libros de patrimonio
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo IN (
    'inventario.leer',
    'inventario.auditar'
  )
 WHERE r.nombre = 'contabilidad'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 2. Secuencia para correlativo de activos ACT-XXXX
-- ----------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.seq_inventario_activo START WITH 1 INCREMENT BY 1;

-- ----------------------------------------------------------------
-- 3. Tabla núcleo: inventario_activo
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventario_activo (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              varchar(20) NOT NULL UNIQUE,
  nombre              text NOT NULL,
  categoria           varchar(50) NOT NULL CHECK (
                        categoria IN ('mobiliario', 'tecnologia', 'herramientas', 'electrodomesticos', 'vehiculos', 'otros')
                      ),
  ubicacion           text NOT NULL,
  estado              varchar(20) NOT NULL DEFAULT 'operativo' CHECK (
                        estado IN ('operativo', 'mantenimiento', 'prestado', 'baja')
                      ),
  foto_url            text,
  codigo_qr           text NOT NULL,
  responsable_id      uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  valor_estimado      numeric(12,2) CHECK (valor_estimado >= 0),
  numero_serie        varchar(100),
  marca_modelo        varchar(150),
  notas               text,
  creado_por          uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_inventario_activo_updated_at ON public.inventario_activo;
CREATE TRIGGER trg_inventario_activo_updated_at
  BEFORE UPDATE ON public.inventario_activo
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------
-- 4. Tabla de trazabilidad y movimientos: inventario_historial
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventario_historial (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activo_id               uuid NOT NULL REFERENCES public.inventario_activo(id) ON DELETE CASCADE,
  usuario_id              uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  accion                  varchar(50) NOT NULL CHECK (
                            accion IN (
                              'creacion',
                              'movimiento_ubicacion',
                              'cambio_custodio',
                              'cambio_estado',
                              'auditoria_qr',
                              'mantenimiento',
                              'edicion'
                            )
                          ),
  ubicacion_anterior      text,
  ubicacion_nueva         text,
  responsable_anterior_id uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  responsable_nuevo_id    uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  estado_anterior         varchar(20),
  estado_nuevo            varchar(20),
  notas                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Índices para búsqueda ágil en inventario
CREATE INDEX IF NOT EXISTS idx_inventario_activo_codigo ON public.inventario_activo (codigo);
CREATE INDEX IF NOT EXISTS idx_inventario_activo_categoria ON public.inventario_activo (categoria);
CREATE INDEX IF NOT EXISTS idx_inventario_activo_ubicacion ON public.inventario_activo (ubicacion);
CREATE INDEX IF NOT EXISTS idx_inventario_activo_estado ON public.inventario_activo (estado);
CREATE INDEX IF NOT EXISTS idx_inventario_activo_responsable ON public.inventario_activo (responsable_id);
CREATE INDEX IF NOT EXISTS idx_inventario_historial_activo ON public.inventario_historial (activo_id, created_at DESC);

-- ----------------------------------------------------------------
-- 5. Función auxiliar para generar siguiente código de activo
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.siguiente_codigo_activo()
RETURNS text AS $$
DECLARE
  v_num bigint;
BEGIN
  v_num := nextval('public.seq_inventario_activo');
  RETURN 'ACT-' || lpad(v_num::text, 4, '0');
END;
$$ LANGUAGE plpgsql;
