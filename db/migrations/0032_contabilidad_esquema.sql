-- ============================================================
-- 0032_contabilidad_esquema.sql
-- Esquema propio `contabilidad` con todas las tablas base del
-- módulo: secuencias, parámetros, moneda, tasas, períodos,
-- catálogo de cuentas, fondos, categorías y asientos.
--
-- Por qué un esquema aparte:
--   • Supabase no expone por PostgREST esquemas no publicados:
--     el dinero queda fuera de la API pública aunque filtren
--     la llave anon.
--   • Los disparadores de bitácora (0033) se aplican al esquema
--     de una sola vez con auditar_tabla().
--   • Evita choques con tablas públicas (proyecto, tarea, etc.)
-- ============================================================

-- Extensión para hashes (necesaria para la bitácora del 0033)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Crear el esquema solo si no existe (idempotente)
CREATE SCHEMA IF NOT EXISTS contabilidad;

-- No publicar en la API REST de Supabase.
-- Si PostgREST ya tiene el esquema en su lista, se retira desde
-- el panel de Supabase (API → Exposed schemas).
-- COMMENT marca la intención para la documentación.
COMMENT ON SCHEMA contabilidad IS
  'Módulo contable de Global Effect. No exponer en PostgREST.';

-- ============================================================
-- SECUENCIAS (numeración sin huecos)
-- ============================================================

-- Tabla de secuencias: una fila por serie (RI, CE, PG, CH, AR…).
-- Se usa SELECT … FOR UPDATE para garantizar unicidad sin huecos
-- aunque haya varias conexiones simultáneas.
CREATE TABLE IF NOT EXISTS contabilidad.secuencia (
  clave     text        PRIMARY KEY,          -- ej. 'RI', 'CE'
  prefijo   text        NOT NULL DEFAULT '',  -- ej. 'RI-2026-'
  siguiente bigint      NOT NULL DEFAULT 1    -- próximo número a usar
);

COMMENT ON TABLE  contabilidad.secuencia IS
  'Generador de numeración secuencial sin huecos. Una fila por serie.';
COMMENT ON COLUMN contabilidad.secuencia.clave IS
  'Identificador corto de la serie, p. ej. RI (recibo de ingreso).';
COMMENT ON COLUMN contabilidad.secuencia.siguiente IS
  'Siguiente número a usar; se incrementa dentro de una transacción con FOR UPDATE.';

-- Función: devuelve el siguiente número de una serie y lo incrementa.
-- Se llama SIEMPRE dentro de la transacción que crea el documento.
CREATE OR REPLACE FUNCTION contabilidad.siguiente_numero(p_clave text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_num bigint;
BEGIN
  SELECT siguiente INTO v_num
    FROM contabilidad.secuencia
   WHERE clave = p_clave
     FOR UPDATE;  -- bloquea la fila hasta que la transacción termine

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Secuencia % no existe. Créala con db:seed:contabilidad.', p_clave;
  END IF;

  UPDATE contabilidad.secuencia
     SET siguiente = siguiente + 1
   WHERE clave = p_clave;

  RETURN v_num;
END;
$$;

COMMENT ON FUNCTION contabilidad.siguiente_numero(text) IS
  'Devuelve y avanza el contador de una secuencia. Llamar solo dentro de BEGIN…COMMIT.';

-- ============================================================
-- MONEDAS Y TASAS DE CAMBIO
-- ============================================================

-- Las monedas se validan con un CHECK en cada columna que las use.
-- Solo DOP y USD en la primera versión; agregar más requiere modificar
-- el CHECK y el adaptador de conversión.

CREATE TABLE IF NOT EXISTS contabilidad.tasa_cambio (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha        date        NOT NULL,
  compra       numeric(12,4) NOT NULL CHECK (compra > 0),
  venta        numeric(12,4) NOT NULL CHECK (venta > 0),
  -- Fuente oficial recomendada: Banco Central (BCRD). Se captura a mano
  -- o se importa; el sistema no consume ninguna API de tasas.
  fuente       text        NOT NULL DEFAULT 'BCRD',
  nota         text,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha)  -- una tasa por día (la del cierre)
);

