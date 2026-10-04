-- ================================================================
-- GLOBAL EFFECT NEXUS — 0035 · Contabilidad: cadena de la bitácora,
-- nada se borra y períodos cerrados
-- ================================================================
-- La 0033 dejó la bitácora con cuatro fallos que la hacían inútil
-- como prueba ante un fraude:
--
--   1. El disparador encadenaba cada fila con la anterior DE SU TABLA,
--      pero verificar_bitacora() recorría UNA cadena global. Las dos
--      nunca coincidían, y además verificar_bitacora() ni compilaba
--      (columna `ocurrido_en` ambigua contra su propio RETURNS TABLE).
--   2. El orden era `ocurrido_en, id`. `now()` es la hora de inicio de
--      la transacción y `id` un UUID aleatorio: dos filas de la misma
--      transacción quedaban en orden de lotería y la cadena se rompía
--      sola.
--   3. El hash solo cubría usuario, acción, tabla, registro y el
--      antes/después. Cambiar el motivo, la IP, la hora o el nombre
--      copiado no se detectaba.
--   4. El bloqueo era por tabla, así que dos tablas podían escribir a
--      la vez sobre el mismo eslabón.
--
-- Y faltaban dos reglas de la §1.6 y la §3 de la especificación: que
-- en contabilidad nada se borre y que un período cerrado no se toque.
--
-- Cómo queda:
--
--   · `orden` es un correlativo sin huecos que asigna el disparador
--     BEFORE INSERT de la propia bitácora, con un bloqueo consultivo
--     GLOBAL. Encadenar dentro de la bitácora (y no en el disparador de
--     cada tabla) hace que las lecturas que registra la app con
--     registrarLectura() entren en la misma cadena sin calcular nada
--     en TypeScript. El precio: las escrituras contables se serializan
--     hasta el COMMIT. Con un departamento de una o dos personas no se
--     nota, y es lo que pide la §3.5 ("que no se intercale").
--   · El hash cubre la fila entera (menos el propio hash) en una forma
--     canónica: `_canonica_bitacora()`. La usan el disparador y el
--     verificador, así no pueden divergir. La hora va en UTC para que
--     el resultado no dependa del TimeZone de la sesión.
--   · Un hueco en `orden` delata una fila borrada aunque quien la
--     borró recalcule los hashes posteriores... salvo que los recalcule
--     TODOS; por eso el auditor exporta la verificación con el último
--     hash, que sirve de sello fuera de la base.
--
-- Esta migración recalcula los hashes de las filas que ya existen.
-- Es la única vez: solo hay filas del seed de desarrollo y su cadena
-- nunca fue verificable. En producción esto no se podría hacer.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Orden de la cadena
-- ----------------------------------------------------------------

ALTER TABLE contabilidad.bitacora ADD COLUMN IF NOT EXISTS orden bigint;

-- Se apaga la inmutabilidad solo dentro de esta migración (que corre en
-- una transacción) para numerar y re-encadenar las filas viejas; se
-- vuelve a encender en el paso 6.
ALTER TABLE contabilidad.bitacora DISABLE TRIGGER tg_bitacora_inmutable;

-- Las filas viejas no tienen un orden fiable; se les da el mejor que
-- hay. Da igual cuál, porque a continuación se recalcula su cadena.
UPDATE contabilidad.bitacora b
   SET orden = o.n
  FROM (SELECT id, row_number() OVER (ORDER BY ocurrido_en, id) AS n
          FROM contabilidad.bitacora) o
 WHERE o.id = b.id
   AND b.orden IS NULL;

ALTER TABLE contabilidad.bitacora ALTER COLUMN orden SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'bitacora_orden_unico') THEN
    ALTER TABLE contabilidad.bitacora
      ADD CONSTRAINT bitacora_orden_unico UNIQUE (orden);
  END IF;
END;
$$;

COMMENT ON COLUMN contabilidad.bitacora.orden IS
  'Posición en la cadena de hash. Correlativo sin huecos: un hueco es una fila borrada.';
COMMENT ON COLUMN contabilidad.bitacora.hash_anterior IS
  'Hash de la fila con orden - 1 (cadena global, no por tabla).';

-- ----------------------------------------------------------------
-- 2. Forma canónica y encadenado
-- ----------------------------------------------------------------

