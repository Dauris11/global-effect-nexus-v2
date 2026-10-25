-- ================================================================
-- GLOBAL EFFECT NEXUS — 0053 · Contabilidad Fase 5:
-- Nómina, Activos Fijos e Inventario
-- ================================================================
-- Fundación Global Effect (La Vega, RD) — ASFL Ley 122-05
-- Stack: Postgres, RLS habilitado, auditoría de bitácora encadenada
--
-- Cobertura:
-- 1. Cuentas contables para inventarios y depreciación acumulada
-- 2. Nómina y Seguridad Social Dominicana (TSS / DGII / Código de Trabajo):
--    - contabilidad.empleado (personal, cargo, centro de costo, tercero, usuario)
--    - contabilidad.nomina (corridas quincenales, mensuales, regalía pascual)
--    - contabilidad.nomina_linea (devengos, AFP, SFS, ISR, aportes patronales)
-- 3. Activos Fijos y Depreciación:
--    - contabilidad.activo_categoria (Cat 1, Cat 2, Cat 3 DGII / vida útil)
--    - contabilidad.activo_fijo (enlace a public.inventario_activo, valor en libros)
--    - contabilidad.depreciacion_mensual y contabilidad.depreciacion_linea
-- 4. Inventario de Consumibles y Alimentos (Comedor y Suministros):
--    - contabilidad.articulo (stock, costo promedio ponderado)
--    - contabilidad.inventario_movimiento (kardex)
--    - contabilidad.conteo_fisico y contabilidad.conteo_fisico_linea (ajustes)
-- ================================================================

-- Configurar usuario del sistema para el disparador de bitácora
SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0053_contabilidad_fase5_nomina_activos_inventario.sql', true);

-- ----------------------------------------------------------------
-- 1. Cuentas contables complementarias en el catálogo ASFL
-- ----------------------------------------------------------------

-- Inventarios (Activo Corriente)
INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '1.1.04', 'Inventarios', 'activo', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.1'), false
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.1.04');

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '1.1.04.01', 'Inventario de Alimentos y Comedor', 'activo', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.1.04'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.1.04.01');

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '1.1.04.02', 'Inventario de Material Didáctico y Suministros', 'activo', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.1.04'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.1.04.02');

-- Activo No Corriente: Mobiliario, Maquinaria y Depreciación
INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '1.2.02', 'Mobiliario y Enseres', 'activo', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.2.02');

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '1.2.03', 'Vehículos y Transporte', 'activo', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.2.03');

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '1.2.04', 'Edificaciones y Mejoras', 'activo', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.2.04');

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '1.2.09', 'Depreciación Acumulada Activos Fijos', 'activo', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '1.2.09');

-- Gastos: Consumo de Suministros y Depreciación
INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '5.2.01.07', 'Consumo de Alimentos y Comedor', 'gasto', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '5.2.01.07');

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '5.2.01.08', 'Consumo de Material Didáctico y Suministros', 'gasto', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '5.2.01.08');

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo, padre_id, admite_movimiento)
SELECT '5.2.01.09', 'Depreciación de Activos Fijos', 'gasto', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2'), true
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.cuenta_contable WHERE codigo = '5.2.01.09');

-- ----------------------------------------------------------------
-- 2. NÓMINA Y SEGURIDAD SOCIAL DOMINICANA
-- ----------------------------------------------------------------

-- Tabla contabilidad.empleado
CREATE TABLE IF NOT EXISTS contabilidad.empleado (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tercero_id          uuid NOT NULL REFERENCES contabilidad.tercero(id),
  usuario_id          uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  centro_costo_id     uuid NOT NULL REFERENCES contabilidad.centro_costo(id),
  codigo_empleado     text NOT NULL UNIQUE,
  cargo               text NOT NULL,
  departamento        text NOT NULL,
  fecha_ingreso       date NOT NULL,
  fecha_salida        date,
  estado              text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'licencia', 'suspendido', 'desvinculado')),
  tipo_contrato       text NOT NULL DEFAULT 'indefinido' CHECK (tipo_contrato IN ('indefinido', 'fijo', 'proyecto', 'pasantia')),
  salario_base        numeric(14,2) NOT NULL CHECK (salario_base > 0),
  banco_nombre        text,
  banco_cuenta        text,
  banco_tipo_cuenta   text CHECK (banco_tipo_cuenta IS NULL OR banco_tipo_cuenta IN ('ahorros', 'corriente')),
  cotiza_tss          boolean NOT NULL DEFAULT true,
  aplica_isr          boolean NOT NULL DEFAULT true,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_empleado_tercero ON contabilidad.empleado (tercero_id);
