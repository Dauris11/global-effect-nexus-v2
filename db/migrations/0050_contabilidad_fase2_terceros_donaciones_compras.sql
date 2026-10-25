-- ================================================================
-- GLOBAL EFFECT NEXUS — 0050 · Contabilidad: Fase 2 (Terceros, Donaciones y Compras)
-- ================================================================
-- Fase 2 de docs/prompts/plan-contabilidad-erp.md:
--   1. Tercero unificado (donante/patrocinador, proveedor, empleado)
--      con validación de RNC/cédula y debida diligencia (Ley 155-17).
--   2. Donaciones en efectivo y en especie, clasificación exenta (ASFL Ley 122-05)
--      o gravada, y promesas de donación con calendario de cobro.
--   3. Órdenes de compra con flujo de aprobación por monto.
--   4. Comprobantes de retención para proveedores con numeración secuencial.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0050_contabilidad_fase2_terceros_donaciones_compras.sql', true);

-- ----------------------------------------------------------------
-- 1) Secuencias para Fase 2
-- ----------------------------------------------------------------
INSERT INTO contabilidad.secuencia (clave, prefijo, siguiente) VALUES
  ('DON', 'DON-', 1),
  ('PRM', 'PRM-', 1),
  ('OC',  'OC-',  1),
  ('CR',  'CR-',  1)
ON CONFLICT (clave) DO NOTHING;

-- ----------------------------------------------------------------
-- 2) Cuentas contables para donaciones en especie y compras
-- ----------------------------------------------------------------
INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo) VALUES
  ('4.1.01.02', 'Donaciones en especie', 'ingreso'),
  ('4.1.01.03', 'Donaciones gravadas (actividad comercial)', 'ingreso'),
  ('1.1.03.01', 'Promesas de donación por cobrar', 'activo')
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------
-- 3) Tercero: donante, proveedor o empleado unificado
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.tercero (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_persona          text NOT NULL CHECK (tipo_persona IN ('fisica', 'juridica', 'gubernamental')),
  tipo_id               text NOT NULL CHECK (tipo_id IN ('rnc', 'cedula', 'pasaporte')),
  identificacion        text NOT NULL,
  nombre_razon_social   text NOT NULL,
  nombre_comercial      text,
  contacto_principal    text,
  telefono              text,
  email                 citext,
  direccion             text,
  pais                  text NOT NULL DEFAULT 'DO',
  es_donante            boolean NOT NULL DEFAULT false,
  es_proveedor          boolean NOT NULL DEFAULT false,
  es_empleado           boolean NOT NULL DEFAULT false,
  -- Vínculos cruzados con entidades existentes
  patrocinador_id       uuid REFERENCES public.patrocinador(id),
  proveedor_id          uuid REFERENCES contabilidad.proveedor(id),
  usuario_id            uuid REFERENCES public.usuario(id),
  activo                boolean NOT NULL DEFAULT true,
  creado_por            uuid NOT NULL REFERENCES public.usuario(id),
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tercero_identificacion UNIQUE (tipo_id, identificacion),
  CONSTRAINT tercero_formato_id CHECK (
    (tipo_id = 'rnc' AND identificacion ~ '^[0-9]{9}$') OR
    (tipo_id = 'cedula' AND identificacion ~ '^[0-9]{11}$') OR
    (tipo_id = 'pasaporte' AND length(trim(identificacion)) >= 3)
  )
);

CREATE INDEX IF NOT EXISTS idx_tercero_donante ON contabilidad.tercero(es_donante) WHERE es_donante;
CREATE INDEX IF NOT EXISTS idx_tercero_proveedor ON contabilidad.tercero(es_proveedor) WHERE es_proveedor;

