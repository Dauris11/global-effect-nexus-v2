-- ============================================================
-- 0033_contabilidad_bitacora.sql
-- Bitácora antifraude inmutable para el módulo de contabilidad.
--
-- Características:
--   • Se captura en la base (disparador), no en la app.
--   • Aborda escrituras anónimas: si app.usuario_id está vacío,
--     el disparador aborta la transacción.
--   • Cadena de hash (pgcrypto sha256): un hueco o alteración
--     se detecta con verificar_bitacora().
--   • Inmutable: REVOKE + disparador BEFORE UPDATE/DELETE.
--   • auditar_tabla(regclass) instala el disparador en una tabla.
-- ============================================================

-- Tabla principal de la bitácora
CREATE TABLE IF NOT EXISTS contabilidad.bitacora (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cuándo
  ocurrido_en      timestamptz NOT NULL DEFAULT now(),
  -- Quién (copiado en el momento, por si se desactiva la cuenta luego)
  usuario_id       uuid        NOT NULL,
  usuario_nombre   text        NOT NULL,
  usuario_email    text        NOT NULL,
  usuario_rol      text        NOT NULL,
  -- Sesión y contexto de red
  ip               text,
  agente           text,       -- User-Agent del navegador
  sesion_id        text,       -- identificador de sesión Supabase
  -- Qué
  accion           text        NOT NULL
                   CHECK (accion IN (
                     'crear','editar','aprobar','anular','pagar',
                     'conciliar','cerrar_periodo','reabrir_periodo',
                     'exportar','ver_nomina','login','leer'
                   )),
  tabla            text        NOT NULL,
  registro_id      uuid,
  antes            jsonb,      -- snapshot BEFORE (null en INSERT)
  despues          jsonb,      -- snapshot AFTER  (null en DELETE)
  campos_cambiados text[],     -- columnas que difieren entre antes y despues
  motivo           text,       -- obligatorio en anulaciones y reaperturas
  -- Integridad de la cadena
  hash_anterior    text,       -- hash de la fila anterior de la misma tabla+registro
  hash             text NOT NULL  -- sha256(hash_anterior || fila_canónica)
);

