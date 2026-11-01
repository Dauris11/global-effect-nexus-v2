-- ================================================================
-- GLOBAL EFFECT NEXUS — 0070 · Solicitud de compra con cotización
-- ================================================================
-- Todo el personal y el estudiantado pueden pedir a contabilidad que
-- compre algo, adjuntando la cotización. Es un tipo NUEVO (`compra`) y
-- no el `gasto` de la 0031 porque son cosas distintas:
--
--   · `gasto` lo pide el personal, tiene umbral de dirección y al
--     aprobarse crea la cuenta por pagar (contabilidad.crear_cxp_
--     desde_solicitud). Pensado para un gasto ya decidido.
--   · `compra` lo puede pedir CUALQUIER rol (también estudiante y
--     chofer), lleva cotización obligatoria y contabilidad solo
--     aprueba o rechaza: no genera asiento ni cuenta por pagar, que
--     se registrarán cuando llegue la factura real.
--
-- La cotización vive en `solicitud_adjunto` y no en columnas de
-- `solicitud`: la tabla de solicitudes es de todos los tipos y el
-- adjunto solo aplica a uno. Una por solicitud (UNIQUE): una compra se
-- decide sobre UN documento; si hay otra cotización se manda otra
-- solicitud. El archivo vive en el bucket privado `documentos`.
--
-- Idempotente: se puede aplicar más de una vez.
-- Aplicar como rol `postgres`.
-- ================================================================

-- El CHECK de `tipo` era inline en la 0031 y Postgres lo nombró así.
ALTER TABLE solicitud DROP CONSTRAINT IF EXISTS solicitud_tipo_check;
ALTER TABLE solicitud ADD CONSTRAINT solicitud_tipo_check CHECK (tipo IN (
  'constancia', 'carta', 'cita_administracion', 'permiso', 'otro',
  'alta_expediente', 'beca', 'gasto', 'compra'));

-- Una compra sin monto no se puede aprobar, igual que el gasto.
ALTER TABLE solicitud DROP CONSTRAINT IF EXISTS solicitud_gasto_con_monto;
ALTER TABLE solicitud ADD CONSTRAINT solicitud_gasto_con_monto CHECK (
  tipo NOT IN ('gasto', 'compra') OR monto IS NOT NULL
);

CREATE TABLE IF NOT EXISTS solicitud_adjunto (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id   UUID NOT NULL UNIQUE REFERENCES solicitud(id) ON DELETE CASCADE,
  -- Clave dentro del bucket `documentos`. La compone el servidor con ids;
  -- nunca contiene el nombre que eligió quien subió el archivo.
  ruta           TEXT NOT NULL UNIQUE CHECK (length(ruta) BETWEEN 1 AND 300),
  nombre         TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 200),
  formato        TEXT NOT NULL CHECK (formato IN ('pdf', 'png', 'jpg', 'docx')),
  -- Tope de 10 MB, el mismo de las entregas del aula.
  tamano_bytes   INTEGER NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760),
  subido_por     UUID REFERENCES usuario(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