-- ----------------------------------------------------------------
-- 4) Debida diligencia (Ley 155-17 contra lavado de activos)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.debida_diligencia (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tercero_id                  uuid NOT NULL REFERENCES contabilidad.tercero(id),
  fecha_verificacion          date NOT NULL DEFAULT current_date,
  origen_fondos_declarado     text NOT NULL,
  verificacion_pep            boolean NOT NULL DEFAULT false,
  verificacion_listas         boolean NOT NULL DEFAULT true,
  resultado                   text NOT NULL CHECK (resultado IN ('aprobado', 'observado', 'rechazado')),
  oficial_cumplimiento_id     uuid REFERENCES public.usuario(id),
  observaciones               text,
  soporte_url                 text,
  creado_en                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debida_diligencia_tercero
  ON contabilidad.debida_diligencia(tercero_id, fecha_verificacion DESC);

-- ----------------------------------------------------------------
-- 5) Donaciones (Efectivo y Especie, Exentas / Gravadas)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.donacion (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                      bigint NOT NULL UNIQUE,
  tercero_id                  uuid NOT NULL REFERENCES contabilidad.tercero(id),
  fecha                       date NOT NULL DEFAULT current_date,
  periodo_id                  uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  clase                       text NOT NULL CHECK (clase IN ('efectivo', 'especie')),
  tratamiento                 text NOT NULL DEFAULT 'exento' CHECK (tratamiento IN ('exento', 'gravado')),
  moneda                      text NOT NULL DEFAULT 'DOP' CHECK (moneda IN ('DOP', 'USD')),
  tasa                        numeric(12,4) CHECK (tasa > 0),
  monto                       numeric(14,2) NOT NULL CHECK (monto > 0),
  monto_dop                   numeric(14,2),
  descripcion_especie         text,
  valor_estimado_tasacion     numeric(14,2),
  fondo_id                    uuid NOT NULL REFERENCES contabilidad.fondo(id),
  proyecto_id                 uuid REFERENCES public.proyecto(id),
  cuenta_bancaria_id          uuid REFERENCES contabilidad.cuenta_bancaria(id),
  recibo_id                   uuid REFERENCES contabilidad.recibo(id),
  asiento_id                  uuid REFERENCES contabilidad.asiento(id),
  contra_asiento_id           uuid REFERENCES contabilidad.asiento(id),
  comprobante_externo_numero  text,
  notas                       text,
  estado                      text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'confirmada', 'anulada')),
  creado_por                  uuid NOT NULL REFERENCES public.usuario(id),
  creado_en                   timestamptz NOT NULL DEFAULT now(),
  confirmado_por              uuid REFERENCES public.usuario(id),
  confirmado_en               timestamptz,
  anulado_por                 uuid REFERENCES public.usuario(id),
  anulado_en                  timestamptz,
  motivo_anulacion            text,
  CONSTRAINT donacion_usd_con_tasa CHECK (moneda = 'DOP' OR tasa IS NOT NULL),
  CONSTRAINT donacion_especie_descripcion CHECK (clase <> 'especie' OR length(trim(coalesce(descripcion_especie, ''))) >= 3),
  CONSTRAINT donacion_anulada_con_motivo CHECK (estado <> 'anulada' OR length(trim(coalesce(motivo_anulacion, ''))) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_donacion_tercero ON contabilidad.donacion(tercero_id, fecha DESC);

-- ----------------------------------------------------------------
-- 6) Promesas de Donación y Calendario de Cobro
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.promesa_donacion (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              bigint NOT NULL UNIQUE,
  tercero_id          uuid NOT NULL REFERENCES contabilidad.tercero(id),
  fecha_compromiso    date NOT NULL DEFAULT current_date,
  monto_total         numeric(14,2) NOT NULL CHECK (monto_total > 0),
  moneda              text NOT NULL DEFAULT 'DOP' CHECK (moneda IN ('DOP', 'USD')),
  frecuencia          text NOT NULL CHECK (frecuencia IN ('unica', 'mensual', 'trimestral', 'semestral', 'anual')),
  fondo_id            uuid NOT NULL REFERENCES contabilidad.fondo(id),
  proyecto_id         uuid REFERENCES public.proyecto(id),
  notas               text,
  estado              text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cumplida', 'cancelada')),
  creado_por          uuid NOT NULL REFERENCES public.usuario(id),
  creado_en           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contabilidad.promesa_cuota (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promesa_id          uuid NOT NULL REFERENCES contabilidad.promesa_donacion(id),
  numero_cuota        int NOT NULL CHECK (numero_cuota > 0),
  fecha_vencimiento   date NOT NULL,
  monto               numeric(14,2) NOT NULL CHECK (monto > 0),
  monto_cobrado       numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_cobrado >= 0),
  estado              text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cobrada', 'vencida', 'cancelada')),
  donacion_id         uuid REFERENCES contabilidad.donacion(id),
  recibo_id           uuid REFERENCES contabilidad.recibo(id),
  actualizado_en      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promesa_id, numero_cuota)
);