-- Índices para el visor del auditor (filtros frecuentes)
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario
  ON contabilidad.bitacora (usuario_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_registro
  ON contabilidad.bitacora (tabla, registro_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_accion
  ON contabilidad.bitacora (accion, ocurrido_en DESC);

COMMENT ON TABLE contabilidad.bitacora IS
  'Bitácora antifraude inmutable. Toda escritura en contabilidad.* genera una fila aquí.';

-- ============================================================
-- FUNCIÓN DISPARADORA DE BITÁCORA
-- ============================================================

CREATE OR REPLACE FUNCTION contabilidad._fn_bitacora()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- corre como el dueño de la función, no como el llamante
AS $$
DECLARE
  v_usuario_id    text;
  v_nombre        text;
  v_email         text;
  v_rol           text;
  v_ip            text;
  v_agente        text;
  v_sesion        text;
  v_antes         jsonb;
  v_despues       jsonb;
  v_accion        text;
  v_campos        text[];
  v_hash_anterior text;
  v_hash          text;
  v_fila_canonica text;
  v_registro_id   uuid;
BEGIN
  -- Leer el contexto de la transacción (set por enTransaccionComo)
  v_usuario_id := current_setting('app.usuario_id', true);
  v_ip         := current_setting('app.ip',         true);
  v_agente     := current_setting('app.agente',     true);
  v_sesion     := current_setting('app.sesion',     true);

  -- En contabilidad no existe la escritura anónima.
  -- Si falta el usuario, abortamos toda la transacción.
  IF v_usuario_id IS NULL OR trim(v_usuario_id) = '' THEN
    RAISE EXCEPTION
      'contabilidad: escritura sin app.usuario_id. Usa enTransaccionComo().';
  END IF;

  -- Copiar nombre, correo y rol en el momento del evento
  SELECT u.nombre, u.email::text, r.nombre
    INTO v_nombre, v_email, v_rol
    FROM public.usuario u
    JOIN public.rol r ON r.id = u.rol_id
   WHERE u.id = v_usuario_id::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'contabilidad: usuario_id % no encontrado en public.usuario.', v_usuario_id;
  END IF;

  -- Construir snapshots y acción según el tipo de operación
  CASE TG_OP
    WHEN 'INSERT' THEN
      v_antes   := NULL;
      v_despues := to_jsonb(NEW);
      v_accion  := 'crear';
      v_registro_id := (to_jsonb(NEW)->>'id')::uuid;
    WHEN 'UPDATE' THEN
      v_antes   := to_jsonb(OLD);
      v_despues := to_jsonb(NEW);
      v_accion  := 'editar';
      v_registro_id := (to_jsonb(NEW)->>'id')::uuid;
      -- Calcular qué columnas cambiaron
      SELECT array_agg(clave)
        INTO v_campos
        FROM jsonb_each(v_despues) AS t(clave, val)
       WHERE t.val IS DISTINCT FROM (v_antes->>clave)::jsonb;
    WHEN 'DELETE' THEN
      v_antes   := to_jsonb(OLD);
      v_despues := NULL;
      v_accion  := 'anular';  -- en contabilidad no se borra, se anula
      v_registro_id := (to_jsonb(OLD)->>'id')::uuid;
  END CASE;

  -- Cadena de hash: bloqueo consultivo por tabla para serializar el cálculo.
  -- Evita que dos transacciones simultáneas calculen el hash en paralelo
  -- y rompan la cadena.
  PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME));

  SELECT hash INTO v_hash_anterior
    FROM contabilidad.bitacora
   WHERE tabla = TG_TABLE_NAME
   ORDER BY ocurrido_en DESC, id DESC
   LIMIT 1;

  -- Cadena canónica: concatenación determinista de los campos clave
  v_fila_canonica :=
    coalesce(v_hash_anterior, '') ||
    v_usuario_id || v_accion || TG_TABLE_NAME ||
    coalesce(v_registro_id::text, '') ||
    coalesce(v_antes::text,  '') ||
    coalesce(v_despues::text, '');

  v_hash := encode(digest(v_fila_canonica, 'sha256'), 'hex');

  -- Insertar la fila en la bitácora
  INSERT INTO contabilidad.bitacora (
    usuario_id, usuario_nombre, usuario_email, usuario_rol,
    ip, agente, sesion_id,
    accion, tabla, registro_id,
    antes, despues, campos_cambiados,
    hash_anterior, hash
  ) VALUES (
    v_usuario_id::uuid, v_nombre, v_email, v_rol,
    v_ip, v_agente, v_sesion,
    v_accion, TG_TABLE_NAME, v_registro_id,
    v_antes, v_despues, v_campos,
    v_hash_anterior, v_hash
  );

  RETURN coalesce(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION contabilidad._fn_bitacora() IS
  'Disparador genérico de bitácora. Se instala en cada tabla con auditar_tabla().';

-- ============================================================
-- FUNCIÓN PARA INSTALAR EL DISPARADOR EN UNA TABLA
-- ============================================================

-- Toda tabla nueva del módulo de contabilidad DEBE llamar a
-- auditar_tabla() al final de su migración. Sin eso, las escrituras
-- directas por SQL no quedarían registradas.
CREATE OR REPLACE FUNCTION contabilidad.auditar_tabla(p_tabla regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_nombre text := p_tabla::text;
  v_trigger text := 'tg_bitacora_' || regexp_replace(v_nombre, '[^a-zA-Z0-9]', '_', 'g');
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %s;
     CREATE TRIGGER %I
       AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_bitacora();',
    v_trigger, p_tabla,
    v_trigger, p_tabla
  );
END;
$$;

COMMENT ON FUNCTION contabilidad.auditar_tabla(regclass) IS
  'Instala el disparador de bitácora en una tabla del esquema contabilidad. Llamar al final de cada migración que cree tablas contables.';

-- ============================================================
-- INMUTABILIDAD DE LA BITÁCORA
-- ============================================================

-- Disparador que aborta cualquier intento de modificar o borrar la bitácora.
CREATE OR REPLACE FUNCTION contabilidad._fn_bitacora_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'La bitácora de contabilidad es inmutable. No se puede % una fila.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS tg_bitacora_inmutable ON contabilidad.bitacora;
CREATE TRIGGER tg_bitacora_inmutable
  BEFORE UPDATE OR DELETE ON contabilidad.bitacora
  FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_bitacora_inmutable();

-- Revocar permisos destructivos al rol de la aplicación.
-- El rol 'authenticated' de Supabase es el que usa la app.
-- Si el proyecto usa otro rol de app, ajustarlo aquí.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON contabilidad.bitacora FROM authenticated;
  END IF;
END;
$$;

-- ============================================================
-- PROTECCIÓN DE REGISTROS EN PERÍODOS CERRADOS
-- ============================================================

-- Ninguna tabla contable puede modificarse si su período está cerrado.
-- Se detecta leyendo periodo_id de la fila afectada.
CREATE OR REPLACE FUNCTION contabilidad._fn_proteger_periodo_cerrado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado text;
  v_pid    uuid;
BEGIN
  -- Solo aplica si la fila tiene columna periodo_id
  BEGIN
    v_pid := (to_jsonb(OLD)->>'periodo_id')::uuid;
  EXCEPTION WHEN others THEN
    RETURN OLD;
  END;

  IF v_pid IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT estado INTO v_estado
    FROM contabilidad.periodo_contable
   WHERE id = v_pid;

  IF v_estado = 'cerrado' THEN
    RAISE EXCEPTION
      'El período contable está cerrado. No se pueden modificar registros del período.';
  END IF;

  RETURN OLD;
END;
$$;

-- ============================================================
-- VERIFICACIÓN DE INTEGRIDAD DE LA CADENA DE HASH
-- ============================================================

CREATE OR REPLACE FUNCTION contabilidad.verificar_bitacora(
  p_desde timestamptz DEFAULT '-infinity',
  p_hasta timestamptz DEFAULT 'infinity'
)
RETURNS TABLE (
  id              uuid,
  ocurrido_en     timestamptz,
  tabla           text,
  registro_id     uuid,
  hash_esperado   text,
  hash_real       text,
  integra         boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fila       contabilidad.bitacora%ROWTYPE;
  v_anterior   text;
  v_esperado   text;
  v_canonica   text;
BEGIN
  FOR v_fila IN
    SELECT *
      FROM contabilidad.bitacora
     WHERE ocurrido_en BETWEEN p_desde AND p_hasta
     ORDER BY ocurrido_en, id
  LOOP
    v_canonica :=
      coalesce(v_anterior, '') ||
      v_fila.usuario_id::text || v_fila.accion || v_fila.tabla ||
      coalesce(v_fila.registro_id::text, '') ||
      coalesce(v_fila.antes::text,   '') ||
      coalesce(v_fila.despues::text, '');

    v_esperado := encode(digest(v_canonica, 'sha256'), 'hex');

    id            := v_fila.id;
    ocurrido_en   := v_fila.ocurrido_en;
    tabla         := v_fila.tabla;
    registro_id   := v_fila.registro_id;
    hash_esperado := v_esperado;
    hash_real     := v_fila.hash;
    integra       := (v_esperado = v_fila.hash);

    RETURN NEXT;
    v_anterior := v_fila.hash;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION contabilidad.verificar_bitacora(timestamptz, timestamptz) IS
  'Recorre la bitácora y devuelve cada fila indicando si su hash es correcto. La primera fila con integra=false señala la manipulación.';

-- Instalar bitácora en las tablas base del esquema 0032
SELECT contabilidad.auditar_tabla('contabilidad.secuencia');
SELECT contabilidad.auditar_tabla('contabilidad.tasa_cambio');
SELECT contabilidad.auditar_tabla('contabilidad.parametro');
SELECT contabilidad.auditar_tabla('contabilidad.periodo_contable');
SELECT contabilidad.auditar_tabla('contabilidad.cuenta_contable');
SELECT contabilidad.auditar_tabla('contabilidad.fondo');
SELECT contabilidad.auditar_tabla('contabilidad.categoria');
SELECT contabilidad.auditar_tabla('contabilidad.asiento');
SELECT contabilidad.auditar_tabla('contabilidad.asiento_linea');
