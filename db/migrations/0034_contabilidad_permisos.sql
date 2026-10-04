-- ============================================================
-- 0034_contabilidad_permisos.sql
-- Permisos finos del módulo de contabilidad, reparto por rol,
-- tabla usuario_permiso para excepciones individuales, y
-- retirada de finanzas.escribir a super_admin.
--
-- Por qué los permisos van en la base:
--   • rbac.ts los copia para el render sin consulta extra.
--   • La base sigue siendo la autoridad: toda server action
--     valida con requerirPermiso(), que consulta la base.
-- ============================================================

-- ============================================================
-- NUEVOS PERMISOS
-- ============================================================

INSERT INTO permiso (codigo, descripcion) VALUES
  ('contabilidad.leer',
   'Ver todo el portal de contabilidad: libros, recibos, proveedores, cajas, nómina y reportes.'),
  ('contabilidad.registrar',
   'Crear y editar borradores: recibos, facturas de proveedor, movimientos de caja.'),
  ('contabilidad.aprobar',
   'Pasar de borrador a contabilizado, emitir pagos y anular registros con motivo obligatorio.'),
  ('contabilidad.conciliar',
   'Conciliar extractos bancarios y cerrar arqueos de caja.'),
  ('contabilidad.nomina',
   'Ver salarios, calcular y pagar nómina. Dato más sensible; permiso separado del resto.'),
  ('contabilidad.configurar',
   'Gestionar bancos, cuentas, catálogo de cuentas, parámetros legales, cajas y secuencias.'),
  ('contabilidad.cerrar_periodo',
   'Cerrar y reabrir períodos contables. La reapertura requiere motivo y queda en la bitácora.'),
  ('contabilidad.asiento_manual',
   'Escribir asientos contables manualmente (partida doble).'),
  ('contabilidad.auditar',
   'Ver la bitácora completa en solo lectura y verificar su integridad. No puede operar.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- ============================================================
-- REPARTO POR ROL
-- ============================================================

-- Rol contabilidad: todos los permisos del módulo menos auditar.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r
  JOIN permiso p ON p.codigo IN (
    'contabilidad.leer',
    'contabilidad.registrar',
    'contabilidad.aprobar',
    'contabilidad.conciliar',
    'contabilidad.nomina',
    'contabilidad.configurar',
    'contabilidad.cerrar_periodo',
    'contabilidad.asiento_manual'
  )
 WHERE r.nombre = 'contabilidad'
ON CONFLICT DO NOTHING;

-- super_admin: solo lectura + auditoría.
-- Separación de funciones: quien audita no opera.
-- TAMBIÉN se le retira finanzas.escribir en este mismo paso.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r
  JOIN permiso p ON p.codigo IN (
    'contabilidad.leer',
    'contabilidad.auditar'
  )
 WHERE r.nombre = 'super_admin'
ON CONFLICT DO NOTHING;

-- Retirar finanzas.escribir a super_admin.
-- El módulo nuevo usa contabilidad.* y ese permiso antiguo ya no
-- debe dar acceso de escritura al dinero.
DELETE FROM rol_permiso
 WHERE rol_id  = (SELECT id FROM rol WHERE nombre = 'super_admin')
   AND permiso_id = (SELECT id FROM permiso WHERE codigo = 'finanzas.escribir');

-- ============================================================
-- EXCEPCIONES INDIVIDUALES (usuario_permiso)
-- ============================================================

-- Permite conceder o revocar un permiso a un usuario concreto,
-- independientemente de su rol. Útil para auxiliares contables
-- que solo pueden registrar pero no aprobar.
CREATE TABLE IF NOT EXISTS public.usuario_permiso (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid    NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  permiso_id  uuid    NOT NULL REFERENCES public.permiso(id) ON DELETE CASCADE,
  -- true = conceder (suma al rol), false = revocar (resta al rol)
  concedido   boolean NOT NULL DEFAULT true,
  motivo      text,
  otorgado_por uuid   REFERENCES public.usuario(id),
  creado_en   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, permiso_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_permiso_usuario
  ON public.usuario_permiso (usuario_id);

COMMENT ON TABLE public.usuario_permiso IS
  'Excepciones individuales al reparto de permisos por rol. concedido=true suma, false resta.';