CREATE INDEX IF NOT EXISTS idx_promesa_cuota_vencimiento
  ON contabilidad.promesa_cuota(fecha_vencimiento) WHERE estado = 'pendiente';

-- ----------------------------------------------------------------
-- 7) Órdenes de Compra y Aprobación por Monto
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.orden_compra (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                bigint NOT NULL UNIQUE,
  proveedor_id          uuid NOT NULL REFERENCES contabilidad.proveedor(id),
  tercero_id            uuid REFERENCES contabilidad.tercero(id),
  fecha                 date NOT NULL DEFAULT current_date,
  fecha_entrega         date,
  moneda                text NOT NULL DEFAULT 'DOP' CHECK (moneda IN ('DOP', 'USD')),
  tasa                  numeric(12,4) CHECK (tasa > 0),
  subtotal              numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  itbis                 numeric(14,2) NOT NULL DEFAULT 0 CHECK (itbis >= 0),
  total                 numeric(14,2) GENERATED ALWAYS AS (subtotal + itbis) STORED,
  fondo_id              uuid NOT NULL REFERENCES contabilidad.fondo(id),
  categoria_id          uuid NOT NULL REFERENCES contabilidad.categoria(id),
  proyecto_id           uuid REFERENCES public.proyecto(id),
  estado                text NOT NULL DEFAULT 'borrador' CHECK (
                          estado IN ('borrador', 'pendiente_aprobacion', 'aprobada', 'rechazada', 'facturada', 'cancelada')
                        ),
  justificacion         text,
  creado_por            uuid NOT NULL REFERENCES public.usuario(id),
  creado_en             timestamptz NOT NULL DEFAULT now(),
  aprobado_por          uuid REFERENCES public.usuario(id),
  aprobado_en           timestamptz,
  motivo_rechazo        text
);

CREATE TABLE IF NOT EXISTS contabilidad.orden_compra_linea (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id       uuid NOT NULL REFERENCES contabilidad.orden_compra(id) ON DELETE CASCADE,
  numero_linea          int NOT NULL CHECK (numero_linea > 0),
  descripcion           text NOT NULL,
  cantidad              numeric(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario       numeric(14,2) NOT NULL CHECK (precio_unitario >= 0),
  itbis_tasa            numeric(6,4) NOT NULL DEFAULT 0.18 CHECK (itbis_tasa >= 0),
  monto_itbis           numeric(14,2) NOT NULL DEFAULT 0,
  subtotal              numeric(14,2) NOT NULL,
  total                 numeric(14,2) NOT NULL,
  UNIQUE (orden_compra_id, numero_linea)
);

ALTER TABLE contabilidad.factura_proveedor
  ADD COLUMN IF NOT EXISTS orden_compra_id uuid REFERENCES contabilidad.orden_compra(id);

-- ----------------------------------------------------------------
-- 8) Comprobantes de Retención
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.comprobante_retencion (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                      bigint NOT NULL UNIQUE,
  secuencia_interna           text NOT NULL UNIQUE,
  factura_id                  uuid NOT NULL REFERENCES contabilidad.factura_proveedor(id),
  proveedor_id                uuid NOT NULL REFERENCES contabilidad.proveedor(id),
  fecha_emision               date NOT NULL DEFAULT current_date,
  periodo_fiscal              text NOT NULL CHECK (periodo_fiscal ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  monto_facturado             numeric(14,2) NOT NULL CHECK (monto_facturado > 0),
  itbis_facturado             numeric(14,2) NOT NULL DEFAULT 0,
  monto_sujeto_itbis          numeric(14,2) NOT NULL DEFAULT 0,
  itbis_retenido              numeric(14,2) NOT NULL DEFAULT 0,
  tasa_itbis_retenido         numeric(6,4) NOT NULL DEFAULT 0,
  monto_sujeto_isr            numeric(14,2) NOT NULL DEFAULT 0,
  isr_retenido                numeric(14,2) NOT NULL DEFAULT 0,
  tasa_isr_retenido           numeric(6,4) NOT NULL DEFAULT 0,
  concepto                    text NOT NULL,
  estado                      text NOT NULL DEFAULT 'emitido' CHECK (estado IN ('emitido', 'anulado')),
  emitido_por                 uuid NOT NULL REFERENCES public.usuario(id),
  creado_en                   timestamptz NOT NULL DEFAULT now(),
  anulado_por                 uuid REFERENCES public.usuario(id),
  anulado_en                  timestamptz,
  motivo_anulacion            text
);

-- ----------------------------------------------------------------
-- 9) Sincronizar patrocinadores y proveedores iniciales a Tercero
-- ----------------------------------------------------------------
-- Poblar terceros con los patrocinadores existentes
INSERT INTO contabilidad.tercero (
  tipo_persona, tipo_id, identificacion, nombre_razon_social, email, telefono, es_donante, patrocinador_id, creado_por
)
SELECT
  CASE WHEN p.tipo IN ('empresa', 'ong', 'iglesia') THEN 'juridica' ELSE 'fisica' END,
  'rnc',
  lpad((row_number() OVER (ORDER BY p.id))::text, 9, '1'),
  p.nombre,
  p.email,
  p.telefono,
  true,
  p.id,
  (SELECT id FROM public.usuario WHERE email = 'sistema@globaleffect.org')
