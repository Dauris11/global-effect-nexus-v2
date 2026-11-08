-- ============================================================================
-- Migración 0071: Retirar función obsoleta contabilidad.reponer_caja
--
-- La reposición de caja chica se ejecuta de forma transaccional completa
-- desde TypeScript (src/server/contabilidad/cajas/acciones.ts: reponerCajaDesdeBancoAction)
-- generando el recibo de egreso bancario, movimiento de caja y asiento contable
-- correspondiente. Esta función PL/pgSQL quedó en desuso tras la migración 0039.
-- ============================================================================

DROP FUNCTION IF EXISTS contabilidad.reponer_caja(uuid, uuid, numeric, date, text);

