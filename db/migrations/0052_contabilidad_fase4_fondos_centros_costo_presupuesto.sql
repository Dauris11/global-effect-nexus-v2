-- ============================================================
-- GLOBAL EFFECT NEXUS — MIGRACIÓN 0052
-- Fase 4 ERP Contabilidad: Fondos, Centros de Costo y Presupuesto
-- Entidad: Fundación Global Effect (ASFL Ley 122-05)
-- ============================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0052_contabilidad_fase4_fondos_centros_costo_presupuesto.sql', true);

-- 1. CENTROS DE COSTO POR PROGRAMA
-- ============================================================
CREATE TABLE IF NOT EXISTS contabilidad.centro_costo (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         text        NOT NULL UNIQUE,
  nombre         text        NOT NULL,
  programa       text        NOT NULL CHECK (programa IN ('becas', 'formacion_360', 'comedor', 'administrativo', 'institucional', 'proyectos')),
  descripcion    text,
  responsable_id uuid        REFERENCES public.usuario(id),
  activo         boolean     NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contabilidad.centro_costo IS
  'Centros de costo por programa misional (becas, 360, comedor, administración).';

-- Población de centros de costo institucionales base
INSERT INTO contabilidad.centro_costo (codigo, nombre, programa, descripcion)
VALUES
  ('CC-BECAS',   'Programa de Becas Universitarias',     'becas',         'Acompañamiento, matrículas y estipendios de jóvenes becados'),
  ('CC-FORM360', 'Formación Integral Global Effect 360', 'formacion_360', 'Liderazgo, desarrollo personal y formación académica 360'),
  ('CC-COMEDOR', 'Comedor Comunitario y Nutrición',      'comedor',       'Raciones alimentarias, insumos y cocina comunitaria'),
  ('CC-ADMIN',   'Administración General y Operaciones', 'administrativo','Gestión institucional, tecnología, legal y contabilidad'),
  ('CC-INST',    'Desarrollo Institucional y Fondos',    'institucional', 'Gestión de donantes, eventos y captación de recursos')
ON CONFLICT (codigo) DO NOTHING;

-- 2. AMPLIACIÓN DE CONTABILIDAD.FONDO (Contabilidad por Fondos ASFL)
-- ============================================================
ALTER TABLE contabilidad.fondo
  ADD COLUMN IF NOT EXISTS codigo text UNIQUE,
  ADD COLUMN IF NOT EXISTS tipo_restriccion text NOT NULL DEFAULT 'no_restringido' CHECK (tipo_restriccion IN ('no_restringido', 'temporalmente_restringido', 'permanentemente_restringido')),
  ADD COLUMN IF NOT EXISTS donante_id uuid REFERENCES contabilidad.tercero(id),
  ADD COLUMN IF NOT EXISTS proposito_restringido text,
  ADD COLUMN IF NOT EXISTS fecha_inicio date,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_restriccion date,
  ADD COLUMN IF NOT EXISTS monto_restringido_original numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_liberado_acumulado numeric(14,2) NOT NULL DEFAULT 0;

-- Fondo General por omisión
UPDATE contabilidad.fondo
   SET codigo = 'FND-GENERAL',
       tipo_restriccion = 'no_restringido'
 WHERE nombre = 'General' AND codigo IS NULL;

-- 3. HISTORIAL DE LIBERACIÓN DE FONDOS RESTRINGIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS contabilidad.fondo_liberacion (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  fondo_id              uuid          NOT NULL REFERENCES contabilidad.fondo(id),
  monto_liberado        numeric(14,2) NOT NULL CHECK (monto_liberado > 0),
  fecha_liberacion      date          NOT NULL DEFAULT CURRENT_DATE,
  asiento_id            uuid          REFERENCES contabilidad.asiento(id),
  documento_referencia  text,
  justificacion         text          NOT NULL,
  creado_por            uuid          NOT NULL REFERENCES public.usuario(id),
  creado_en             timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE contabilidad.fondo_liberacion IS
  'Registro y trazabilidad de fondos restringidos liberados a fondos operativos al ejecutar el gasto convenido.';

CREATE INDEX IF NOT EXISTS idx_fondo_liberacion_fondo
  ON contabilidad.fondo_liberacion (fondo_id);

-- 4. PRESUPUESTO ANUAL Y LÍNEAS POR CENTRO DE COSTO Y CUENTA
-- ============================================================
CREATE TABLE IF NOT EXISTS contabilidad.presupuesto (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ejercicio      integer     NOT NULL CHECK (ejercicio BETWEEN 2020 AND 2100),
  nombre         text        NOT NULL,
  estado         text        NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobado', 'cerrado')),
  notas          text,
  aprobado_por   uuid        REFERENCES public.usuario(id),
  aprobado_en    timestamptz,
  creado_por     uuid        NOT NULL REFERENCES public.usuario(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_presupuesto_ejercicio_nombre UNIQUE (ejercicio, nombre)
);

COMMENT ON TABLE contabilidad.presupuesto IS
  'Presupuestos institucionales anuales y por programa con control de versiones y aprobación.';

CREATE TABLE IF NOT EXISTS contabilidad.presupuesto_linea (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id      uuid          NOT NULL REFERENCES contabilidad.presupuesto(id) ON DELETE CASCADE,
  centro_costo_id     uuid          NOT NULL REFERENCES contabilidad.centro_costo(id),
  cuenta_id           uuid          NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  fondo_id            uuid          REFERENCES contabilidad.fondo(id),
  periodo_mes         integer       NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  monto_presupuestado numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_presupuestado >= 0),
  notas               text,
  CONSTRAINT uq_presupuesto_linea UNIQUE (presupuesto_id, centro_costo_id, cuenta_id, periodo_mes)
);

COMMENT ON TABLE contabilidad.presupuesto_linea IS
  'Líneas presupuestarias mensuales por centro de costo y cuenta contable.';

CREATE INDEX IF NOT EXISTS idx_presupuesto_linea_consulta
  ON contabilidad.presupuesto_linea (presupuesto_id, centro_costo_id, cuenta_id);

-- 5. TRAZABILIDAD EN ASIENTOS Y COMPRAS
-- ============================================================
ALTER TABLE contabilidad.asiento_linea
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES contabilidad.centro_costo(id),
  ADD COLUMN IF NOT EXISTS fondo_id uuid REFERENCES contabilidad.fondo(id);

CREATE INDEX IF NOT EXISTS idx_asiento_linea_cc
  ON contabilidad.asiento_linea (centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_asiento_linea_fondo
  ON contabilidad.asiento_linea (fondo_id);

ALTER TABLE contabilidad.orden_compra
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES contabilidad.centro_costo(id);

ALTER TABLE contabilidad.orden_compra_linea
  ADD COLUMN IF NOT EXISTS centro_costo_id uuid REFERENCES contabilidad.centro_costo(id);

-- 6. SEGURIDAD: RLS EN TABLAS NUEVAS
-- ============================================================
ALTER TABLE contabilidad.centro_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.fondo_liberacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.presupuesto_linea ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centro_costo_lectura ON contabilidad.centro_costo;
CREATE POLICY centro_costo_lectura ON contabilidad.centro_costo
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS centro_costo_escritura ON contabilidad.centro_costo;
CREATE POLICY centro_costo_escritura ON contabilidad.centro_costo
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS fondo_liberacion_lectura ON contabilidad.fondo_liberacion;
CREATE POLICY fondo_liberacion_lectura ON contabilidad.fondo_liberacion
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fondo_liberacion_escritura ON contabilidad.fondo_liberacion;
CREATE POLICY fondo_liberacion_escritura ON contabilidad.fondo_liberacion
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS presupuesto_lectura ON contabilidad.presupuesto;
CREATE POLICY presupuesto_lectura ON contabilidad.presupuesto
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS presupuesto_escritura ON contabilidad.presupuesto;
CREATE POLICY presupuesto_escritura ON contabilidad.presupuesto
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS presupuesto_linea_lectura ON contabilidad.presupuesto_linea;
CREATE POLICY presupuesto_linea_lectura ON contabilidad.presupuesto_linea
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS presupuesto_linea_escritura ON contabilidad.presupuesto_linea;
CREATE POLICY presupuesto_linea_escritura ON contabilidad.presupuesto_linea
  FOR ALL TO authenticated USING (true);
