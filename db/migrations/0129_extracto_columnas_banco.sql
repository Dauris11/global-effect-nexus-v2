-- ================================================================
-- PORTAL GLOBALEFFECT — 0129 · Columnas completas del extracto bancario
-- ================================================================
-- Conserva en `contabilidad.extracto_linea` todas las columnas del
-- estado de cuenta bancario (Fecha de Posteo, No. Cheque, Retiros y
-- Depósitos, además de Fecha Efectiva en `fecha`, No. Referencia en
-- `referencia`, Descripción en `descripcion`, `monto` neto y `saldo`).
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0129_extracto_columnas_banco.sql', true);

ALTER TABLE contabilidad.extracto_linea
  ADD COLUMN IF NOT EXISTS fecha_posteo date,
  ADD COLUMN IF NOT EXISTS no_cheque text,
  ADD COLUMN IF NOT EXISTS retiros numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depositos numeric(14,2) NOT NULL DEFAULT 0;

UPDATE contabilidad.extracto_linea
   SET retiros   = CASE WHEN monto < 0 THEN -monto ELSE 0 END,
       depositos = CASE WHEN monto > 0 THEN monto ELSE 0 END
 WHERE retiros = 0 AND depositos = 0 AND monto <> 0;

COMMENT ON COLUMN contabilidad.extracto_linea.fecha_posteo IS
  'Fecha de posteo reportada por el banco (la columna `fecha` almacena la fecha efectiva).';
COMMENT ON COLUMN contabilidad.extracto_linea.no_cheque IS
  'Número de cheque reportado en el estado de cuenta bancario, si aplica.';
COMMENT ON COLUMN contabilidad.extracto_linea.retiros IS
  'Monto de retiro/débito bancario en valor positivo (>= 0).';
COMMENT ON COLUMN contabilidad.extracto_linea.depositos IS
  'Monto de depósito/crédito bancario en valor positivo (>= 0).';
