-- ================================================================
-- GLOBAL EFFECT NEXUS — 0014 · Integración con Supabase Auth
-- ================================================================
-- Migra la autenticación de credenciales propias (Auth.js) a
-- Supabase Auth. Supabase gestiona `auth.users` (email + contraseña);
-- nuestra tabla `usuario` conserva el perfil de aplicación y el rol,
-- enlazada por `usuario.auth_user_id → auth.users.id`.
--
-- Requiere ejecutarse como rol `postgres` (SQL Editor de Supabase o
-- conexión directa), ya que crea un trigger sobre el esquema `auth`.
-- ================================================================

-- 1) La contraseña ya no vive en `usuario` (la guarda Supabase Auth).
ALTER TABLE usuario ALTER COLUMN password_hash DROP NOT NULL;
COMMENT ON COLUMN usuario.password_hash IS
  'Obsoleto tras Supabase Auth. Se conserva por compatibilidad/migración; las credenciales viven en auth.users.';

-- 2) Enlace 1:1 con la identidad de Supabase Auth.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE
  REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_usuario_auth_user ON usuario(auth_user_id);

-- 3) Ampliar los idiomas soportados a es/en/fr/it (antes solo es/en).
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_idioma_check;
ALTER TABLE usuario
  ADD CONSTRAINT usuario_idioma_check
  CHECK (idioma IN ('es', 'en', 'fr', 'it'));

-- 4) Sincronización automática al crear una identidad en Supabase Auth.
--    Si ya existe un `usuario` con ese email (flujo "se invita, no se
--    registra"), lo enlaza; si no, crea un perfil mínimo con rol estudiante.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE usuario
     SET auth_user_id = NEW.id
   WHERE email = NEW.email
     AND auth_user_id IS NULL;

  IF NOT FOUND THEN
    INSERT INTO usuario (email, password_hash, nombre, activo, rol_id, auth_user_id)
    VALUES (
      NEW.email,
      NULL,
      COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
      TRUE,
      (SELECT id FROM rol WHERE nombre = 'estudiante'),
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ================================================================
-- NOTA — Modelo de seguridad
-- ================================================================
-- El acceso a datos de negocio se hace SIEMPRE desde el servidor con `pg`
-- (conexión directa, SQL parametrizado) y se autoriza con RBAC en las
-- Server Actions (`requirePermission`). El cliente de Supabase se usa solo
-- para Auth y Storage con la clave publicable. Por eso no se depende de RLS
-- para proteger las tablas de aplicación; la frontera de seguridad es el
-- servidor de Next.js.
--
-- Para habilitar el login del admin maestro (admin@globaleffect.org), crea
-- su identidad en Supabase Auth (Dashboard → Authentication → Add user, o la
-- Admin API). El trigger anterior lo enlazará automáticamente al `usuario`
-- existente por coincidencia de email.
-- ================================================================