CREATE INDEX IF NOT EXISTS idx_contabilidad_empleado_centro ON contabilidad.empleado (centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_contabilidad_empleado_estado ON contabilidad.empleado (estado);
ALTER TABLE contabilidad.empleado ENABLE ROW LEVEL SECURITY;

-- Tabla contabilidad.nomina (corridas de nómina)
CREATE TABLE IF NOT EXISTS contabilidad.nomina (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                  text NOT NULL UNIQUE,
  anio                    smallint NOT NULL CHECK (anio BETWEEN 2020 AND 2099),
  mes                     smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  periodo_tipo            text NOT NULL DEFAULT 'mensual' CHECK (
                            periodo_tipo IN ('mensual', 'primera_quincena', 'segunda_quincena', 'regalia_pascual', 'liquidacion')
                          ),
  fecha_corte             date NOT NULL,
  fecha_pago              date NOT NULL,
  estado                  text NOT NULL DEFAULT 'borrador' CHECK (
                            estado IN ('borrador', 'aprobada', 'pagada', 'anulada')
                          ),
  total_devengado         numeric(14,2) NOT NULL DEFAULT 0,
  total_afp_empleado      numeric(14,2) NOT NULL DEFAULT 0,
  total_sfs_empleado      numeric(14,2) NOT NULL DEFAULT 0,
  total_isr_empleado      numeric(14,2) NOT NULL DEFAULT 0,
  total_otras_deducciones numeric(14,2) NOT NULL DEFAULT 0,
  total_neto              numeric(14,2) NOT NULL DEFAULT 0,
  total_afp_empleador     numeric(14,2) NOT NULL DEFAULT 0,
  total_sfs_empleador     numeric(14,2) NOT NULL DEFAULT 0,
  total_srl_empleador     numeric(14,2) NOT NULL DEFAULT 0,
  total_infotep_empleador numeric(14,2) NOT NULL DEFAULT 0,
  total_costo_patronal    numeric(14,2) NOT NULL DEFAULT 0,
  asiento_id              uuid REFERENCES contabilidad.asiento(id) ON DELETE SET NULL,
  aprobado_por            uuid REFERENCES public.usuario(id),
  aprobado_en             timestamptz,
  notas                   text,
  creado_por              uuid REFERENCES public.usuario(id),
  creado_en               timestamptz NOT NULL DEFAULT now(),
  actualizado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_nomina_periodo ON contabilidad.nomina (anio, mes);
CREATE INDEX IF NOT EXISTS idx_contabilidad_nomina_estado ON contabilidad.nomina (estado);
ALTER TABLE contabilidad.nomina ENABLE ROW LEVEL SECURITY;

-- Tabla contabilidad.nomina_linea (detalle por empleado)
CREATE TABLE IF NOT EXISTS contabilidad.nomina_linea (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomina_id               uuid NOT NULL REFERENCES contabilidad.nomina(id) ON DELETE CASCADE,
  empleado_id             uuid NOT NULL REFERENCES contabilidad.empleado(id),
  centro_costo_id         uuid NOT NULL REFERENCES contabilidad.centro_costo(id),
  salario_base            numeric(14,2) NOT NULL,
  dias_trabajados         smallint NOT NULL DEFAULT 30 CHECK (dias_trabajados >= 0 AND dias_trabajados <= 31),
  horas_extras            numeric(14,2) NOT NULL DEFAULT 0,
  bonificaciones          numeric(14,2) NOT NULL DEFAULT 0,
  otros_ingresos          numeric(14,2) NOT NULL DEFAULT 0,
  total_devengado         numeric(14,2) NOT NULL,
  deduccion_afp           numeric(14,2) NOT NULL DEFAULT 0,
  deduccion_sfs           numeric(14,2) NOT NULL DEFAULT 0,
  deduccion_isr           numeric(14,2) NOT NULL DEFAULT 0,
  otras_deducciones       numeric(14,2) NOT NULL DEFAULT 0,
  total_deducciones       numeric(14,2) NOT NULL DEFAULT 0,
  neto_a_pagar            numeric(14,2) NOT NULL,
  aporte_afp_patronal     numeric(14,2) NOT NULL DEFAULT 0,
  aporte_sfs_patronal     numeric(14,2) NOT NULL DEFAULT 0,
  aporte_srl_patronal     numeric(14,2) NOT NULL DEFAULT 0,
  aporte_infotep_patronal numeric(14,2) NOT NULL DEFAULT 0,
  notas                   text,
  CONSTRAINT unq_nomina_empleado UNIQUE (nomina_id, empleado_id)
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_nomina_linea_nomina ON contabilidad.nomina_linea (nomina_id);
CREATE INDEX IF NOT EXISTS idx_contabilidad_nomina_linea_emp ON contabilidad.nomina_linea (empleado_id);
ALTER TABLE contabilidad.nomina_linea ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 3. ACTIVOS FIJOS Y DEPRECIACIÓN
-- ----------------------------------------------------------------

-- Categorías de activos (conforme a DGII / NIIF)
CREATE TABLE IF NOT EXISTS contabilidad.activo_categoria (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                          text NOT NULL UNIQUE,
  nombre                          text NOT NULL,
  vida_util_meses                 integer NOT NULL CHECK (vida_util_meses > 0),
  porcentaje_anual                numeric(5,2) NOT NULL CHECK (porcentaje_anual > 0),
  cuenta_activo_id                uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  cuenta_depreciacion_acumulada_id uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  cuenta_gasto_depreciacion_id    uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  activo                          boolean NOT NULL DEFAULT true,
  creado_en                       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contabilidad.activo_categoria ENABLE ROW LEVEL SECURITY;

-- Sembrar categorías estándar dominicanas si no existen
INSERT INTO contabilidad.activo_categoria
  (codigo, nombre, vida_util_meses, porcentaje_anual, cuenta_activo_id, cuenta_depreciacion_acumulada_id, cuenta_gasto_depreciacion_id)
SELECT
  'CAT-1',
  'Categoría 1: Edificaciones y Mejoras Estructurales (5 % anual / 20 años)',
  240,
  5.00,
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2.04'),
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2.09'),
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2.01.09')
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.activo_categoria WHERE codigo = 'CAT-1');

INSERT INTO contabilidad.activo_categoria
  (codigo, nombre, vida_util_meses, porcentaje_anual, cuenta_activo_id, cuenta_depreciacion_acumulada_id, cuenta_gasto_depreciacion_id)
SELECT
  'CAT-2',
  'Categoría 2: Equipos de Cómputo y Vehículos (25 % anual / 4 años)',
  48,
  25.00,
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2.01.01'),
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2.09'),
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2.01.09')
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.activo_categoria WHERE codigo = 'CAT-2');

INSERT INTO contabilidad.activo_categoria
  (codigo, nombre, vida_util_meses, porcentaje_anual, cuenta_activo_id, cuenta_depreciacion_acumulada_id, cuenta_gasto_depreciacion_id)
SELECT
  'CAT-3',
  'Categoría 3: Mobiliario, Equipos de Oficina y Herramientas (20 % anual / 5 años)',
  60,
  20.00,
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2.02'),
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '1.2.09'),
  (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '5.2.01.09')
WHERE NOT EXISTS (SELECT 1 FROM contabilidad.activo_categoria WHERE codigo = 'CAT-3');

-- Tabla de activos fijos capitalizados
CREATE TABLE IF NOT EXISTS contabilidad.activo_fijo (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_activo_id    uuid REFERENCES public.inventario_activo(id) ON DELETE SET NULL,
  codigo                  text NOT NULL UNIQUE,
  nombre                  text NOT NULL,
  categoria_id            uuid NOT NULL REFERENCES contabilidad.activo_categoria(id),
  centro_costo_id         uuid NOT NULL REFERENCES contabilidad.centro_costo(id),
  fecha_adquisicion       date NOT NULL,
  costo_adquisicion       numeric(14,2) NOT NULL CHECK (costo_adquisicion > 0),
  valor_residual          numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_residual >= 0),
  depreciacion_acumulada  numeric(14,2) NOT NULL DEFAULT 0 CHECK (depreciacion_acumulada >= 0),
  valor_en_libros         numeric(14,2) NOT NULL CHECK (valor_en_libros >= 0),
  meses_depreciados       integer NOT NULL DEFAULT 0 CHECK (meses_depreciados >= 0),
  estado                  text NOT NULL DEFAULT 'activo' CHECK (
                            estado IN ('activo', 'totalmente_depreciado', 'baja', 'donado', 'traspasado')
                          ),
  es_donado               boolean NOT NULL DEFAULT false,
  fecha_baja              date,
  motivo_baja             text,
  creado_en               timestamptz NOT NULL DEFAULT now(),
  actualizado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_activo_fijo_cat ON contabilidad.activo_fijo (categoria_id);
CREATE INDEX IF NOT EXISTS idx_contabilidad_activo_fijo_centro ON contabilidad.activo_fijo (centro_costo_id);
ALTER TABLE contabilidad.activo_fijo ENABLE ROW LEVEL SECURITY;

-- Depreciación mensual
CREATE TABLE IF NOT EXISTS contabilidad.depreciacion_mensual (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio                smallint NOT NULL CHECK (anio BETWEEN 2020 AND 2099),
  mes                 smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fecha_asiento       date NOT NULL,
  total_depreciacion  numeric(14,2) NOT NULL CHECK (total_depreciacion >= 0),
  asiento_id          uuid REFERENCES contabilidad.asiento(id) ON DELETE SET NULL,
  creado_por          uuid REFERENCES public.usuario(id),
  creado_en           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unq_depreciacion_periodo UNIQUE (anio, mes)
);

ALTER TABLE contabilidad.depreciacion_mensual ENABLE ROW LEVEL SECURITY;

-- Detalle de corrida de depreciación
CREATE TABLE IF NOT EXISTS contabilidad.depreciacion_linea (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depreciacion_id                 uuid NOT NULL REFERENCES contabilidad.depreciacion_mensual(id) ON DELETE CASCADE,
  activo_fijo_id                  uuid NOT NULL REFERENCES contabilidad.activo_fijo(id),
  monto_depreciacion              numeric(14,2) NOT NULL CHECK (monto_depreciacion >= 0),
  depreciacion_acumulada_previa   numeric(14,2) NOT NULL CHECK (depreciacion_acumulada_previa >= 0),
  nuevo_valor_en_libros           numeric(14,2) NOT NULL CHECK (nuevo_valor_en_libros >= 0)
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_deprec_linea_deprec ON contabilidad.depreciacion_linea (depreciacion_id);
ALTER TABLE contabilidad.depreciacion_linea ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 4. INVENTARIO DE CONSUMIBLES Y ALIMENTOS (COMEDOR Y SUMINISTROS)
-- ----------------------------------------------------------------

-- Catálogo de consumibles
CREATE TABLE IF NOT EXISTS contabilidad.articulo (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                text NOT NULL UNIQUE,
  nombre                text NOT NULL,
  categoria             text NOT NULL CHECK (
                          categoria IN ('alimentos_comedor', 'suministros_oficina', 'material_didactico', 'limpieza', 'otros')
                        ),
  unidad_medida         text NOT NULL DEFAULT 'unidad' CHECK (
                          unidad_medida IN ('unidad', 'libra', 'kilo', 'caja', 'saco', 'litro', 'galon', 'paquete')
                        ),
  centro_costo_id       uuid REFERENCES contabilidad.centro_costo(id),
  cuenta_inventario_id  uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  cuenta_gasto_id       uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  stock_actual          numeric(12,2) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo          numeric(12,2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  costo_promedio        numeric(14,4) NOT NULL DEFAULT 0 CHECK (costo_promedio >= 0),
  valor_total           numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  activo                boolean NOT NULL DEFAULT true,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_articulo_cat ON contabilidad.articulo (categoria);
CREATE INDEX IF NOT EXISTS idx_contabilidad_articulo_centro ON contabilidad.articulo (centro_costo_id);
ALTER TABLE contabilidad.articulo ENABLE ROW LEVEL SECURITY;

-- Kardex de movimientos de inventario
CREATE TABLE IF NOT EXISTS contabilidad.inventario_movimiento (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id               uuid NOT NULL REFERENCES contabilidad.articulo(id),
  tipo                      text NOT NULL CHECK (
                              tipo IN ('entrada_compra', 'entrada_donacion', 'salida_consumo', 'ajuste_sobrante', 'ajuste_faltante')
                            ),
  fecha                     date NOT NULL,
  cantidad                  numeric(12,2) NOT NULL CHECK (cantidad > 0),
  costo_unitario            numeric(14,4) NOT NULL CHECK (costo_unitario >= 0),
  costo_total               numeric(14,2) NOT NULL CHECK (costo_total >= 0),
  stock_anterior            numeric(12,2) NOT NULL,
  stock_posterior           numeric(12,2) NOT NULL,
  costo_promedio_anterior   numeric(14,4) NOT NULL,
  costo_promedio_posterior  numeric(14,4) NOT NULL,
  centro_costo_id           uuid REFERENCES contabilidad.centro_costo(id),
  orden_compra_id           uuid REFERENCES contabilidad.orden_compra(id) ON DELETE SET NULL,
  donacion_id               uuid REFERENCES contabilidad.donacion(id) ON DELETE SET NULL,
  asiento_id                uuid REFERENCES contabilidad.asiento(id) ON DELETE SET NULL,
  motivo                    text,
  creado_por                uuid REFERENCES public.usuario(id),
  creado_en                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_inv_mov_art ON contabilidad.inventario_movimiento (articulo_id, fecha DESC);
ALTER TABLE contabilidad.inventario_movimiento ENABLE ROW LEVEL SECURITY;

-- Tomas físicas de inventario (Conteo físico)
CREATE TABLE IF NOT EXISTS contabilidad.conteo_fisico (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          text NOT NULL UNIQUE,
  fecha           date NOT NULL,
  descripcion     text NOT NULL,
  estado          text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aplicado', 'anulado')),
  asiento_id      uuid REFERENCES contabilidad.asiento(id) ON DELETE SET NULL,
  creado_por      uuid REFERENCES public.usuario(id),
  aplicado_por    uuid REFERENCES public.usuario(id),
  aplicado_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contabilidad.conteo_fisico ENABLE ROW LEVEL SECURITY;

-- Líneas de conteo físico
CREATE TABLE IF NOT EXISTS contabilidad.conteo_fisico_linea (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteo_id         uuid NOT NULL REFERENCES contabilidad.conteo_fisico(id) ON DELETE CASCADE,
  articulo_id       uuid NOT NULL REFERENCES contabilidad.articulo(id),
  stock_sistema     numeric(12,2) NOT NULL,
  stock_fisico      numeric(12,2) NOT NULL,
  diferencia        numeric(12,2) NOT NULL,
  costo_unitario    numeric(14,4) NOT NULL,
  impacto_monetario numeric(14,2) NOT NULL,
  ajuste_aplicado   boolean NOT NULL DEFAULT false,
  CONSTRAINT unq_conteo_articulo UNIQUE (conteo_id, articulo_id)
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_conteo_linea ON contabilidad.conteo_fisico_linea (conteo_id);
ALTER TABLE contabilidad.conteo_fisico_linea ENABLE ROW LEVEL SECURITY;
