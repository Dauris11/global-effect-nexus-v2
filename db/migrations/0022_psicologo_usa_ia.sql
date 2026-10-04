-- ================================================================
-- GLOBAL EFFECT NEXUS — 0022 · El psicólogo puede usar la IA
-- ================================================================
-- El módulo de Psicología incorpora el OCR para identificar al joven a
-- partir de un documento escaneado (03-modulos-funcionales, MÓDULO 3).
-- Pero el rol `psicologo` no tenía `ia.usar`, así que la acción le
-- respondía "No autorizado": la función estaba pedida y era imposible
-- de ejecutar para la única persona que la necesita.
--
-- Se concede el permiso en vez de bajar el listón de la acción a
-- `psicologia.escribir`. `ia.usar` existe para controlar quién gasta
-- presupuesto de modelo; saltárselo porque estorba lo vacía de sentido
-- y deja la siguiente función de IA sin puerta que cruzar.
--
-- Lo que NO se concede: `expedientes.escribir`. El psicólogo sigue
-- leyendo expedientes sin poder modificarlos. El OCR del módulo de
-- psicología solo lee el documento y devuelve un nombre para
-- preseleccionar al estudiante; no escribe en su ficha.
-- ================================================================

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r, permiso p
 WHERE r.nombre = 'psicologo'
   AND p.codigo = 'ia.usar'
-- Idempotente: si alguien ya lo concedió a mano, la migración no falla.
ON CONFLICT DO NOTHING;
