-- ================================================================
-- GLOBAL EFFECT NEXUS — 0025 · Confidencialidad de psicología
-- ================================================================
-- El expediente del estudiante y todo lo clínico dejan de ser datos
-- compartidos entre portales y pasan a ser de psicología, con
-- aislamiento POR FILA: cada psicólogo llega solo a los estudiantes
-- que tiene asignados en `estudiante.psicologo_id`.
--
-- Tres cambios, en este orden:
--
--   1. Rol nuevo `habitudes`: quienes dan las clases del programa y
--      llevan a los reclutas por el embudo. Postulan al candidato; de
--      ahí en adelante el expediente es de psicología.
--   2. Permiso nuevo `expedientes.postular`, que es lo que puede hacer
--      ese rol: dar de alta una ficha y completarla MIENTRAS está en el
--      embudo. Nada clínico, y nada de un estudiante ya activo.
--   3. Reparto nuevo de los permisos existentes.
--
-- Cómo queda:
--
--   psicologo     expedientes.leer/escribir + psicologia.leer/escribir
--                 — - pero solo sobre SUS estudiantes; el filtro por
--                 `psicologo_id` lo aplican las consultas del servidor.
--   habitudes     expedientes.postular
--   super_admin   expedientes.leer — solo lectura, y sin nada clínico:
--                 pierde psicologia.* y la escritura y el borrado.
--   admin         nada de expedientes. Coordinación deja de entrar.
--
-- Lo que esto NO hace es imponerlo en la base con RLS. La frontera de
-- seguridad de este sistema es el servidor de Next.js (ver la nota de la
-- 0014): se accede siempre con `pg` desde el servidor y se autoriza en
-- las consultas y las acciones. Esta migración fija QUIÉN puede, y el
-- aislamiento por fila lo garantiza el `WHERE psicologo_id = $1` que
-- llevan las consultas de psicología y de expedientes.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

-- ----------------------------------------------------------------
-- 1) El rol de quienes llevan el embudo
-- ----------------------------------------------------------------
INSERT INTO rol (nombre, descripcion) VALUES
  ('habitudes',
   'Programa Habitudes: da las clases y lleva a los reclutas por el embudo. Postula candidatos; el expediente completo es de psicología.')
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- ----------------------------------------------------------------
-- 2) El permiso de postular
-- ----------------------------------------------------------------
INSERT INTO permiso (codigo, descripcion) VALUES
  ('expedientes.postular',
   'Dar de alta un candidato y completar su ficha mientras está en el embudo de reclutamiento. No incluye datos clínicos ni estudiantes ya activos.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r, permiso p
 WHERE r.nombre = 'habitudes'
   AND p.codigo = 'expedientes.postular'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 3) Reparto nuevo
-- ----------------------------------------------------------------

-- Coordinación sale del expediente por completo.
DELETE FROM rol_permiso
 WHERE rol_id = (SELECT id FROM rol WHERE nombre = 'admin')
   AND permiso_id IN (SELECT id FROM permiso
                       WHERE codigo IN ('expedientes.leer',
                                        'expedientes.escribir',
                                        'expedientes.eliminar'));

-- El super admin conserva SOLO lectura de expedientes, y pierde todo lo
-- clínico: las citas y las notas no las ve nadie más que el psicólogo del
-- estudiante. Conserva `usuarios.administrar`, que es la salida a un
-- bloqueo —reactivar o crear una cuenta de psicólogo— sin ver ni un dato.
DELETE FROM rol_permiso
 WHERE rol_id = (SELECT id FROM rol WHERE nombre = 'super_admin')
   AND permiso_id IN (SELECT id FROM permiso
                       WHERE codigo IN ('expedientes.escribir',
                                        'expedientes.eliminar',
                                        'psicologia.leer',
                                        'psicologia.escribir'));

-- El psicólogo gana la escritura del expediente: es quien lo completa.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r, permiso p
 WHERE r.nombre = 'psicologo'
   AND p.codigo = 'expedientes.escribir'
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------
-- 4) Un expediente sin psicólogo asignado no lo ve nadie
-- ----------------------------------------------------------------
-- Con aislamiento por fila, `psicologo_id IS NULL` significa "invisible
-- para todos los psicólogos": el estudiante quedaría atrapado. El índice
-- parcial hace barata la consulta que los saca a la luz, que es la que
-- necesita la pantalla de reasignación.
CREATE INDEX IF NOT EXISTS idx_estudiante_sin_psicologo
  ON estudiante(estado)
  WHERE psicologo_id IS NULL;

COMMENT ON COLUMN estudiante.psicologo_id IS
  'Psicólogo responsable. Con la 0025 es además la frontera de acceso: un psicólogo solo llega a los estudiantes cuya fila lo nombra aquí. NULL = sin asignar, y sin asignar no lo ve ningún psicólogo.';
