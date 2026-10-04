-- ================================================================
-- GLOBAL EFFECT NEXUS — 0036 · Contabilidad: bancos, libros,
-- recibos, transferencias y conciliación
-- ================================================================
-- Fase 2 de docs/prompts/portal-contabilidad.md (allí figura como
-- 0035; ese número lo ocupó el arreglo de la bitácora).
--
-- Decisiones que conviene no deshacer sin pensarlo:
--
--   · El MONTO va siempre en positivo y el signo lo pone el TIPO. Un
--     movimiento con `monto` -50 y otro con 50 de tipo opuesto serían
--     la misma fila con dos significados. `importe` es la columna
--     calculada con signo y es la que suma el saldo corrido.
--
--   · Toda fila guarda su `monto_dop`. Los libros se llevan en la
--     moneda de la cuenta, pero los asientos van en pesos (moneda
--     funcional, §1.3), y recalcular el equivalente con la tasa de
--     hoy cambiaría el pasado.
--
--   · Contabilizar, anular y transferir son FUNCIONES de la base y no
--     código de la app. Así el recibo, el movimiento del banco y el
--     asiento salen o no salen juntos, y la regla vale también para
--     quien opere por SQL.
--
--   · El número del recibo se asigna al CREAR el borrador, no al
--     contabilizar. Un borrador no se borra (se anula), así que su
--     número no deja hueco; asignarlo al contabilizar haría que los
--     números no siguieran el orden en que se emitieron los papeles.
--
--   · `recibo.cuenta_bancaria_id` es obligatoria por ahora con una
--     restricción con nombre propio (`recibo_origen_fondos`). La Fase 4
--     la sustituye por "cuenta bancaria o caja" cuando exista `caja`.
--
--   · `public.transaccion` deja de ser una tabla: sus filas pasan a
--     recibos contabilizados en "Santa Cruz USD" y queda una VISTA de
--     solo lectura con la misma forma, para que el panel general,
--     /reportes y el asistente sigan funcionando hasta la Fase 7.
-- ================================================================

-- ----------------------------------------------------------------
-- 0. Usuario de sistema
-- ----------------------------------------------------------------

-- La bitácora no admite escrituras anónimas (0033), tampoco las de
-- una migración. Este usuario está INACTIVO: obtenerUsuarioActual()
-- lo rechaza y no puede iniciar sesión. Solo pone nombre a lo que
-- hacen las migraciones y los procesos programados.
INSERT INTO public.usuario (email, nombre, idioma, activo, rol_id)
SELECT 'sistema@globaleffect.org', 'Sistema (migraciones)', 'es', false, r.id
  FROM public.rol r
 WHERE r.nombre = 'super_admin'
ON CONFLICT (email) DO NOTHING;

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0036_contabilidad_bancos_recibos.sql', true);

-- ----------------------------------------------------------------
-- 1. Catálogo que necesitan las funciones de abajo
-- ----------------------------------------------------------------

-- El seed también las crea, con su padre. Aquí van por si la base se
-- migra antes de sembrar: contabilizar no puede depender del orden en
-- que alguien corrió los scripts.
INSERT INTO contabilidad.cuenta_contable (codigo, nombre, tipo) VALUES
  ('1.1.02.01', 'Banco Santa Cruz - DOP', 'activo'),
  ('1.1.02.02', 'Banco Santa Cruz - USD', 'activo'),
  ('4.9.01.03', 'Diferencia cambiaria (ganancia)', 'ingreso'),
  ('5.3.01.02', 'Diferencial cambiario', 'gasto')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO contabilidad.secuencia (clave, prefijo) VALUES
  ('TR', 'TR-'), ('MB', 'MB-')
ON CONFLICT (clave) DO NOTHING;

-- Puente con las categorías de texto libre de la 0011. Sirve para la
-- migración de abajo y para que la vista `transaccion` siga
-- devolviendo los códigos que esperan el panel y /reportes.
ALTER TABLE contabilidad.categoria
  ADD COLUMN IF NOT EXISTS codigo_legado text
  CHECK (codigo_legado IN ('beca','donacion','operativo','salario','material','evento','otro'));