-- jsonb ordena sus claves al serializar, así que `::text` es estable.
CREATE OR REPLACE FUNCTION contabilidad._canonica_bitacora(b contabilidad.bitacora)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT (
    to_jsonb(b) - 'hash' - 'hash_anterior'
    || jsonb_build_object(
         'ocurrido_en',
         to_char(b.ocurrido_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
       )
  )::text;
$$;

CREATE OR REPLACE FUNCTION contabilidad._fn_bitacora_encadenar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_orden bigint;
  v_hash  text;
BEGIN
  -- Clave fija: una sola cadena para todo el módulo.
  PERFORM pg_advisory_xact_lock(hashtext('contabilidad.bitacora'));

  SELECT b.orden, b.hash INTO v_orden, v_hash
    FROM contabilidad.bitacora b
   ORDER BY b.orden DESC
   LIMIT 1;

  -- Lo que mande quien inserta en orden, hora y hashes se ignora: la
  -- cadena solo la escribe este disparador. La hora se toma DESPUÉS del
  -- bloqueo para que crezca junto con `orden`.
  NEW.orden         := coalesce(v_orden, 0) + 1;
  NEW.ocurrido_en   := clock_timestamp();
  NEW.hash_anterior := v_hash;
  NEW.hash          := encode(
    digest(coalesce(v_hash, '') || contabilidad._canonica_bitacora(NEW), 'sha256'),
    'hex'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_bitacora_encadenar ON contabilidad.bitacora;
CREATE TRIGGER tg_bitacora_encadenar
  BEFORE INSERT ON contabilidad.bitacora
  FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_bitacora_encadenar();

-- ----------------------------------------------------------------
-- 3. Disparador de las tablas contables (ya no calcula hashes)
-- ----------------------------------------------------------------

-- SECURITY DEFINER para que la bitácora se escriba aunque el rol que
-- opera no tenga INSERT sobre ella; el search_path fijo evita que ese
-- privilegio se pueda secuestrar con una función homónima en otro
-- esquema.
--
-- app.accion y app.motivo son opcionales: la server action los fija
-- (fijarAccion() en src/server/contabilidad/bitacora.ts) cuando un
-- UPDATE es en realidad "aprobar" o "anular", para que el auditor no
-- vea un "editar" genérico.
CREATE OR REPLACE FUNCTION contabilidad._fn_bitacora()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_usuario_id text := current_setting('app.usuario_id', true);
  v_accion     text := nullif(current_setting('app.accion', true), '');
  v_motivo     text := nullif(current_setting('app.motivo', true), '');
  v_nombre     text;
  v_email      text;
  v_rol        text;
  v_antes      jsonb;
  v_despues    jsonb;
  v_campos     text[];
  v_fila       jsonb;
  v_registro   uuid;
BEGIN
  -- En contabilidad no existe la escritura anónima.
  IF v_usuario_id IS NULL OR trim(v_usuario_id) = '' THEN
    RAISE EXCEPTION
      'contabilidad: escritura sin app.usuario_id. Usa enTransaccionComo().';
  END IF;

  SELECT u.nombre, u.email::text, r.nombre
    INTO v_nombre, v_email, v_rol
    FROM public.usuario u
    JOIN public.rol r ON r.id = u.rol_id
   WHERE u.id = v_usuario_id::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'contabilidad: usuario_id % no encontrado en public.usuario.', v_usuario_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_despues := to_jsonb(NEW);
    v_fila    := v_despues;
  ELSIF TG_OP = 'UPDATE' THEN
    v_antes   := to_jsonb(OLD);
    v_despues := to_jsonb(NEW);
    v_fila    := v_despues;
    SELECT array_agg(t.clave ORDER BY t.clave)
      INTO v_campos
      FROM jsonb_each(v_despues) AS t(clave, valor)
     WHERE t.valor IS DISTINCT FROM v_antes -> t.clave;
  ELSE
    -- Inalcanzable mientras _fn_contabilidad_proteger impida el DELETE;
    -- se deja para que la bitácora no pierda nada si un día se permite.
    v_antes := to_jsonb(OLD);
    v_fila  := v_antes;
  END IF;

  -- Tablas sin `id` uuid (p. ej. secuencia, cuya clave es texto):
  -- registro_id queda NULL y el registro se lee en antes/despues.
  IF jsonb_typeof(v_fila -> 'id') = 'string'
     AND (v_fila ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_registro := (v_fila ->> 'id')::uuid;
  END IF;

  INSERT INTO contabilidad.bitacora (
    usuario_id, usuario_nombre, usuario_email, usuario_rol,
    ip, agente, sesion_id,
    accion, tabla, registro_id,
    antes, despues, campos_cambiados, motivo,
    hash
  ) VALUES (
    v_usuario_id::uuid, v_nombre, v_email, v_rol,
    nullif(current_setting('app.ip', true), ''),
    nullif(current_setting('app.agente', true), ''),
    nullif(current_setting('app.sesion', true), ''),
    coalesce(v_accion, CASE TG_OP WHEN 'INSERT' THEN 'crear'
                                  WHEN 'UPDATE' THEN 'editar'
                                  ELSE 'anular' END),
    TG_TABLE_NAME, v_registro,
    v_antes, v_despues, v_campos, v_motivo,
    '' -- lo sustituye tg_bitacora_encadenar
  );

  RETURN NULL; -- disparador AFTER: el valor de retorno no se usa
END;
$$;

-- ----------------------------------------------------------------
-- 4. Nada se borra y un período cerrado no se toca
-- ----------------------------------------------------------------

-- El período de una fila sale de su `periodo_id` o, en las líneas de
-- un asiento, del asiento. Toda tabla contable con fecha contable debe
-- llevar `periodo_id` para quedar cubierta.
CREATE OR REPLACE FUNCTION contabilidad._periodo_cerrado(p_fila jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((
    SELECT p.estado = 'cerrado'
      FROM contabilidad.periodo_contable p
     WHERE p.id = coalesce(
             (p_fila ->> 'periodo_id')::uuid,
             (SELECT a.periodo_id FROM contabilidad.asiento a
               WHERE a.id = (p_fila ->> 'asiento_id')::uuid)
           )
  ), false);
$$;

CREATE OR REPLACE FUNCTION contabilidad._fn_contabilidad_proteger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'contabilidad.%: en contabilidad nada se borra; el registro se anula con motivo.',
      TG_TABLE_NAME;
  END IF;

  -- Se mira la fila de antes y la de después: mover un registro DESDE
  -- un período cerrado o HACIA uno cerrado es igual de grave.
  IF (TG_OP = 'UPDATE' AND contabilidad._periodo_cerrado(to_jsonb(OLD)))
     OR contabilidad._periodo_cerrado(to_jsonb(NEW)) THEN
    RAISE EXCEPTION
      'contabilidad.%: el período contable está cerrado. Registra un ajuste en el período abierto.',
      TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$;

-- TRUNCATE no dispara los disparadores por fila, así que necesita uno
-- propio por sentencia.
CREATE OR REPLACE FUNCTION contabilidad._fn_impedir_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'contabilidad.%: TRUNCATE no está permitido.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS tg_bitacora_sin_truncate ON contabilidad.bitacora;
CREATE TRIGGER tg_bitacora_sin_truncate
  BEFORE TRUNCATE ON contabilidad.bitacora
  FOR EACH STATEMENT EXECUTE FUNCTION contabilidad._fn_impedir_truncate();

-- La 0033 creó _fn_proteger_periodo_cerrado pero nunca la instaló, y
-- devolvía OLD en un BEFORE UPDATE, lo que habría anulado en silencio
-- toda edición. La sustituye _fn_contabilidad_proteger.
DROP FUNCTION IF EXISTS contabilidad._fn_proteger_periodo_cerrado();

-- auditar_tabla() instala ahora los tres disparadores de una tabla
-- contable. Toda tabla nueva de contabilidad DEBE llamarla al final de
-- su migración (docs/07-guia-desarrollo.md).
CREATE OR REPLACE FUNCTION contabilidad.auditar_tabla(p_tabla regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_sufijo text := regexp_replace(p_tabla::text, '[^a-zA-Z0-9]', '_', 'g');
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', 'tg_bitacora_' || v_sufijo, p_tabla);
  EXECUTE format(
    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_bitacora()',
    'tg_bitacora_' || v_sufijo, p_tabla);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', 'tg_proteger_' || v_sufijo, p_tabla);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION contabilidad._fn_contabilidad_proteger()',
    'tg_proteger_' || v_sufijo, p_tabla);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', 'tg_sin_truncate_' || v_sufijo, p_tabla);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE TRUNCATE ON %s
       FOR EACH STATEMENT EXECUTE FUNCTION contabilidad._fn_impedir_truncate()',
    'tg_sin_truncate_' || v_sufijo, p_tabla);
END;
$$;

COMMENT ON FUNCTION contabilidad.auditar_tabla(regclass) IS
  'Instala bitácora, prohibición de DELETE/TRUNCATE y bloqueo de período cerrado. Obligatorio en toda tabla contable.';

SELECT contabilidad.auditar_tabla(t)
  FROM unnest(ARRAY[
    'contabilidad.secuencia', 'contabilidad.tasa_cambio', 'contabilidad.parametro',
    'contabilidad.periodo_contable', 'contabilidad.cuenta_contable', 'contabilidad.fondo',
    'contabilidad.categoria', 'contabilidad.asiento', 'contabilidad.asiento_linea'
  ]::regclass[]) AS t;

-- ----------------------------------------------------------------
-- 5. Verificación
-- ----------------------------------------------------------------

-- Cambia la forma del resultado: ya no devuelve todas las filas con un
-- booleano, sino SOLO las rotas y por qué. Vacío = íntegra. Recorrer
-- años de bitácora para enseñar "bien" en cada fila no le sirve a
-- nadie, y la primera fila devuelta es la que pide la §3.5.
DROP FUNCTION IF EXISTS contabilidad.verificar_bitacora(timestamptz, timestamptz);

CREATE FUNCTION contabilidad.verificar_bitacora(
  p_desde timestamptz DEFAULT '-infinity',
  p_hasta timestamptz DEFAULT 'infinity'
)
RETURNS TABLE (
  orden       bigint,
  id          uuid,
  ocurrido_en timestamptz,
  tabla       text,
  falla       text  -- 'hueco' | 'enlace' | 'hash'
)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_fila           contabilidad.bitacora%ROWTYPE;
  v_orden_previo   bigint;
  v_hash_previo    text;
  v_primera        boolean := true;
BEGIN
  FOR v_fila IN
    SELECT * FROM contabilidad.bitacora b
     WHERE b.ocurrido_en BETWEEN p_desde AND p_hasta
     ORDER BY b.orden
  LOOP
    -- El rango puede empezar a mitad de la cadena: el eslabón previo es
    -- la fila real con orden - 1, no lo que diga hash_anterior.
    IF v_primera THEN
      v_primera := false;
      SELECT b.orden, b.hash INTO v_orden_previo, v_hash_previo
        FROM contabilidad.bitacora b
       WHERE b.orden = v_fila.orden - 1;
      IF v_orden_previo IS NULL THEN
        v_orden_previo := v_fila.orden - 1;
        IF v_fila.orden > 1 THEN
          orden := v_fila.orden; id := v_fila.id;
          ocurrido_en := v_fila.ocurrido_en; tabla := v_fila.tabla;
          falla := 'hueco';
          RETURN NEXT;
        END IF;
      END IF;
    END IF;

    orden := v_fila.orden; id := v_fila.id;
    ocurrido_en := v_fila.ocurrido_en; tabla := v_fila.tabla;

    IF v_fila.orden <> v_orden_previo + 1 THEN
      falla := 'hueco';
      RETURN NEXT;
    ELSIF v_fila.hash_anterior IS DISTINCT FROM v_hash_previo THEN
      falla := 'enlace';
      RETURN NEXT;
    ELSIF v_fila.hash IS DISTINCT FROM encode(
            digest(coalesce(v_hash_previo, '') || contabilidad._canonica_bitacora(v_fila), 'sha256'),
            'hex') THEN
      falla := 'hash';
      RETURN NEXT;
    END IF;

    v_orden_previo := v_fila.orden;
    v_hash_previo  := v_fila.hash;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION contabilidad.verificar_bitacora(timestamptz, timestamptz) IS
  'Devuelve solo las filas rotas de la cadena (hueco, enlace o hash), en orden. Vacío = íntegra.';

-- ----------------------------------------------------------------
-- 6. Recalcular la cadena de las filas que ya existen
-- ----------------------------------------------------------------

-- pgcrypto vive en `extensions` en Supabase y en `public` en un Postgres
-- local; así digest() se encuentra en los dos.
SET LOCAL search_path = public, extensions;

DO $$
DECLARE
  v_fila contabilidad.bitacora%ROWTYPE;
  v_prev text;
BEGIN
  FOR v_fila IN SELECT * FROM contabilidad.bitacora ORDER BY orden LOOP
    v_fila.hash_anterior := v_prev;
    v_fila.hash := encode(
      digest(coalesce(v_prev, '') || contabilidad._canonica_bitacora(v_fila), 'sha256'),
      'hex');
    UPDATE contabilidad.bitacora
       SET hash_anterior = v_fila.hash_anterior, hash = v_fila.hash
     WHERE id = v_fila.id;
    v_prev := v_fila.hash;
  END LOOP;
END;
$$;

ALTER TABLE contabilidad.bitacora ENABLE TRIGGER tg_bitacora_inmutable;

-- ----------------------------------------------------------------
-- 7. Fuera del alcance de la API pública
-- ----------------------------------------------------------------

-- El esquema no está publicado en PostgREST, pero si alguien lo añade
-- por error en el panel, los roles de la API siguen sin poder leerlo.
-- La app entra con su propia conexión `pg`, no con estos roles.
DO $$
DECLARE
  v_rol text;
BEGIN
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA contabilidad FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA contabilidad FROM %I', v_rol);
      EXECUTE format('REVOKE USAGE ON SCHEMA contabilidad FROM %I', v_rol);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA contabilidad REVOKE ALL ON TABLES FROM %I', v_rol);
    END IF;
  END LOOP;
END;
$$;
