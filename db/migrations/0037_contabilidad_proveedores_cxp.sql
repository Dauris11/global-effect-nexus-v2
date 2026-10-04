-- ================================================================
-- GLOBAL EFFECT NEXUS — 0037 · Contabilidad: proveedores, facturas,
-- cuentas por pagar y pagos
-- ================================================================
-- Fase 3 de docs/prompts/portal-contabilidad.md (allí, 0036).
--
-- El flujo, de punta a punta:
--
--   factura (borrador) ──aprobar──▶ asiento de la factura
--                                    + cuenta por pagar (pendiente)
--   solicitud de gasto aprobada ───▶ cuenta por pagar (pendiente)
--
--   cuenta por pagar ──programar──▶ programada (fecha y cuenta de salida)
--                    ──pagar──────▶ pago + comprobante de egreso (CE)
--                                    + movimiento del banco + asiento,
--                                    todo en UNA transacción
--                                    → pagada_parcial | pagada
--
-- Decisiones:
--
--   · La factura se contabiliza al APROBARSE (devengo): el gasto es del
--     mes de la factura aunque se pague después, y la deuda queda en
--     "Proveedores". Al pagar, el comprobante de egreso carga a
--     Proveedores, no al gasto, para no contarlo dos veces. Por eso el
--     recibo gana `cuenta_contrapartida_id`.
--   · La cuenta por pagar que nace de una SOLICITUD no tiene factura ni
--     asiento propio: es un compromiso. Su pago va directo al gasto.
--   · Las cuentas bancarias del proveedor no se sobrescriben: cada cambio
--     es una fila nueva y la anterior queda inactiva con su fecha. Un
--     cambio de cuenta seguido de un pago es el fraude más común contra
--     una ONG (§3.7), y sin historial no se podría ni ver.
--   · `alerta` nace aquí con las dos reglas que esta fase ya puede
--     calcular; la Fase 9 añade las demás y el visor.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0037_contabilidad_proveedores_cxp.sql', true);

INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo) VALUES
  ('2.1.01.01', 'Proveedores nacionales', 'pasivo'),
  ('2.1.02.02', 'ITBIS retenido proveedores', 'pasivo'),
  ('2.1.02.03', 'ISR retenido proveedores', 'pasivo')
ON CONFLICT (codigo) DO NOTHING;

-- ----------------------------------------------------------------
-- 1. Alertas
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.alerta (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         text NOT NULL CHECK (tipo IN (
                 'hueco_numeracion', 'anulado_tras_pago', 'mismo_registra_aprueba',
                 'cambio_cuenta_proveedor', 'cambio_cuenta_y_pago', 'pago_fuera_horario',
                 'reapertura_periodo', 'diferencia_caja', 'proveedor_empleado',
                 'factura_duplicada')),
  severidad    text NOT NULL DEFAULT 'media' CHECK (severidad IN ('media', 'alta')),
  tabla        text,
  registro_id  uuid,
  -- Lo necesario para entender la alerta sin abrir cinco pantallas.
  detalle      jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  revisada_por uuid REFERENCES public.usuario(id),
  revisada_en  timestamptz,
  nota_revision text
);

CREATE INDEX IF NOT EXISTS idx_alerta_pendiente
  ON contabilidad.alerta (creado_en DESC) WHERE revisada_en IS NULL;

-- ----------------------------------------------------------------
-- 2. Proveedores y sus cuentas
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.proveedor (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                  text NOT NULL CHECK (tipo IN ('fisica', 'juridica')),
  -- RNC (9 dígitos) o cédula (11), solo dígitos. El dígito verificador
  -- lo comprueba src/lib/contabilidad/identificacion.ts.
  identificacion        text NOT NULL UNIQUE,
  nombre                text NOT NULL,
  nombre_comercial      text,
  contacto              text,
  telefono              text,
  email                 text,
  direccion             text,
  condiciones_pago_dias int  NOT NULL DEFAULT 30 CHECK (condiciones_pago_dias BETWEEN 0 AND 365),
  categoria_id          uuid REFERENCES contabilidad.categoria(id),
  estado                text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  creado_por            uuid NOT NULL REFERENCES public.usuario(id),
  creado_en             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proveedor_identificacion_formato CHECK (
    (tipo = 'juridica' AND identificacion ~ '^[0-9]{9}$') OR
    (tipo = 'fisica'   AND identificacion ~ '^[0-9]{11}$'))
);