COMMENT ON TABLE contabilidad.tasa_cambio IS
  'Tasas DOP/USD diarias. Fuente sugerida: Banco Central (BCRD).';

-- ============================================================
-- PARÁMETROS LEGALES CON VIGENCIA
-- ============================================================

-- Cada fila es un parámetro con fecha de inicio y fin de vigencia.
-- El cálculo de nómina usa el parámetro vigente EN LA FECHA DEL
-- PERÍODO, no el de hoy. Así la escala del ISR 2026 sigue
-- aplicándose a períodos anteriores aunque en 2027 cambie.
CREATE TABLE IF NOT EXISTS contabilidad.parametro (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave          text        NOT NULL,          -- ej. 'tss.afp.empleado'
  valor          jsonb       NOT NULL,          -- valor o estructura del parámetro
  vigente_desde  date        NOT NULL,
  vigente_hasta  date,                          -- NULL = vigente indefinidamente
  fuente         text,                          -- ej. 'Ley 87-01'
  nota           text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parametro_rango_valido
    CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_parametro_clave_vigencia
  ON contabilidad.parametro (clave, vigente_desde, vigente_hasta);

COMMENT ON TABLE contabilidad.parametro IS
  'Parámetros legales con vigencia temporal. Nunca se sobreescriben: se cierran con vigente_hasta y se crea la nueva versión.';

-- Función auxiliar: devuelve el parámetro vigente en una fecha dada.
CREATE OR REPLACE FUNCTION contabilidad.parametro_en(
  p_clave text,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT valor
    FROM contabilidad.parametro
   WHERE clave = p_clave
     AND vigente_desde <= p_fecha
     AND (vigente_hasta IS NULL OR vigente_hasta > p_fecha)
   ORDER BY vigente_desde DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION contabilidad.parametro_en(text, date) IS
  'Devuelve el valor del parámetro vigente en la fecha indicada (default: hoy).';

-- ============================================================
-- PERÍODOS CONTABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS contabilidad.periodo_contable (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  anio         smallint    NOT NULL CHECK (anio BETWEEN 2020 AND 2099),
  mes          smallint    NOT NULL CHECK (mes BETWEEN 1 AND 12),
  estado       text        NOT NULL DEFAULT 'abierto'
               CHECK (estado IN ('abierto', 'cerrado')),
  cerrado_por  uuid        REFERENCES public.usuario(id),
  cerrado_en   timestamptz,
  reabierto_por uuid       REFERENCES public.usuario(id),
  reabierto_en timestamptz,
  motivo_reapertura text,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anio, mes)
);

COMMENT ON TABLE contabilidad.periodo_contable IS
  'Un período por mes/año. Cerrado = no admite cambios, solo ajustes con fecha de período abierto.';

-- ============================================================
-- CATÁLOGO DE CUENTAS
-- ============================================================

-- Estructura jerárquica: una cuenta puede tener un padre.
-- Solo las hojas (admite_movimiento = true) reciben asientos.
-- El catálogo se siembra con un conjunto básico para ASFL;
-- el contador lo ajusta desde Configuración.
CREATE TABLE IF NOT EXISTS contabilidad.cuenta_contable (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo             text    NOT NULL UNIQUE,   -- ej. '1.1.01.001'
  nombre             text    NOT NULL,
  tipo               text    NOT NULL
                     CHECK (tipo IN ('activo','pasivo','patrimonio','ingreso','gasto')),
  padre_id           uuid    REFERENCES contabilidad.cuenta_contable(id),
  admite_movimiento  boolean NOT NULL DEFAULT true,
  descripcion        text,
  activa             boolean NOT NULL DEFAULT true,
  creado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuenta_contable_padre
  ON contabilidad.cuenta_contable (padre_id);

COMMENT ON TABLE contabilidad.cuenta_contable IS
  'Catálogo de cuentas jerárquico. Solo cuentas con admite_movimiento=true reciben asientos.';

-- ============================================================
-- FONDOS Y CATEGORÍAS
-- ============================================================

CREATE TABLE IF NOT EXISTS contabilidad.fondo (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text    NOT NULL UNIQUE,
  descripcion text,
  activo      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contabilidad.fondo IS
  'Fondo o fuente de financiamiento (p. ej. "General", "Patrocinador X").';

CREATE TABLE IF NOT EXISTS contabilidad.categoria (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text    NOT NULL UNIQUE,
  tipo        text    NOT NULL CHECK (tipo IN ('ingreso','egreso','ambos')),
  cuenta_id   uuid    REFERENCES contabilidad.cuenta_contable(id),
  descripcion text,
  activa      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contabilidad.categoria IS
  'Categoría operativa de ingresos/egresos; puede enlazarse a una cuenta del catálogo.';

-- ============================================================
-- ASIENTOS CONTABLES (partida doble)
-- ============================================================

-- El contable registra recibos, pagos, facturas y nómina.
-- Cada operación genera su asiento automáticamente desde la
-- server action correspondiente (nunca desde el cliente).
-- Los asientos manuales requieren el permiso contabilidad.asiento_manual.
CREATE TABLE IF NOT EXISTS contabilidad.asiento (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         bigint      NOT NULL,          -- siguiente_numero('AS')
  fecha          date        NOT NULL,
  periodo_id     uuid        NOT NULL REFERENCES contabilidad.periodo_contable(id),
  concepto       text        NOT NULL,
  tipo           text        NOT NULL DEFAULT 'automatico'
                 CHECK (tipo IN ('automatico','manual','ajuste')),
  -- Si viene de una operación (recibo, pago, nómina…), se guarda la referencia.
  origen_tabla   text,
  origen_id      uuid,
  creado_por     uuid        NOT NULL REFERENCES public.usuario(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  anulado        boolean     NOT NULL DEFAULT false,
  anulado_por    uuid        REFERENCES public.usuario(id),
  anulado_en     timestamptz,
  motivo_anulacion text,
  UNIQUE (numero)
);

CREATE TABLE IF NOT EXISTS contabilidad.asiento_linea (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asiento_id  uuid        NOT NULL REFERENCES contabilidad.asiento(id),
  cuenta_id   uuid        NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  debe        numeric(14,2) NOT NULL DEFAULT 0 CHECK (debe >= 0),
  haber       numeric(14,2) NOT NULL DEFAULT 0 CHECK (haber >= 0),
  descripcion text,
  -- Solo uno de los dos puede ser positivo en la misma línea
  CONSTRAINT linea_solo_un_lado
    CHECK (NOT (debe > 0 AND haber > 0))
);

CREATE INDEX IF NOT EXISTS idx_asiento_linea_asiento
  ON contabilidad.asiento_linea (asiento_id);
CREATE INDEX IF NOT EXISTS idx_asiento_linea_cuenta
  ON contabilidad.asiento_linea (cuenta_id);

-- Constraint diferido: débitos = créditos por asiento.
-- Se evalúa al COMMIT, no al insertar cada línea, para que el código
-- pueda insertar todas las líneas del asiento antes de que el motor
-- compruebe el cuadre.
CREATE OR REPLACE FUNCTION contabilidad._validar_cuadre_asiento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_debe  numeric(14,2);
  v_haber numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(debe), 0), COALESCE(SUM(haber), 0)
    INTO v_debe, v_haber
    FROM contabilidad.asiento_linea
   WHERE asiento_id = NEW.asiento_id;

  IF v_debe <> v_haber THEN
    RAISE EXCEPTION
      'Asiento % descuadrado: debe=% haber=%',
      NEW.asiento_id, v_debe, v_haber;
  END IF;

  RETURN NEW;
END;
$$;

-- Disparador DIFERIDO: se dispara al COMMIT de la transacción.
-- Así se pueden insertar todas las líneas y el motor solo verifica al final.
DROP TRIGGER IF EXISTS tg_cuadre_asiento ON contabilidad.asiento_linea;
CREATE CONSTRAINT TRIGGER tg_cuadre_asiento
  AFTER INSERT OR UPDATE ON contabilidad.asiento_linea
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION contabilidad._validar_cuadre_asiento();

COMMENT ON TABLE contabilidad.asiento IS
  'Cabecera del asiento contable. El cuadre debe=haber se verifica al COMMIT via trigger diferido.';
COMMENT ON TABLE contabilidad.asiento_linea IS
  'Líneas de débito/crédito de un asiento. Cada línea afecta una sola cuenta.';
