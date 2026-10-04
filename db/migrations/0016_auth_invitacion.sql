-- ================================================================
-- GLOBAL EFFECT NEXUS — 0016 · Login solo por invitación (+ OAuth Google)
-- ================================================================
-- Refuerza la regla "los usuarios se invitan, no se registran":
-- la identidad de Supabase Auth (email/contraseña o Google) SOLO se
-- enlaza si el email YA existe en `usuario`. Si no existe, NO se crea
-- ningún perfil (antes, 0014 creaba un estudiante por defecto).
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
--
-- Requisito de configuración (fuera de SQL):
--   Supabase → Authentication → Providers → Google: habilitar y poner
--   Client ID/Secret. Redirect URL de la app: {SITIO}/auth/callback.
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enlaza SOLO si ya existe un usuario invitado con ese email.
  -- No crea usuarios nuevos: el acceso queda restringido a los invitados.
  UPDATE usuario
     SET auth_user_id = NEW.id
   WHERE email = NEW.email
     AND auth_user_id IS NULL;

  RETURN NEW;
END;
$$;

-- El trigger `trg_auth_user_created` (creado en 0014) ya invoca esta función.
