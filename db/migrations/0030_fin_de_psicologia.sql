-- ================================================================
-- GLOBAL EFFECT NEXUS — 0030 · Fin del departamento de Psicología
-- ================================================================
-- En octubre de 2026 la Fundación cerró el departamento de
-- Psicología. Lo que hacía pasa a la parte administrativa, y el
-- sistema deja de tener un portal clínico.
--
-- Esta migración deshace el reparto de la 0025 y retira todo lo que
-- crearon la 0008, la 0021, la 0022 y la 0024. Esas migraciones se
-- quedan en el repositorio: una migración aplicada no se reescribe,
-- se anula con otra posterior, y así una base nueva y una ya
-- desplegada terminan en el mismo sitio.
--
-- Cinco cambios, en este orden:
--
--   1. Las cuentas con rol `psicologo` pasan a `admin`. No se
--      desactivan: son personas que siguen en la Fundación, ahora en
--      administración.
--   2. El expediente vuelve a administración, ENTERO. `admin` y
--      `super_admin` leen, escriben y borran cualquier expediente.
--      El aislamiento por fila de la 0025 existía para proteger lo
--      clínico; sin nada clínico no protege nada y solo dejaba
--      estudiantes invisibles cuando nadie los tenía asignados.
--   3. Se borran el rol `psicologo` y los permisos `psicologia.*`.
--   4. Se borran las tres tablas clínicas y la columna
--      `estudiante.psicologo_id`. Es un DROP sin copia, decidido por la
--      Fundación: guardar notas de sesión de un servicio que ya no
--      existe, sin nadie autorizado a leerlas, es riesgo sin uso.
--   5. Se borran las notificaciones de tipo `cita`: todas enlazan a
--      `/portal/psicologia`, una ruta que ya no existe.
--
-- `audit_log` NO se toca. Es append-only, y sus filas sobre
-- `cita_psicologia` o `nota_psicologica` nunca guardaron contenido
-- (ver `src/lib/auditoria.ts`): solo quién hizo qué y cuándo. Siguen
-- siendo historia válida aunque la tabla ya no exista.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Las cuentas de psicología pasan a administración
-- ----------------------------------------------------------------
UPDATE usuario
   SET rol_id = (SELECT id FROM rol WHERE nombre = 'admin')
 WHERE rol_id = (SELECT id FROM rol WHERE nombre = 'psicologo');

-- ----------------------------------------------------------------
-- 2) El expediente es de administración
-- ----------------------------------------------------------------
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r, permiso p
 WHERE r.nombre IN ('admin', 'super_admin')
   AND p.codigo IN ('expedientes.leer',
                    'expedientes.escribir',
                    'expedientes.eliminar')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 3) Rol y permisos de psicología
-- ----------------------------------------------------------------
-- `rol_permiso` cae en cascada con el permiso y con el rol.
DELETE FROM permiso WHERE codigo IN ('psicologia.leer', 'psicologia.escribir');

-- Después del paso 1 ninguna cuenta apunta a este rol; si alguna lo
-- hiciera, `usuario.rol_id` no tiene ON DELETE y el borrado fallaría,
-- que es lo que se quiere: mejor parar que dejar una cuenta sin rol.
DELETE FROM rol WHERE nombre = 'psicologo';

-- ----------------------------------------------------------------
-- 4) Tablas clínicas y psicólogo de cabecera
-- ----------------------------------------------------------------
-- `nota_psicologica` primero: cuelga de `cita_psicologia`.
DROP TABLE IF EXISTS nota_psicologica;
DROP TABLE IF EXISTS cita_psicologia;
DROP TABLE IF EXISTS perfil_psicologico;

DROP INDEX IF EXISTS idx_estudiante_sin_psicologo;
DROP INDEX IF EXISTS idx_estudiante_psicologo;
ALTER TABLE estudiante DROP COLUMN IF EXISTS psicologo_id;

-- ----------------------------------------------------------------
-- 5) Avisos que apuntan a un portal que ya no existe
-- ----------------------------------------------------------------
DELETE FROM notificacion WHERE tipo = 'cita';
