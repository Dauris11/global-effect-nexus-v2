-- ================================================================
-- PORTAL GLOBALEFFECT — 0130 · Solicitudes de cambio en cuenta bancaria
-- ================================================================
-- Solo el rol `contabilidad` puede modificar directamente la configuración
-- de una cuenta bancaria (título, número de cuenta, moneda, auxiliar
-- contable y saldo actual). Los demás roles envían una solicitud de
-- autorización que notifica a Contabilidad para aprobar o rechazar.
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0130_solicitud_cambio_banco.sql', true);

CREATE TABLE IF NOT EXISTS contabilidad.solicitud_cambio_cuenta_bancaria (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id             uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  solicitado_por        uuid NOT NULL REFERENCES public.usuario(id),
  solicitado_en         timestamptz NOT NULL DEFAULT now(),
  nombre                text NOT NULL,
  numero                text NOT NULL,
  moneda                text NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  cuenta_contable_id    uuid NOT NULL REFERENCES contabilidad.cuenta_contable(id),
  saldo_actual          numeric(14,2) NOT NULL,
  motivo                text NOT NULL,
  estado                text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  resuelto_por          uuid REFERENCES public.usuario(id),
  resuelto_en           timestamptz,
  comentario_resolucion text
);

CREATE INDEX IF NOT EXISTS idx_sol_cambio_banco_cuenta_estado
  ON contabilidad.solicitud_cambio_cuenta_bancaria (cuenta_id, estado, solicitado_en DESC);

COMMENT ON TABLE contabilidad.solicitud_cambio_cuenta_bancaria IS
  'Solicitudes de autorización para modificar configuración de cuentas bancarias cuando el usuario no tiene rol contabilidad.';

ALTER TABLE contabilidad.solicitud_cambio_cuenta_bancaria ENABLE ROW LEVEL SECURITY;

SELECT contabilidad.auditar_tabla('contabilidad.solicitud_cambio_cuenta_bancaria'::regclass);
