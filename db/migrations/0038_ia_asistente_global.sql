-- ================================================================
-- GLOBAL EFFECT NEXUS — 0038 · Asistente de IA para todos los roles
-- ================================================================
-- El asistente de IA pasa a estar disponible como widget flotante en
-- todos los portales y departamentos. El rol estudiante lo utiliza
-- para consultas sobre el reglamento y vida académica; los demás
-- roles (docente, contabilidad, habitudes, admin, super_admin) tienen
-- además el modo de ejecución de acciones y comandos de voz.
--
-- Se concede el permiso `ia.usar` a los roles que aún no lo tenían
-- (docente, contabilidad, habitudes) para que la política RBAC sea
-- consistente con el widget universal.
-- ================================================================

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r, permiso p
 WHERE r.nombre IN ('docente', 'contabilidad', 'habitudes')
   AND p.codigo = 'ia.usar'
ON CONFLICT DO NOTHING;