-- ----------------------------------------------------------------
-- 2. Bancos y cuentas
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.banco (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  -- Clave del adaptador en src/server/contabilidad/bancos/. Lo
  -- específico de cada banco (formato del estado de cuenta y del
  -- archivo de nómina) vive en código; el banco en sí, aquí.
  adaptador   text NOT NULL DEFAULT 'generico',
  -- Columnas del CSV del estado de cuenta (ColumnasEstado en
  -- adaptador.ts). Se editan en Configuración sin tocar código.
  config_estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  activo      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contabilidad.cuenta_bancaria (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_id            uuid NOT NULL REFERENCES contabilidad.banco(id),
  nombre              text NOT NULL UNIQUE,  -- "Santa Cruz USD"
  -- Completo en la base, ENMASCARADO en pantalla (solo los 4 últimos).
  numero              text NOT NULL,
  tipo                text NOT NULL DEFAULT 'corriente'
                      CHECK (tipo IN ('corriente', 'ahorro')),
  moneda              text NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  cuenta_contable_id  uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  saldo_inicial       numeric(14,2) NOT NULL DEFAULT 0,
  fecha_saldo_inicial date NOT NULL DEFAULT CURRENT_DATE,
  estado              text NOT NULL DEFAULT 'activa'
                      CHECK (estado IN ('activa', 'cerrada')),
  creado_en           timestamptz NOT NULL DEFAULT now()
);

-- Los números son DEMO: los reales los carga el contable en
-- Configuración y nunca van en git (§6.4).
INSERT INTO contabilidad.banco (nombre, adaptador, config_estado)
VALUES ('Banco Múltiple Santa Cruz', 'santa-cruz',
        '{"fecha":"Fecha","descripcion":"Descripcion","referencia":"Referencia",
          "debito":"Debito","credito":"Credito","saldo":"Balance",
          "formatoFecha":"DD/MM/YYYY","separadorDecimal":"."}'::jsonb)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO contabilidad.cuenta_bancaria
       (banco_id, nombre, numero, moneda, cuenta_contable_id)
SELECT b.id, v.nombre, v.numero, v.moneda, c.id
  FROM contabilidad.banco b
  JOIN (VALUES ('Santa Cruz USD', 'DEMO-0000-USD1', 'USD', '1.1.02.02'),
               ('Santa Cruz DOP', 'DEMO-0000-DOP1', 'DOP', '1.1.02.01'))
       AS v(nombre, numero, moneda, codigo) ON true
  JOIN contabilidad.cuenta_contable c ON c.codigo = v.codigo
 WHERE b.nombre = 'Banco Múltiple Santa Cruz'
ON CONFLICT (nombre) DO NOTHING;

-- ----------------------------------------------------------------
-- 3. Movimientos del libro de banco
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.conciliacion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id      uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  desde          date NOT NULL,
  hasta          date NOT NULL,
  -- Saldo final según el estado de cuenta del banco, en la moneda de
  -- la cuenta.
  saldo_banco    numeric(14,2) NOT NULL,
  archivo_nombre text,
  -- Para saber, si alguien dice que el banco mandó otro archivo, qué
  -- archivo exactamente se usó.
  archivo_sha256 text,
  estado         text NOT NULL DEFAULT 'abierta'
                 CHECK (estado IN ('abierta', 'cerrada')),
  creado_por     uuid NOT NULL REFERENCES public.usuario(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  cerrada_por    uuid REFERENCES public.usuario(id),
  cerrada_en     timestamptz,
  CHECK (hasta >= desde)
);

CREATE TABLE IF NOT EXISTS contabilidad.movimiento_bancario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          bigint NOT NULL UNIQUE,         -- siguiente_numero('MB')
  cuenta_id       uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  periodo_id      uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  fecha           date NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN (
                    'deposito', 'cheque', 'transferencia_enviada',
                    'transferencia_recibida', 'debito', 'credito', 'comision')),
  monto           numeric(14,2) NOT NULL CHECK (monto > 0),
  importe         numeric(14,2) GENERATED ALWAYS AS (
                    CASE WHEN tipo IN ('deposito', 'transferencia_recibida', 'credito')
                         THEN monto ELSE -monto END) STORED,
  moneda          text NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  tasa            numeric(12,4) CHECK (tasa > 0),
  -- NULL solo en lo migrado de `transaccion`, que nunca tuvo tasa.
  monto_dop       numeric(14,2),
  concepto        text NOT NULL,
  referencia      text,
  beneficiario    text,
  cheque_numero   bigint,
  estado_cheque   text CHECK (estado_cheque IN ('emitido', 'entregado', 'cobrado', 'anulado')),
  estado          text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulado')),
  conciliacion_id uuid REFERENCES contabilidad.conciliacion(id),
  -- De dónde salió: un recibo o una transferencia interna.
  origen_tabla    text,
  origen_id       uuid,
  creado_por      uuid NOT NULL REFERENCES public.usuario(id),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  anulado_por     uuid REFERENCES public.usuario(id),
  anulado_en      timestamptz,
  motivo_anulacion text,
  CONSTRAINT movimiento_usd_con_tasa
    CHECK (moneda = 'DOP' OR tasa IS NOT NULL OR monto_dop IS NULL),
  CONSTRAINT movimiento_cheque_completo
    CHECK ((tipo = 'cheque') = (cheque_numero IS NOT NULL AND estado_cheque IS NOT NULL)),
  CONSTRAINT movimiento_anulado_con_motivo
    CHECK (estado = 'vigente' OR length(trim(coalesce(motivo_anulacion, ''))) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_movimiento_cuenta_fecha
  ON contabilidad.movimiento_bancario (cuenta_id, fecha, numero);
CREATE INDEX IF NOT EXISTS idx_movimiento_conciliacion
  ON contabilidad.movimiento_bancario (conciliacion_id);

CREATE TABLE IF NOT EXISTS contabilidad.conciliacion_linea (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacion_id uuid NOT NULL REFERENCES contabilidad.conciliacion(id),
  linea           int  NOT NULL,          -- línea del archivo, para encontrarla
  fecha           date NOT NULL,
  descripcion     text NOT NULL,
  referencia      text,
  monto           numeric(14,2) NOT NULL, -- con signo, como lo dice el banco
  saldo           numeric(14,2),
  movimiento_id   uuid REFERENCES contabilidad.movimiento_bancario(id),
  -- false = propuesta del sistema; true = el contable la confirmó.
  confirmada      boolean NOT NULL DEFAULT false,
  UNIQUE (conciliacion_id, linea),
  CHECK (NOT confirmada OR movimiento_id IS NOT NULL)
);

-- Un movimiento solo puede emparejarse con una línea por conciliación.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conciliacion_linea_movimiento
  ON contabilidad.conciliacion_linea (conciliacion_id, movimiento_id)
  WHERE movimiento_id IS NOT NULL;

-- ----------------------------------------------------------------
-- 4. Recibos y transferencias
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contabilidad.recibo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Un solo módulo con dos tipos (§4.3): el ingreso numera en RI y el
  -- egreso en CE.
  tipo               text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  numero             bigint NOT NULL,
  fecha              date NOT NULL,
  periodo_id         uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  cuenta_bancaria_id uuid REFERENCES contabilidad.cuenta_bancaria(id),
  moneda             text NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  tasa               numeric(12,4) CHECK (tasa > 0),
  monto              numeric(14,2) NOT NULL CHECK (monto > 0),
  monto_dop          numeric(14,2),
  concepto           text NOT NULL,
  categoria_id       uuid NOT NULL REFERENCES contabilidad.categoria(id),
  fondo_id           uuid NOT NULL REFERENCES contabilidad.fondo(id),
  proyecto_id        uuid REFERENCES public.proyecto(id),
  -- Ingreso: quién dio el dinero. Egreso: a quién se le pagó. El
  -- proveedor con ficha llega en la Fase 3 (proveedor_id).
  patrocinador_id    uuid REFERENCES public.patrocinador(id),
  beneficiario       text,
  forma_pago         text NOT NULL
                     CHECK (forma_pago IN ('efectivo', 'cheque', 'transferencia', 'tarjeta')),
  referencia         text,
  notas              text,
  estado             text NOT NULL DEFAULT 'borrador'
                     CHECK (estado IN ('borrador', 'contabilizado', 'anulado')),
  movimiento_id      uuid REFERENCES contabilidad.movimiento_bancario(id),
  asiento_id         uuid REFERENCES contabilidad.asiento(id),
  contra_asiento_id  uuid REFERENCES contabilidad.asiento(id),
  creado_por         uuid NOT NULL REFERENCES public.usuario(id),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  contabilizado_por  uuid REFERENCES public.usuario(id),
  contabilizado_en   timestamptz,
  anulado_por        uuid REFERENCES public.usuario(id),
  anulado_en         timestamptz,
  motivo_anulacion   text,
  -- Rastro de la 0011: id de la fila de `transaccion` de la que salió.
  migrado_de         uuid UNIQUE,
  UNIQUE (tipo, numero),
  CONSTRAINT recibo_origen_fondos CHECK (cuenta_bancaria_id IS NOT NULL),
  CONSTRAINT recibo_usd_con_tasa
    CHECK (moneda = 'DOP' OR tasa IS NOT NULL OR migrado_de IS NOT NULL),
  CONSTRAINT recibo_contabilizado_completo
    CHECK (estado <> 'contabilizado'
           OR (contabilizado_por IS NOT NULL AND movimiento_id IS NOT NULL
               AND (asiento_id IS NOT NULL OR migrado_de IS NOT NULL))),
  CONSTRAINT recibo_anulado_con_motivo
    CHECK (estado <> 'anulado' OR length(trim(coalesce(motivo_anulacion, ''))) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_recibo_fecha ON contabilidad.recibo (fecha DESC, numero DESC);
CREATE INDEX IF NOT EXISTS idx_recibo_cuenta ON contabilidad.recibo (cuenta_bancaria_id);

CREATE TABLE IF NOT EXISTS contabilidad.recibo_adjunto (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recibo_id   uuid NOT NULL REFERENCES contabilidad.recibo(id),
  ruta        text NOT NULL UNIQUE,     -- clave dentro del bucket `contabilidad`
  nombre      text NOT NULL,            -- el nombre que traía el archivo, solo para mostrar
  tipo_mime   text NOT NULL,
  tamano      int  NOT NULL,
  -- Si alguien sustituye el archivo en Storage, el hash ya no coincide.
  sha256      text NOT NULL,
  activo      boolean NOT NULL DEFAULT true,  -- archivar, no borrar
  subido_por  uuid NOT NULL REFERENCES public.usuario(id),
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contabilidad.transferencia_interna (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                bigint NOT NULL UNIQUE,   -- siguiente_numero('TR')
  fecha                 date NOT NULL,
  periodo_id            uuid NOT NULL REFERENCES contabilidad.periodo_contable(id),
  cuenta_origen_id      uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  cuenta_destino_id     uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  monto_origen          numeric(14,2) NOT NULL CHECK (monto_origen > 0),
  monto_destino         numeric(14,2) NOT NULL CHECK (monto_destino > 0),
  -- La que aplicó el banco (pesos por dólar), deducida de los dos montos.
  tasa_aplicada         numeric(12,4),
  -- La del día en tasa_cambio, con la que se valora el lado en dólares.
  tasa_referencia       numeric(12,4),
  diferencia_cambiaria  numeric(14,2) NOT NULL DEFAULT 0,
  concepto              text NOT NULL,
  referencia            text,
  movimiento_salida_id  uuid NOT NULL REFERENCES contabilidad.movimiento_bancario(id),
  movimiento_entrada_id uuid NOT NULL REFERENCES contabilidad.movimiento_bancario(id),
  asiento_id            uuid NOT NULL REFERENCES contabilidad.asiento(id),
  creado_por            uuid NOT NULL REFERENCES public.usuario(id),
  creado_en             timestamptz NOT NULL DEFAULT now(),
  CHECK (cuenta_origen_id <> cuenta_destino_id)
);

-- ----------------------------------------------------------------
-- 5. Funciones de apoyo
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION contabilidad._usuario_actual()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.usuario_id', true), '')::uuid;
$$;

-- El período de una fecha. Si el mes todavía no existe, se abre: los
-- períodos se CIERRAN a mano (con permiso), pero abrirlos es solo
-- tener calendario. Si existe y está cerrado, _fn_contabilidad_proteger
-- rechazará la fila que lo use.
CREATE OR REPLACE FUNCTION contabilidad.periodo_para(p_fecha date)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM contabilidad.periodo_contable
   WHERE anio = extract(year FROM p_fecha) AND mes = extract(month FROM p_fecha);
  IF v_id IS NULL THEN
    INSERT INTO contabilidad.periodo_contable (anio, mes)
    VALUES (extract(year FROM p_fecha), extract(month FROM p_fecha))
    ON CONFLICT (anio, mes) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN  -- otra transacción lo creó a la vez
      SELECT id INTO v_id FROM contabilidad.periodo_contable
       WHERE anio = extract(year FROM p_fecha) AND mes = extract(month FROM p_fecha);
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- Tasa de referencia para valorar dólares en pesos: la VENTA del BCRD
-- del día o, si ese día no hubo (fin de semana), la última anterior.
-- Pendiente de validar con el contador si prefiere compra o promedio.
CREATE OR REPLACE FUNCTION contabilidad.tasa_referencia(p_fecha date)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT venta FROM contabilidad.tasa_cambio
   WHERE fecha <= p_fecha ORDER BY fecha DESC LIMIT 1;
$$;

-- Crea un asiento con sus líneas. `p_lineas` es un arreglo jsonb de
-- {cuenta_id, debe, haber, descripcion}. Las líneas con debe y haber
-- en cero se omiten (una diferencia cambiaria nula no es una línea).
-- El cuadre lo comprueba el disparador diferido al COMMIT.
CREATE OR REPLACE FUNCTION contabilidad.crear_asiento(
  p_fecha date, p_concepto text, p_tipo text,
  p_origen_tabla text, p_origen_id uuid, p_lineas jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO contabilidad.asiento
         (numero, fecha, periodo_id, concepto, tipo, origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('AS'), p_fecha, contabilidad.periodo_para(p_fecha),
          p_concepto, p_tipo, p_origen_tabla, p_origen_id, contabilidad._usuario_actual())
  RETURNING id INTO v_id;

  INSERT INTO contabilidad.asiento_linea (asiento_id, cuenta_id, debe, haber, descripcion)
  SELECT v_id, (l ->> 'cuenta_id')::uuid,
         coalesce((l ->> 'debe')::numeric, 0), coalesce((l ->> 'haber')::numeric, 0),
         l ->> 'descripcion'
    FROM jsonb_array_elements(p_lineas) AS l
   WHERE coalesce((l ->> 'debe')::numeric, 0) <> 0
      OR coalesce((l ->> 'haber')::numeric, 0) <> 0;

  RETURN v_id;
END;
$$;

-- Contra-asiento: las mismas líneas con debe y haber cruzados, con
-- fecha de HOY. Si el asiento original está en un período cerrado, el
-- contra-asiento cae en el abierto, que es lo que pide la §1.6.
CREATE OR REPLACE FUNCTION contabilidad.revertir_asiento(p_asiento uuid, p_concepto text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_original contabilidad.asiento%ROWTYPE;
BEGIN
  SELECT * INTO v_original FROM contabilidad.asiento WHERE id = p_asiento;
  RETURN contabilidad.crear_asiento(
    CURRENT_DATE, p_concepto, 'ajuste', v_original.origen_tabla, v_original.origen_id,
    (SELECT jsonb_agg(jsonb_build_object(
              'cuenta_id', l.cuenta_id, 'debe', l.haber, 'haber', l.debe,
              'descripcion', l.descripcion))
       FROM contabilidad.asiento_linea l WHERE l.asiento_id = p_asiento));
END;
$$;

-- ----------------------------------------------------------------
-- 6. Contabilizar y anular un recibo
-- ----------------------------------------------------------------

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

  SELECT cuenta_id INTO v_contra FROM contabilidad.categoria WHERE id = r.categoria_id;
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

CREATE OR REPLACE FUNCTION contabilidad.anular_recibo(p_recibo uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r       contabilidad.recibo%ROWTYPE;
  v_mov   contabilidad.movimiento_bancario%ROWTYPE;
  v_contra uuid;
BEGIN
  IF length(trim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'contabilidad: anular exige un motivo';
  END IF;

  SELECT * INTO r FROM contabilidad.recibo WHERE id = p_recibo FOR UPDATE;
  IF NOT FOUND OR r.estado = 'anulado' THEN
    RAISE EXCEPTION 'contabilidad: el recibo no existe o ya está anulado';
  END IF;

  PERFORM set_config('app.accion', 'anular', true);
  PERFORM set_config('app.motivo', p_motivo, true);

  IF r.estado = 'contabilizado' THEN
    SELECT * INTO v_mov FROM contabilidad.movimiento_bancario WHERE id = r.movimiento_id FOR UPDATE;
    IF v_mov.conciliacion_id IS NOT NULL THEN
      RAISE EXCEPTION 'contabilidad: el movimiento ya está conciliado; registra un ajuste';
    END IF;
    IF v_mov.estado_cheque = 'cobrado' THEN
      RAISE EXCEPTION 'contabilidad: el cheque ya se cobró; registra un ajuste';
    END IF;

    UPDATE contabilidad.movimiento_bancario
       SET estado = 'anulado',
           estado_cheque = CASE WHEN tipo = 'cheque' THEN 'anulado' END,
           anulado_por = contabilidad._usuario_actual(), anulado_en = now(),
           motivo_anulacion = p_motivo
     WHERE id = v_mov.id;

    IF r.asiento_id IS NOT NULL THEN
      v_contra := contabilidad.revertir_asiento(r.asiento_id, 'Anulación: ' || r.concepto);
    END IF;
  END IF;

  UPDATE contabilidad.recibo
     SET estado = 'anulado', contra_asiento_id = v_contra,
         anulado_por = contabilidad._usuario_actual(), anulado_en = now(),
         motivo_anulacion = p_motivo
   WHERE id = r.id;

  PERFORM set_config('app.accion', '', true);
  PERFORM set_config('app.motivo', '', true);
END;
$$;

-- ----------------------------------------------------------------
-- 7. Transferencia entre cuentas propias
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION contabilidad.transferir(
  p_origen uuid, p_destino uuid, p_fecha date,
  p_monto_origen numeric, p_monto_destino numeric,
  p_concepto text, p_referencia text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  o          contabilidad.cuenta_bancaria%ROWTYPE;
  d          contabilidad.cuenta_bancaria%ROWTYPE;
  v_destino  numeric(14,2) := coalesce(p_monto_destino, p_monto_origen);
  v_ref      numeric(12,4);
  v_aplicada numeric(12,4);
  v_dop_o    numeric(14,2);
  v_dop_d    numeric(14,2);
  v_dif      numeric(14,2);
  v_periodo  uuid := contabilidad.periodo_para(p_fecha);
  v_id       uuid := gen_random_uuid();
  v_numero   bigint := contabilidad.siguiente_numero('TR');
  v_salida   uuid;
  v_entrada  uuid;
  v_asiento  uuid;
BEGIN
  SELECT * INTO o FROM contabilidad.cuenta_bancaria WHERE id = p_origen;
  SELECT * INTO d FROM contabilidad.cuenta_bancaria WHERE id = p_destino;
  IF o.id IS NULL OR d.id IS NULL OR o.id = d.id THEN
    RAISE EXCEPTION 'contabilidad: cuentas de la transferencia no válidas';
  END IF;
  IF o.estado <> 'activa' OR d.estado <> 'activa' THEN
    RAISE EXCEPTION 'contabilidad: una de las cuentas está cerrada';
  END IF;
  IF o.moneda = d.moneda AND v_destino <> p_monto_origen THEN
    RAISE EXCEPTION 'contabilidad: entre cuentas de la misma moneda sale y entra lo mismo';
  END IF;

  IF o.moneda = 'USD' OR d.moneda = 'USD' THEN
    v_ref := contabilidad.tasa_referencia(p_fecha);
    IF v_ref IS NULL THEN
      RAISE EXCEPTION 'contabilidad: no hay tasa de cambio registrada en o antes de %', p_fecha;
    END IF;
  END IF;
  IF o.moneda <> d.moneda THEN
    v_aplicada := CASE o.moneda WHEN 'DOP' THEN round(p_monto_origen / v_destino, 4)
                                ELSE round(v_destino / p_monto_origen, 4) END;
  END IF;

  -- Los dos lados en pesos con la MISMA tasa de referencia. Lo que no
  -- cuadra es lo que el banco cobró (o regaló) en el cambio.
  v_dop_o := CASE o.moneda WHEN 'DOP' THEN p_monto_origen ELSE round(p_monto_origen * v_ref, 2) END;
  v_dop_d := CASE d.moneda WHEN 'DOP' THEN v_destino ELSE round(v_destino * v_ref, 2) END;
  v_dif   := v_dop_d - v_dop_o;

  INSERT INTO contabilidad.movimiento_bancario
         (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
          concepto, referencia, origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('MB'), o.id, v_periodo, p_fecha, 'transferencia_enviada',
          p_monto_origen, o.moneda, CASE o.moneda WHEN 'USD' THEN v_ref END, v_dop_o,
          p_concepto, p_referencia, 'transferencia_interna', v_id, contabilidad._usuario_actual())
  RETURNING id INTO v_salida;

  INSERT INTO contabilidad.movimiento_bancario
         (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, tasa, monto_dop,
          concepto, referencia, origen_tabla, origen_id, creado_por)
  VALUES (contabilidad.siguiente_numero('MB'), d.id, v_periodo, p_fecha, 'transferencia_recibida',
          v_destino, d.moneda, CASE d.moneda WHEN 'USD' THEN v_ref END, v_dop_d,
          p_concepto, p_referencia, 'transferencia_interna', v_id, contabilidad._usuario_actual())
  RETURNING id INTO v_entrada;

  v_asiento := contabilidad.crear_asiento(
    p_fecha, 'TR-' || v_numero || ' ' || p_concepto, 'automatico', 'transferencia_interna', v_id,
    jsonb_build_array(
      jsonb_build_object('cuenta_id', d.cuenta_contable_id, 'debe', v_dop_d),
      jsonb_build_object('cuenta_id', o.cuenta_contable_id, 'haber', v_dop_o),
      jsonb_build_object(
        'cuenta_id', (SELECT id FROM contabilidad.cuenta_contable
                       WHERE codigo = CASE WHEN v_dif > 0 THEN '4.9.01.03' ELSE '5.3.01.02' END),
        'debe',  greatest(-v_dif, 0),
        'haber', greatest(v_dif, 0),
        'descripcion', 'Diferencia cambiaria')));

  INSERT INTO contabilidad.transferencia_interna
         (id, numero, fecha, periodo_id, cuenta_origen_id, cuenta_destino_id,
          monto_origen, monto_destino, tasa_aplicada, tasa_referencia, diferencia_cambiaria,
          concepto, referencia, movimiento_salida_id, movimiento_entrada_id, asiento_id, creado_por)
  VALUES (v_id, v_numero, p_fecha, v_periodo, o.id, d.id,
          p_monto_origen, v_destino, v_aplicada, v_ref, v_dif,
          p_concepto, p_referencia, v_salida, v_entrada, v_asiento, contabilidad._usuario_actual());

  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------
-- 8. Conciliación
-- ----------------------------------------------------------------

-- Propone para cada línea del estado de cuenta sin pareja el
-- movimiento del libro con el MISMO importe, fecha a ±3 días y aún no
-- conciliado. Entre varios candidatos gana el que comparte referencia
-- y, después, el más cercano en fecha. Es una propuesta: el contable
-- confirma (confirmada = true) o descarta.
CREATE OR REPLACE FUNCTION contabilidad.proponer_emparejamientos(p_conciliacion uuid)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  c        contabilidad.conciliacion%ROWTYPE;
  l        contabilidad.conciliacion_linea%ROWTYPE;
  v_mov    uuid;
  v_total  int := 0;
BEGIN
  SELECT * INTO c FROM contabilidad.conciliacion WHERE id = p_conciliacion;
  IF c.estado <> 'abierta' THEN
    RAISE EXCEPTION 'contabilidad: la conciliación está cerrada';
  END IF;

  FOR l IN SELECT * FROM contabilidad.conciliacion_linea
            WHERE conciliacion_id = c.id AND movimiento_id IS NULL ORDER BY fecha, linea
  LOOP
    SELECT m.id INTO v_mov
      FROM contabilidad.movimiento_bancario m
     WHERE m.cuenta_id = c.cuenta_id
       AND m.estado = 'vigente'
       AND m.conciliacion_id IS NULL
       AND m.importe = l.monto
       AND m.fecha BETWEEN l.fecha - 3 AND l.fecha + 3
       AND NOT EXISTS (SELECT 1 FROM contabilidad.conciliacion_linea o
                        WHERE o.conciliacion_id = c.id AND o.movimiento_id = m.id)
     ORDER BY (l.referencia IS NOT NULL AND m.referencia IS NOT NULL
               AND (strpos(l.referencia, m.referencia) > 0
                    OR strpos(l.descripcion, m.referencia) > 0)) DESC,
              abs(m.fecha - l.fecha), m.numero
     LIMIT 1;

    IF v_mov IS NOT NULL THEN
      UPDATE contabilidad.conciliacion_linea SET movimiento_id = v_mov WHERE id = l.id;
      v_total := v_total + 1;
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Cerrar: las propuestas sin confirmar se descartan (no se puede
-- cerrar con dudas a medias) y cada movimiento confirmado queda
-- marcado con la conciliación, lo que lo bloquea.
CREATE OR REPLACE FUNCTION contabilidad.cerrar_conciliacion(p_conciliacion uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT estado FROM contabilidad.conciliacion WHERE id = p_conciliacion) <> 'abierta' THEN
    RAISE EXCEPTION 'contabilidad: la conciliación ya está cerrada';
  END IF;

  PERFORM set_config('app.accion', 'conciliar', true);

  UPDATE contabilidad.conciliacion_linea
     SET movimiento_id = NULL
   WHERE conciliacion_id = p_conciliacion AND NOT confirmada AND movimiento_id IS NOT NULL;

  UPDATE contabilidad.movimiento_bancario m
     SET conciliacion_id = p_conciliacion,
         estado_cheque = CASE WHEN m.tipo = 'cheque' THEN 'cobrado' ELSE m.estado_cheque END
    FROM contabilidad.conciliacion_linea l
   WHERE l.conciliacion_id = p_conciliacion AND l.confirmada AND l.movimiento_id = m.id;

  UPDATE contabilidad.conciliacion
     SET estado = 'cerrada', cerrada_por = contabilidad._usuario_actual(), cerrada_en = now()
   WHERE id = p_conciliacion;

  PERFORM set_config('app.accion', '', true);
END;
$$;

-- Lo conciliado no se toca: ni el movimiento, ni las líneas, ni la
-- conciliación cerrada. Se lee la fila como jsonb porque la misma
-- función sirve a tres tablas con columnas distintas.
CREATE OR REPLACE FUNCTION contabilidad._fn_bloqueo_conciliacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_fila jsonb := to_jsonb(CASE TG_OP WHEN 'INSERT' THEN NEW ELSE OLD END);
  v_id   uuid;
BEGIN
  v_id := CASE TG_TABLE_NAME WHEN 'conciliacion' THEN (v_fila ->> 'id')::uuid
                             ELSE (v_fila ->> 'conciliacion_id')::uuid END;

  IF (SELECT estado FROM contabilidad.conciliacion WHERE id = v_id) = 'cerrada' THEN
    RAISE EXCEPTION 'contabilidad.%: forma parte de una conciliación cerrada', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_bloqueo_conciliacion ON contabilidad.movimiento_bancario;
CREATE TRIGGER tg_bloqueo_conciliacion BEFORE UPDATE ON contabilidad.movimiento_bancario
  FOR EACH ROW WHEN (OLD.conciliacion_id IS NOT NULL)
  EXECUTE FUNCTION contabilidad._fn_bloqueo_conciliacion();

DROP TRIGGER IF EXISTS tg_bloqueo_conciliacion ON contabilidad.conciliacion_linea;
CREATE TRIGGER tg_bloqueo_conciliacion BEFORE INSERT OR UPDATE ON contabilidad.conciliacion_linea
  FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_bloqueo_conciliacion();

DROP TRIGGER IF EXISTS tg_bloqueo_conciliacion ON contabilidad.conciliacion;
CREATE TRIGGER tg_bloqueo_conciliacion BEFORE UPDATE ON contabilidad.conciliacion
  FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_bloqueo_conciliacion();

-- ----------------------------------------------------------------
-- 9. Bitácora, sin borrado y período cerrado en todo lo nuevo
-- ----------------------------------------------------------------

SELECT contabilidad.auditar_tabla(t)
  FROM unnest(ARRAY[
    'contabilidad.banco', 'contabilidad.cuenta_bancaria', 'contabilidad.conciliacion',
    'contabilidad.movimiento_bancario', 'contabilidad.conciliacion_linea',
    'contabilidad.recibo', 'contabilidad.recibo_adjunto', 'contabilidad.transferencia_interna'
  ]::regclass[]) AS t;

-- ----------------------------------------------------------------
-- 10. De `transaccion` a recibos
-- ----------------------------------------------------------------

-- Mapeo de la categoría de texto de la 0011 a una categoría contable:
--
--   ingreso · donacion            → Donaciones nacionales
--   ingreso · beca                → Aportes de patrocinadores
--   ingreso · cualquier otra      → Otros ingresos
--   egreso  · beca                → Becas y ayudas
--   egreso  · salario             → Nómina
--   egreso  · material            → Materiales y suministros
--   egreso  · operativo / evento  → Gastos de operación
--   egreso  · otro                → Otros egresos
--
-- Todas las filas van a "Santa Cruz USD" (la tabla vieja era solo en
-- dólares), contabilizadas, SIN tasa (`nunca la tuvieron`) y por tanto
-- sin asiento: inventar una tasa para el pasado falsearía el balance
-- en pesos. Quedan marcadas en `notas` como "Migrado, sin tasa" para
-- que el contador decida si las valora.
INSERT INTO contabilidad.categoria (nombre, tipo, codigo_legado) VALUES
  ('Donaciones nacionales',     'ingreso', 'donacion'),
  ('Aportes de patrocinadores', 'ingreso', 'beca'),
  ('Otros ingresos',            'ingreso', 'otro'),
  ('Becas y ayudas',            'egreso',  'beca'),
  ('Nómina',                    'egreso',  'salario'),
  ('Materiales y suministros',  'egreso',  'material'),
  ('Gastos de operación',       'egreso',  'operativo'),
  ('Otros egresos',             'egreso',  'otro')
ON CONFLICT (nombre) DO UPDATE SET codigo_legado = EXCLUDED.codigo_legado;

INSERT INTO contabilidad.fondo (nombre, descripcion)
VALUES ('General', 'Fondos sin restricción de uso.')
ON CONFLICT (nombre) DO NOTHING;

DO $$
DECLARE
  t        record;
  v_cuenta uuid := (SELECT id FROM contabilidad.cuenta_bancaria WHERE nombre = 'Santa Cruz USD');
  v_fondo  uuid := (SELECT id FROM contabilidad.fondo WHERE nombre = 'General');
  v_yo     uuid := contabilidad._usuario_actual();
  v_recibo uuid;
  v_mov    uuid;
  v_periodo uuid;
BEGIN
  IF to_regclass('public.transaccion') IS NULL
     OR (SELECT relkind FROM pg_class WHERE oid = 'public.transaccion'::regclass) <> 'r' THEN
    RETURN;  -- ya migrada
  END IF;

  FOR t IN SELECT * FROM public.transaccion ORDER BY fecha, created_at LOOP
    v_periodo := contabilidad.periodo_para(t.fecha);
    v_recibo  := gen_random_uuid();

    INSERT INTO contabilidad.movimiento_bancario
           (numero, cuenta_id, periodo_id, fecha, tipo, monto, moneda, concepto,
            referencia, origen_tabla, origen_id, creado_por)
    VALUES (contabilidad.siguiente_numero('MB'), v_cuenta, v_periodo, t.fecha,
            CASE t.tipo::text WHEN 'ingreso' THEN 'deposito' ELSE 'debito' END,
            t.monto, 'USD', t.concepto, t.referencia, 'recibo', v_recibo, v_yo)
    RETURNING id INTO v_mov;

    INSERT INTO contabilidad.recibo
           (id, tipo, numero, fecha, periodo_id, cuenta_bancaria_id, moneda, monto,
            concepto, categoria_id, fondo_id, forma_pago, referencia, notas, estado,
            movimiento_id, creado_por, creado_en, contabilizado_por, contabilizado_en, migrado_de)
    VALUES (v_recibo, t.tipo::text,
            contabilidad.siguiente_numero(CASE t.tipo::text WHEN 'ingreso' THEN 'RI' ELSE 'CE' END),
            t.fecha, v_periodo, v_cuenta, 'USD', t.monto, t.concepto,
            (SELECT c.id FROM contabilidad.categoria c
              WHERE c.tipo = t.tipo::text
                AND c.codigo_legado = CASE
                      WHEN t.tipo::text = 'ingreso' AND t.categoria NOT IN ('donacion', 'beca') THEN 'otro'
                      WHEN t.tipo::text = 'egreso' AND t.categoria = 'evento' THEN 'operativo'
                      WHEN t.categoria IN ('beca','donacion','operativo','salario','material','otro')
                        THEN t.categoria
                      ELSE 'otro' END
              LIMIT 1),
            v_fondo, 'transferencia', t.referencia,
            concat_ws(E'\n', 'Migrado, sin tasa (0011).', t.notas),
            'contabilizado', v_mov, v_yo, t.created_at, v_yo, now(), t.id);
  END LOOP;

  DROP TABLE public.transaccion;
END;
$$;

-- La forma de la tabla vieja, de solo lectura. El monto sigue en
-- dólares porque así lo leen el panel y /reportes: un recibo en pesos
-- se convierte con la tasa de referencia de su fecha y, si no hay
-- ninguna registrada, NO aparece aquí (no hay forma honesta de
-- pasarlo a dólares). Se retira en la Fase 7.
CREATE OR REPLACE VIEW public.transaccion AS
SELECT r.id,
       r.concepto,
       r.tipo::tipo_transaccion AS tipo,
       (CASE r.moneda WHEN 'USD' THEN r.monto
             ELSE round(r.monto / contabilidad.tasa_referencia(r.fecha), 2) END)::numeric(12,2) AS monto,
       coalesce(c.codigo_legado, 'otro') AS categoria,
       r.fecha,
       r.referencia,
       r.notas,
       r.creado_en AS created_at,
       coalesce(r.contabilizado_en, r.creado_en) AS updated_at
  FROM contabilidad.recibo r
  JOIN contabilidad.categoria c ON c.id = r.categoria_id
 WHERE r.estado = 'contabilizado'
   AND (r.moneda = 'USD' OR contabilidad.tasa_referencia(r.fecha) IS NOT NULL);

COMMENT ON VIEW public.transaccion IS
  'Compatibilidad con la 0011: recibos contabilizados en USD. Solo lectura; se retira en la Fase 7.';

-- ----------------------------------------------------------------
-- 11. Archivos y permisos de la API
-- ----------------------------------------------------------------

-- Bucket privado del departamento: se sirve con URLs firmadas de 5
-- minutos (src/lib/supabase/almacen.ts).
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('contabilidad', 'contabilidad', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA contabilidad FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON public.transaccion FROM %I', v_rol);
    END IF;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------
-- 12. Fin de `finanzas.escribir`
-- ----------------------------------------------------------------

-- La pantalla que lo usaba (/contabilidad, CRUD de `transaccion`) se
-- retira en esta fase y `transaccion` ya es una vista de solo lectura.
-- Nadie conserva el permiso; el código se queda en `permiso` por si una
-- migración vieja lo nombra.
DELETE FROM rol_permiso
 WHERE permiso_id = (SELECT id FROM permiso WHERE codigo = 'finanzas.escribir');
