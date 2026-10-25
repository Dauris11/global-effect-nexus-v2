-- ================================================================
-- GLOBAL EFFECT NEXUS — 0051 · Contabilidad: Fase 3 (Impuestos DGII y Calculadoras)
-- ================================================================
-- Fase 3 de docs/prompts/plan-contabilidad-erp.md:
--   1. Calendario de obligaciones fiscales (IR-3, IR-17, 606 a 609, IT-1, ISFL-01).
--   2. Declaraciones y presentaciones oficiales con archivo TXT generado,
--      hash inalterable y soporte de rectificativas y envío en cero.
--   3. Parámetros oficiales de recargos y mora según el Código Tributario.
--   4. Historial de cálculos interactivos para conversión a asientos borrador.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0051_contabilidad_fase3_impuestos_dgii_calculadoras.sql', true);

-- ----------------------------------------------------------------
-- 1) Catálogo de Obligaciones Fiscales Dominicanas
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.obligacion_fiscal (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                text NOT NULL UNIQUE CHECK (codigo IN ('606', '607', '608', '609', 'IT-1', 'IR-17', 'IR-3', 'ISFL-01')),
  nombre                text NOT NULL,
  descripcion           text NOT NULL,
  frecuencia            text NOT NULL CHECK (frecuencia IN ('mensual', 'anual')),
  -- Día límite de vencimiento en el mes siguiente (ej. 10 para IR-3/17, 15 para 606-609, 20 para IT-1)
  -- Para ISFL-01 se interpreta como días posteriores al cierre fiscal (120 días)
  dia_limite            int NOT NULL CHECK (dia_limite BETWEEN 1 AND 150),
  base_legal            text,
  activo                boolean NOT NULL DEFAULT true
);

INSERT INTO contabilidad.obligacion_fiscal (codigo, nombre, descripcion, frecuencia, dia_limite, base_legal) VALUES
  ('606',     'Formato 606',     'Compras de Bienes y Servicios',                           'mensual', 15,  'Norma General 07-18'),
  ('607',     'Formato 607',     'Ventas e Ingresos de Bienes y Servicios',                 'mensual', 15,  'Norma General 07-18'),
  ('608',     'Formato 608',     'Comprobantes Fiscales Anulados',                          'mensual', 15,  'Norma General 07-18'),
  ('609',     'Formato 609',     'Pagos por Servicios al Exterior',                         'mensual', 15,  'Norma General 07-18'),
  ('IR-3',    'Declaración IR-3', 'Retenciones a Asalariados y TSS',                         'mensual', 10,  'Código Tributario Art. 307'),
  ('IR-17',   'Declaración IR-17','Otras Retenciones y Retribuciones Complementarias',       'mensual', 10,  'Código Tributario Art. 309 y Ley 30-26'),
  ('IT-1',    'Declaración IT-1', 'Impuesto sobre Transferencias de Bienes y Servicios',    'mensual', 20,  'Código Tributario Título III'),
  ('ISFL-01', 'Declaración ISFL-01', 'Declaración Jurada Anual de Instituciones Sin Fines de Lucro', 'anual', 120, 'Ley 122-05 y Norma 01-2008')
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      descripcion = EXCLUDED.descripcion,
      dia_limite = EXCLUDED.dia_limite,
      base_legal = EXCLUDED.base_legal;

-- ----------------------------------------------------------------
-- 2) Declaraciones y Presentaciones Oficiales
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.declaracion (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                        text NOT NULL CHECK (tipo IN ('606', '607', '608', '609', 'IT-1', 'IR-17', 'IR-3', 'ISFL-01')),
  ejercicio                   int NOT NULL CHECK (ejercicio >= 2020),
  periodo                     text NOT NULL, -- '2026-09' o '2026'
  version                     int NOT NULL DEFAULT 1 CHECK (version >= 1),
  es_rectificativa            boolean NOT NULL DEFAULT false,
  declaracion_anterior_id     uuid REFERENCES contabilidad.declaracion(id),
  estado                      text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'generada', 'presentada', 'anulada')),
  total_operaciones           int NOT NULL DEFAULT 0 CHECK (total_operaciones >= 0),
  monto_total                 numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_total >= 0),
  impuesto_determinado        numeric(14,2) NOT NULL DEFAULT 0 CHECK (impuesto_determinado >= 0),
  saldo_a_favor               numeric(14,2) NOT NULL DEFAULT 0 CHECK (saldo_a_favor >= 0),
  contenido_txt               text,
  hash_sha256                 text,
  fecha_generacion            timestamptz,
  fecha_presentacion          date,
  numero_autorizacion_dgii    text,
  generado_por                uuid REFERENCES public.usuario(id),
  presentado_por              uuid REFERENCES public.usuario(id),
  notas                       text,
  creado_en                   timestamptz NOT NULL DEFAULT now(),
  actualizado_en              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, ejercicio, periodo, version)
);

CREATE INDEX IF NOT EXISTS idx_declaracion_periodo
  ON contabilidad.declaracion(tipo, periodo DESC);

-- ----------------------------------------------------------------
-- 3) Parámetros Oficiales de Recargos y Mora (Código Tributario)
-- ----------------------------------------------------------------
INSERT INTO contabilidad.parametro (clave, valor, vigente_desde, vigente_hasta, fuente, nota) VALUES
  ('tasa_recargo_mora_primer_mes', '0.1000'::jsonb, '2026-01-01', '2099-01-01', 'Código Tributario Art. 251', 'Recargo por mora para el primer mes o fracción (DGII Art. 251)'),
  ('tasa_recargo_mora_mes_adicional', '0.0400'::jsonb, '2026-01-01', '2099-01-01', 'Código Tributario Art. 251', 'Recargo por mora para cada mes o fracción posterior (DGII Art. 251)'),
  ('tasa_interes_indemnizatorio_mensual', '0.0110'::jsonb, '2026-01-01', '2099-01-01', 'Código Tributario Art. 252', 'Interés indemnizatorio mensual por mora fiscal (DGII Art. 252)')
ON CONFLICT (clave, vigente_desde) DO NOTHING;

-- ----------------------------------------------------------------
-- 4) Historial de Cálculos de Herramientas
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.calculadora_historial (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_calculadora            text NOT NULL CHECK (tipo_calculadora IN ('factura', 'itbis', 'retenciones', 'recargos_mora', 'prestamo', 'divisas', 'laboral')),
  parametros_entrada          jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado_calculo           jsonb NOT NULL DEFAULT '{}'::jsonb,
  asiento_id                  uuid REFERENCES contabilidad.asiento(id),
  creado_por                  uuid NOT NULL REFERENCES public.usuario(id),
  creado_en                   timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 5) Auditoría y RLS
-- ----------------------------------------------------------------
SELECT contabilidad.auditar_tabla('contabilidad.obligacion_fiscal'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.declaracion'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.calculadora_historial'::regclass);

ALTER TABLE contabilidad.obligacion_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.declaracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.calculadora_historial ENABLE ROW LEVEL SECURITY;