FROM public.patrocinador p
ON CONFLICT (tipo_id, identificacion) DO NOTHING;

-- Poblar terceros con los proveedores existentes
INSERT INTO contabilidad.tercero (
  tipo_persona, tipo_id, identificacion, nombre_razon_social, nombre_comercial, contacto_principal, telefono, email, direccion, es_proveedor, proveedor_id, creado_por
)
SELECT
  pr.tipo,
  CASE WHEN pr.tipo = 'juridica' THEN 'rnc' ELSE 'cedula' END,
  pr.identificacion,
  pr.nombre,
  pr.nombre_comercial,
  pr.contacto,
  pr.telefono,
  pr.email::citext,
  pr.direccion,
  true,
  pr.id,
  pr.creado_por
FROM contabilidad.proveedor pr
ON CONFLICT (tipo_id, identificacion) DO UPDATE
  SET es_proveedor = true, proveedor_id = EXCLUDED.proveedor_id;

-- ----------------------------------------------------------------
-- 10) Parámetros nuevos de umbrales
-- ----------------------------------------------------------------
INSERT INTO contabilidad.parametro (clave, valor, vigente_desde, vigente_hasta, fuente, nota) VALUES
  ('umbral_debida_diligencia_dop', '250000.00'::jsonb, '2026-01-01', '2099-01-01', 'Ley 155-17', 'Umbral de debida diligencia para donantes según Ley 155-17 (RD$)'),
  ('monto_aprobacion_oc_director', '50000.00'::jsonb, '2026-01-01', '2099-01-01', 'Manual de compras', 'Monto de orden de compra a partir del cual se exige aprobación de dirección (RD$)')
ON CONFLICT (clave, vigente_desde) DO NOTHING;

-- ----------------------------------------------------------------
-- 11) Auditoría y RLS
-- ----------------------------------------------------------------
SELECT contabilidad.auditar_tabla('contabilidad.tercero'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.debida_diligencia'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.donacion'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.promesa_donacion'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.promesa_cuota'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.orden_compra'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.orden_compra_linea'::regclass);
SELECT contabilidad.auditar_tabla('contabilidad.comprobante_retencion'::regclass);

ALTER TABLE contabilidad.tercero ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.debida_diligencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.donacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.promesa_donacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.promesa_cuota ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.orden_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.orden_compra_linea ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.comprobante_retencion ENABLE ROW LEVEL SECURITY;