CREATE TABLE IF NOT EXISTS contabilidad.proveedor_cuenta_bancaria (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id   uuid NOT NULL REFERENCES contabilidad.proveedor(id),
  banco          text NOT NULL,
  tipo           text NOT NULL CHECK (tipo IN ('corriente', 'ahorro')),
  moneda         text NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  numero         text NOT NULL,
  activa         boolean NOT NULL DEFAULT true,
  creado_por     uuid NOT NULL REFERENCES public.usuario(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  reemplazada_en timestamptz
);

-- Una cuenta activa por moneda: la que se usa para pagarle.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedor_cuenta_activa
  ON contabilidad.proveedor_cuenta_bancaria (proveedor_id, moneda) WHERE activa;

-- Registra una cuenta nueva del proveedor. La anterior de esa moneda se
-- desactiva (no se borra ni se edita) y, si existía, se levanta una
-- alerta: cambiar la cuenta de cobro es exactamente lo que haría quien
-- quisiera desviar un pago.
CREATE OR REPLACE FUNCTION contabilidad.cambiar_cuenta_proveedor(
  p_proveedor uuid, p_banco text, p_tipo text, p_moneda text, p_numero text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_anterior contabilidad.proveedor_cuenta_bancaria%ROWTYPE;
  v_id       uuid;
BEGIN
  SELECT * INTO v_anterior FROM contabilidad.proveedor_cuenta_bancaria
   WHERE proveedor_id = p_proveedor AND moneda = p_moneda AND activa
   FOR UPDATE;

  IF FOUND THEN
    UPDATE contabilidad.proveedor_cuenta_bancaria
       SET activa = false, reemplazada_en = now()
     WHERE id = v_anterior.id;
  END IF;

  INSERT INTO contabilidad.proveedor_cuenta_bancaria
         (proveedor_id, banco, tipo, moneda, numero, creado_por)
  VALUES (p_proveedor, p_banco, p_tipo, p_moneda, p_numero, contabilidad._usuario_actual())
  RETURNING id INTO v_id;

  IF v_anterior.id IS NOT NULL THEN
    INSERT INTO contabilidad.alerta (tipo, severidad, tabla, registro_id, detalle)
    VALUES ('cambio_cuenta_proveedor', 'media', 'proveedor', p_proveedor,
            jsonb_build_object('cuenta_anterior', right(v_anterior.numero, 4),
                               'cuenta_nueva', right(p_numero, 4),
                               'moneda', p_moneda,
                               'por', contabilidad._usuario_actual()));
  END IF;

  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------
-- 3. Facturas de proveedor
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.cuenta_por_pagar (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen             text NOT NULL CHECK (origen IN ('factura', 'solicitud')),
  factura_id         uuid UNIQUE,   -- FK se añade abajo (referencia cruzada)
  solicitud_id       uuid UNIQUE REFERENCES public.solicitud(id),
  proveedor_id       uuid REFERENCES contabilidad.proveedor(id),
  -- Para las que no tienen proveedor con ficha (una solicitud de gasto).
  beneficiario       text,
  concepto           text NOT NULL,
  moneda             text NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  monto              numeric(14,2) NOT NULL CHECK (monto > 0),
  pagado             numeric(14,2) NOT NULL DEFAULT 0 CHECK (pagado >= 0),
  saldo              numeric(14,2) GENERATED ALWAYS AS (monto - pagado) STORED,
  fecha_emision      date NOT NULL,
  fecha_vencimiento  date NOT NULL,
  fecha_programada   date,
  cuenta_salida_id   uuid REFERENCES contabilidad.cuenta_bancaria(id),
  categoria_id       uuid NOT NULL REFERENCES contabilidad.categoria(id),
  fondo_id           uuid NOT NULL REFERENCES contabilidad.fondo(id),
  proyecto_id        uuid REFERENCES public.proyecto(id),
  estado             text NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
                       'pendiente', 'programada', 'pagada_parcial', 'pagada', 'anulada')),
  creado_por         uuid NOT NULL REFERENCES public.usuario(id),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  anulado_por        uuid REFERENCES public.usuario(id),
  anulado_en         timestamptz,
  motivo_anulacion   text,
  CHECK (pagado <= monto),
  CHECK (fecha_vencimiento >= fecha_emision),
  CHECK ((origen = 'factura') = (factura_id IS NOT NULL)),
  CHECK ((origen = 'solicitud') = (solicitud_id IS NOT NULL)),
  CHECK (estado <> 'anulada' OR length(trim(coalesce(motivo_anulacion, ''))) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_cxp_vencimiento
  ON contabilidad.cuenta_por_pagar (fecha_vencimiento) WHERE estado NOT IN ('pagada', 'anulada');

CREATE TABLE IF NOT EXISTS contabilidad.factura_proveedor (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            bigint NOT NULL UNIQUE,       -- siguiente_numero('FP'), interno
  proveedor_id      uuid NOT NULL REFERENCES contabilidad.proveedor(id),
  -- NCF (B + tipo + 8 = 11) o e-CF (E + tipo + 10 = 13). NULL solo para
  -- un proveedor persona física sin comprobante: la Fundación tiene que
  -- emitir el comprobante de compras (lo avisa la pantalla).
  ncf               text CHECK (ncf IS NULL OR ncf ~ '^B[0-9]{10}$' OR ncf ~ '^E[0-9]{12}$'),
  fecha_emision     date NOT NULL,
  fecha_vencimiento date NOT NULL,
  periodo_id        uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  moneda            text NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  tasa              numeric(12,4) CHECK (tasa > 0),
  subtotal          numeric(14,2) NOT NULL CHECK (subtotal > 0),
  itbis             numeric(14,2) NOT NULL DEFAULT 0 CHECK (itbis >= 0),
  retencion_isr     numeric(14,2) NOT NULL DEFAULT 0 CHECK (retencion_isr >= 0),
  retencion_itbis   numeric(14,2) NOT NULL DEFAULT 0 CHECK (retencion_itbis >= 0),
  total             numeric(14,2) GENERATED ALWAYS AS (subtotal + itbis) STORED,
  -- Lo que de verdad se le paga al proveedor: el total menos lo retenido,
  -- que la Fundación entrega a la DGII en su nombre.
  neto              numeric(14,2) GENERATED ALWAYS AS
                      (subtotal + itbis - retencion_isr - retencion_itbis) STORED,
  concepto          text NOT NULL,
  categoria_id      uuid NOT NULL REFERENCES contabilidad.categoria(id),
  fondo_id          uuid NOT NULL REFERENCES contabilidad.fondo(id),
  proyecto_id       uuid REFERENCES public.proyecto(id),
  estado            text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobada', 'anulada')),
  asiento_id        uuid REFERENCES contabilidad.asiento(id),
  contra_asiento_id uuid REFERENCES contabilidad.asiento(id),
  cuenta_por_pagar_id uuid REFERENCES contabilidad.cuenta_por_pagar(id),
  creado_por        uuid NOT NULL REFERENCES public.usuario(id),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  aprobado_por      uuid REFERENCES public.usuario(id),
  aprobado_en       timestamptz,
  anulado_por       uuid REFERENCES public.usuario(id),
  anulado_en        timestamptz,
  motivo_anulacion  text,
  -- §4.4: el mismo NCF no se repite para el mismo RNC. Como el RNC es
  -- único por proveedor, basta con el par (proveedor, ncf).
  UNIQUE (proveedor_id, ncf),
  CHECK (fecha_vencimiento >= fecha_emision),
  CHECK (moneda = 'DOP' OR tasa IS NOT NULL),
  CHECK (subtotal + itbis - retencion_isr - retencion_itbis > 0),
  CHECK (estado <> 'anulada' OR length(trim(coalesce(motivo_anulacion, ''))) >= 5)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cxp_factura_fk') THEN
    ALTER TABLE contabilidad.cuenta_por_pagar
      ADD CONSTRAINT cxp_factura_fk FOREIGN KEY (factura_id)
      REFERENCES contabilidad.factura_proveedor(id);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS contabilidad.factura_adjunto (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id  uuid NOT NULL REFERENCES contabilidad.factura_proveedor(id),
  ruta        text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  tipo_mime   text NOT NULL,
  tamano      int  NOT NULL,
  sha256      text NOT NULL,
  activo      boolean NOT NULL DEFAULT true,
  subido_por  uuid NOT NULL REFERENCES public.usuario(id),
  creado_en   timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------
-- 4. Recibo: contrapartida propia y enlaces
-- ----------------------------------------------------------------

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS cuenta_contrapartida_id uuid REFERENCES contabilidad.cuenta_contable(id),
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES contabilidad.proveedor(id),
  ADD COLUMN IF NOT EXISTS cuenta_por_pagar_id uuid REFERENCES contabilidad.cuenta_por_pagar(id);

-- La misma función de la 0036 con un solo cambio: la contrapartida es la
-- del recibo si la trae (un pago de factura carga a Proveedores) y, si
-- no, la de su categoría.
CREATE OR REPLACE FUNCTION contabilidad.contabilizar_recibo(p_recibo uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r          contabilidad.recibo%ROWTYPE;
  v_cuenta   contabilidad.cuenta_bancaria%ROWTYPE;
  v_contra   uuid;
  v_tipo_mov text;
  v_monto_dop numeric(14,2);
  v_mov      uuid;
  v_asiento  uuid;
  v_serie    text;
BEGIN
  SELECT * INTO r FROM contabilidad.recibo WHERE id = p_recibo FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contabilidad: recibo % no existe', p_recibo;
  END IF;
  IF r.estado <> 'borrador' THEN
    RAISE EXCEPTION 'contabilidad: solo se contabiliza un borrador (este está %)', r.estado;
  END IF;

  SELECT * INTO v_cuenta FROM contabilidad.cuenta_bancaria WHERE id = r.cuenta_bancaria_id;
  IF v_cuenta.estado <> 'activa' THEN
    RAISE EXCEPTION 'contabilidad: la cuenta % está cerrada', v_cuenta.nombre;
  END IF;
  IF v_cuenta.moneda <> r.moneda THEN
    RAISE EXCEPTION 'contabilidad: el recibo es en % y la cuenta % lleva %',
      r.moneda, v_cuenta.nombre, v_cuenta.moneda;
  END IF;

  v_contra := coalesce(r.cuenta_contrapartida_id,
                       (SELECT cuenta_id FROM contabilidad.categoria WHERE id = r.categoria_id));
  IF v_contra IS NULL THEN
    RAISE EXCEPTION 'contabilidad: la categoría del recibo no tiene cuenta contable asignada';
  END IF;

  v_monto_dop := CASE r.moneda WHEN 'DOP' THEN r.monto ELSE round(r.monto * r.tasa, 2) END;

  v_tipo_mov := CASE
    WHEN r.tipo = 'ingreso' AND r.forma_pago = 'transferencia' THEN 'transferencia_recibida'
    WHEN r.tipo = 'ingreso' THEN 'deposito'
    WHEN r.forma_pago = 'cheque' THEN 'cheque'
    WHEN r.forma_pago = 'transferencia' THEN 'transferencia_enviada'
    ELSE 'debito'
  END;
  v_serie := CASE r.tipo WHEN 'ingreso' THEN 'RI' ELSE 'CE' END;

  INSERT INTO contabilidad.movimiento_bancario
         (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
          concepto, referencia, beneficiario, cheque_numero, estado_cheque,
          origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('MB'), r.cuenta_bancaria_id, r.periodo_id, r.fecha,
          v_tipo_mov, r.monto, r.moneda, r.tasa, v_monto_dop,
          r.concepto, r.referencia, r.beneficiario,
          CASE WHEN v_tipo_mov = 'cheque' THEN contabilidad.siguiente_numero('CH') END,
          CASE WHEN v_tipo_mov = 'cheque' THEN 'emitido' END,
          'recibo', r.id, contabilidad._usuario_actual())
  RETURNING id INTO v_mov;

  v_asiento := contabilidad.crear_asiento(
    r.fecha, v_serie || '-' || r.numero || ' ' || r.concepto, 'automatico', 'recibo', r.id,
    CASE r.tipo
      WHEN 'ingreso' THEN jsonb_build_array(
        jsonb_build_object('cuenta_id', v_cuenta.cuenta_contable_id, 'debe', v_monto_dop),
        jsonb_build_object('cuenta_id', v_contra, 'haber', v_monto_dop))
      ELSE jsonb_build_array(
        jsonb_build_object('cuenta_id', v_contra, 'debe', v_monto_dop),
        jsonb_build_object('cuenta_id', v_cuenta.cuenta_contable_id, 'haber', v_monto_dop))
    END);

  PERFORM set_config('app.accion', 'aprobar', true);
  UPDATE contabilidad.recibo
     SET estado = 'contabilizado', monto_dop = v_monto_dop,
         movimiento_id = v_mov, asiento_id = v_asiento,
         contabilizado_por = contabilidad._usuario_actual(), contabilizado_en = now()
   WHERE id = r.id;
  PERFORM set_config('app.accion', '', true);
END;
$$;

-- ----------------------------------------------------------------
-- 5. Aprobar y anular facturas
-- ----------------------------------------------------------------

-- Aprobar: el asiento de la factura (gasto contra Proveedores y
-- retenciones) y su cuenta por pagar por el NETO. En pesos, cada parte se
-- redondea por separado y la deuda con el proveedor absorbe el centavo
-- que sobre, para que el asiento cuadre siempre.
CREATE OR REPLACE FUNCTION contabilidad.aprobar_factura(p_factura uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  f        contabilidad.factura_proveedor%ROWTYPE;
  v_prov   contabilidad.proveedor%ROWTYPE;
  v_gasto  uuid;
  v_t      numeric := 1;
  v_total  numeric(14,2);
  v_isr    numeric(14,2);
  v_itbis  numeric(14,2);
  v_asiento uuid;
  v_cxp    uuid;
BEGIN
  SELECT * INTO f FROM contabilidad.factura_proveedor WHERE id = p_factura FOR UPDATE;
  IF NOT FOUND OR f.estado <> 'borrador' THEN
    RAISE EXCEPTION 'contabilidad: solo se aprueba una factura en borrador';
  END IF;
  SELECT * INTO v_prov FROM contabilidad.proveedor WHERE id = f.proveedor_id;
  SELECT cuenta_id INTO v_gasto FROM contabilidad.categoria WHERE id = f.categoria_id;
  IF v_gasto IS NULL THEN
    RAISE EXCEPTION 'contabilidad: la categoría de la factura no tiene cuenta contable asignada';
  END IF;

  IF f.moneda = 'USD' THEN v_t := f.tasa; END IF;
  v_total := round(f.total * v_t, 2);
  v_isr   := round(f.retencion_isr * v_t, 2);
  v_itbis := round(f.retencion_itbis * v_t, 2);

  v_asiento := contabilidad.crear_asiento(
    f.fecha_emision,
    'FP-' || f.numero || ' ' || v_prov.nombre || coalesce(' ' || f.ncf, ''),
    'automatico', 'factura_proveedor', f.id,
    jsonb_build_array(
      jsonb_build_object('cuenta_id', v_gasto, 'debe', v_total),
      jsonb_build_object('cuenta_id', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '2.1.01.01'),
                         'haber', v_total - v_isr - v_itbis, 'descripcion', v_prov.nombre),
      jsonb_build_object('cuenta_id', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '2.1.02.03'),
                         'haber', v_isr, 'descripcion', 'Retención ISR'),
      jsonb_build_object('cuenta_id', (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '2.1.02.02'),
                         'haber', v_itbis, 'descripcion', 'Retención ITBIS')));

  INSERT INTO contabilidad.cuenta_por_pagar
         (origen, factura_id, proveedor_id, concepto, moneda, monto, fecha_emision,
          fecha_vencimiento, categoria_id, fondo_id, proyecto_id, creado_por)
  VALUES ('factura', f.id, f.proveedor_id, f.concepto, f.moneda, f.neto, f.fecha_emision,
          f.fecha_vencimiento, f.categoria_id, f.fondo_id, f.proyecto_id, contabilidad._usuario_actual())
  RETURNING id INTO v_cxp;

  PERFORM set_config('app.accion', 'aprobar', true);
  UPDATE contabilidad.factura_proveedor
     SET estado = 'aprobada', asiento_id = v_asiento, cuenta_por_pagar_id = v_cxp,
         aprobado_por = contabilidad._usuario_actual(), aprobado_en = now()
   WHERE id = f.id;
  PERFORM set_config('app.accion', '', true);

  RETURN v_cxp;
END;
$$;

-- Anular una factura: si ya está aprobada, solo mientras su cuenta por
-- pagar no tenga pagos. Lo pagado no se anula: se ajusta.
CREATE OR REPLACE FUNCTION contabilidad.anular_factura(p_factura uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  f        contabilidad.factura_proveedor%ROWTYPE;
  v_contra uuid;
BEGIN
  IF length(trim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'contabilidad: anular exige un motivo';
  END IF;
  SELECT * INTO f FROM contabilidad.factura_proveedor WHERE id = p_factura FOR UPDATE;
  IF NOT FOUND OR f.estado = 'anulada' THEN
    RAISE EXCEPTION 'contabilidad: la factura no existe o ya está anulada';
  END IF;

  PERFORM set_config('app.accion', 'anular', true);
  PERFORM set_config('app.motivo', p_motivo, true);

  IF f.estado = 'aprobada' THEN
    IF (SELECT pagado FROM contabilidad.cuenta_por_pagar WHERE id = f.cuenta_por_pagar_id) > 0 THEN
      RAISE EXCEPTION 'contabilidad: la factura tiene pagos; registra un ajuste';
    END IF;
    UPDATE contabilidad.cuenta_por_pagar
       SET estado = 'anulada', anulado_por = contabilidad._usuario_actual(), anulado_en = now(),
           motivo_anulacion = p_motivo
     WHERE id = f.cuenta_por_pagar_id;
    v_contra := contabilidad.revertir_asiento(f.asiento_id, 'Anulación FP-' || f.numero);
  END IF;

  UPDATE contabilidad.factura_proveedor
     SET estado = 'anulada', contra_asiento_id = v_contra,
         anulado_por = contabilidad._usuario_actual(), anulado_en = now(), motivo_anulacion = p_motivo
   WHERE id = f.id;

  PERFORM set_config('app.accion', '', true);
  PERFORM set_config('app.motivo', '', true);
END;
$$;

-- ----------------------------------------------------------------
-- 6. Cuentas por pagar desde Solicitudes
-- ----------------------------------------------------------------

-- Se llama dentro de la MISMA transacción que aprueba la solicitud
-- (src/server/solicitudes/acciones.ts), no con un proceso aparte: si la
-- aprobación se deshace, la cuenta por pagar también. Idempotente: una
-- solicitud solo produce una cuenta por pagar.
--
-- El monto de una solicitud es en dólares (el umbral de dirección está en
-- USD). Categoría "Otros egresos" y fondo "General": el contable las
-- corrige al programar el pago, que es cuando sabe qué es.
CREATE OR REPLACE FUNCTION contabilidad.crear_cxp_desde_solicitud(p_solicitud uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  s    public.solicitud%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM contabilidad.cuenta_por_pagar WHERE solicitud_id = p_solicitud;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT * INTO s FROM public.solicitud WHERE id = p_solicitud;
  IF s.tipo <> 'gasto' OR s.monto IS NULL THEN
    RAISE EXCEPTION 'contabilidad: la solicitud % no es un gasto con monto', s.folio;
  END IF;

  INSERT INTO contabilidad.cuenta_por_pagar
         (origen, solicitud_id, beneficiario, concepto, moneda, monto, fecha_emision,
          fecha_vencimiento, categoria_id, fondo_id, creado_por)
  VALUES ('solicitud', s.id,
          (SELECT nombre FROM public.usuario WHERE id = s.solicitante_id),
          'Solicitud #' || s.folio || ': ' || s.titulo, 'USD', s.monto, CURRENT_DATE,
          greatest(coalesce(s.fecha_requerida, CURRENT_DATE + 15), CURRENT_DATE),
          (SELECT id FROM contabilidad.categoria WHERE nombre = 'Otros egresos'),
          (SELECT id FROM contabilidad.fondo WHERE nombre = 'General'),
          contabilidad._usuario_actual())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------
-- 7. Pagos
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.pago (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              bigint NOT NULL UNIQUE,    -- siguiente_numero('PG')
  cuenta_por_pagar_id uuid NOT NULL REFERENCES contabilidad.cuenta_por_pagar(id),
  fecha               date NOT NULL,
  periodo_id          uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  monto               numeric(14,2) NOT NULL CHECK (monto > 0),
  cuenta_bancaria_id  uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  recibo_id           uuid NOT NULL REFERENCES contabilidad.recibo(id),
  movimiento_id       uuid NOT NULL REFERENCES contabilidad.movimiento_bancario(id),
  creado_por          uuid NOT NULL REFERENCES public.usuario(id),
  creado_en           timestamptz NOT NULL DEFAULT now()
);

-- Pagar: UNA transacción que crea el comprobante de egreso (y con él el
-- movimiento y el asiento), el pago, y mueve la cuenta por pagar.
-- La cuenta de salida tiene que ir en la moneda de la deuda: pagar una
-- deuda en dólares desde la cuenta en pesos es una transferencia más un
-- pago, y se registran así, por separado.
CREATE OR REPLACE FUNCTION contabilidad.pagar_cxp(
  p_cxp uuid, p_cuenta uuid, p_fecha date, p_monto numeric,
  p_forma text, p_referencia text, p_tasa numeric
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  c        contabilidad.cuenta_por_pagar%ROWTYPE;
  v_banco  contabilidad.cuenta_bancaria%ROWTYPE;
  v_prov   contabilidad.proveedor%ROWTYPE;
  v_recibo uuid;
  v_pago   uuid;
  v_cambio timestamptz;
BEGIN
  SELECT * INTO c FROM contabilidad.cuenta_por_pagar WHERE id = p_cxp FOR UPDATE;
  IF NOT FOUND OR c.estado IN ('pagada', 'anulada') THEN
    RAISE EXCEPTION 'contabilidad: la cuenta por pagar no admite pagos (está %)', c.estado;
  END IF;
  IF p_monto <= 0 OR p_monto > c.saldo THEN
    RAISE EXCEPTION 'contabilidad: el pago supera el saldo pendiente (%)', c.saldo;
  END IF;

  SELECT * INTO v_banco FROM contabilidad.cuenta_bancaria WHERE id = p_cuenta;
  IF v_banco.moneda <> c.moneda THEN
    RAISE EXCEPTION 'contabilidad: la deuda es en % y la cuenta de salida en %', c.moneda, v_banco.moneda;
  END IF;
  IF c.moneda = 'USD' AND p_tasa IS NULL THEN
    RAISE EXCEPTION 'contabilidad: falta la tasa de cambio del pago';
  END IF;

  IF c.proveedor_id IS NOT NULL THEN
    SELECT * INTO v_prov FROM contabilidad.proveedor WHERE id = c.proveedor_id;
  END IF;

  INSERT INTO contabilidad.recibo
         (tipo, numero, fecha, periodo_id, cuenta_bancaria_id, moneda, tasa, monto, concepto,
          categoria_id, fondo_id, proyecto_id, beneficiario, forma_pago, referencia,
          cuenta_contrapartida_id, proveedor_id, cuenta_por_pagar_id, creado_por)
  VALUES ('egreso', contabilidad.siguiente_numero('CE'), p_fecha, contabilidad.periodo_para(p_fecha),
          p_cuenta, c.moneda, CASE c.moneda WHEN 'USD' THEN p_tasa END, p_monto,
          'Pago: ' || c.concepto, c.categoria_id, c.fondo_id, c.proyecto_id,
          coalesce(v_prov.nombre, c.beneficiario), p_forma, p_referencia,
          -- Deuda devengada (factura) → Proveedores; compromiso (solicitud) → gasto.
          CASE c.origen WHEN 'factura'
               THEN (SELECT id FROM contabilidad.cuenta_contable WHERE codigo = '2.1.01.01') END,
          c.proveedor_id, c.id, contabilidad._usuario_actual())
  RETURNING id INTO v_recibo;

  PERFORM contabilidad.contabilizar_recibo(v_recibo);

  INSERT INTO contabilidad.pago
         (numero, cuenta_por_pagar_id, fecha, periodo_id, monto, cuenta_bancaria_id,
          recibo_id, movimiento_id, creado_por)
  VALUES (contabilidad.siguiente_numero('PG'), c.id, p_fecha, contabilidad.periodo_para(p_fecha),
          p_monto, p_cuenta, v_recibo,
          (SELECT movimiento_id FROM contabilidad.recibo WHERE id = v_recibo),
          contabilidad._usuario_actual())
  RETURNING id INTO v_pago;

  PERFORM set_config('app.accion', 'pagar', true);
  UPDATE contabilidad.cuenta_por_pagar
     SET pagado = pagado + p_monto,
         estado = CASE WHEN pagado + p_monto = monto THEN 'pagada' ELSE 'pagada_parcial' END
   WHERE id = c.id;
  PERFORM set_config('app.accion', '', true);

  -- §3.7: cuenta del proveedor cambiada hace menos de 7 días y ya se le
  -- paga. No bloquea (el cambio puede ser legítimo), pero lo ve el auditor.
  IF c.proveedor_id IS NOT NULL THEN
    SELECT max(creado_en) INTO v_cambio
      FROM contabilidad.proveedor_cuenta_bancaria
     WHERE proveedor_id = c.proveedor_id AND reemplazada_en IS NULL
       AND creado_en > now() - interval '7 days'
       AND EXISTS (SELECT 1 FROM contabilidad.proveedor_cuenta_bancaria a
                    WHERE a.proveedor_id = c.proveedor_id AND a.reemplazada_en IS NOT NULL);
    IF v_cambio IS NOT NULL THEN
      INSERT INTO contabilidad.alerta (tipo, severidad, tabla, registro_id, detalle)
      VALUES ('cambio_cuenta_y_pago', 'alta', 'pago', v_pago,
              jsonb_build_object('proveedor', v_prov.nombre, 'cuenta_cambiada_en', v_cambio,
                                 'monto', p_monto, 'moneda', c.moneda));
    END IF;
  END IF;

  RETURN v_pago;
END;
$$;

-- ----------------------------------------------------------------
-- 8. Bitácora, sin borrado y período cerrado
-- ----------------------------------------------------------------

SELECT contabilidad.auditar_tabla(t)
  FROM unnest(ARRAY[
    'contabilidad.alerta', 'contabilidad.proveedor', 'contabilidad.proveedor_cuenta_bancaria',
    'contabilidad.cuenta_por_pagar', 'contabilidad.factura_proveedor', 'contabilidad.factura_adjunto',
    'contabilidad.pago'
  ]::regclass[]) AS t;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA contabilidad FROM anon, authenticated;
  END IF;
END;
$$;
