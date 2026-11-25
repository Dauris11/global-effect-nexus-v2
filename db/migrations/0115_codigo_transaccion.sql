-- ================================================================
-- 0115 · Códigos de transacción (Configuración contable)
--
-- Un «código de transacción» nombra un proceso contable (p. ej. «AFP del
-- empleado por pagar» de la nómina). Las DEFINICIONES viven en código
-- (src/lib/contabilidad/codigos-transaccion.ts); aquí solo se guarda lo que
-- la contadora configura desde la pantalla:
--   · la naturaleza (débito o crédito) del código, y
--   · la cuenta del catálogo a la que da propósito.
--
-- Un código de la lista sin fila usa la naturaleza por defecto del código y
-- está «sin cuenta». Varios códigos pueden apuntar a la misma cuenta; un
-- código tiene a lo sumo una. Para desasignar se pone cuenta_id = NULL:
-- «en contabilidad nada se borra» (tg_proteger_… impide el DELETE).
--
-- Se siembra el reparto que hoy usa la nómina, para que su asiento no cambie.
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0115_codigo_transaccion.sql', true);

CREATE TABLE IF NOT EXISTS contabilidad.codigo_transaccion (
  codigo          text PRIMARY KEY,
  naturaleza      text NOT NULL CHECK (naturaleza IN ('debito', 'credito')),
  cuenta_id       uuid REFERENCES contabilidad.cuenta_contable(id),
  actualizado_por uuid REFERENCES public.usuario(id),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codigo_transaccion_cuenta
  ON contabilidad.codigo_transaccion (cuenta_id);

COMMENT ON TABLE contabilidad.codigo_transaccion IS
  'Lo configurado de cada código de transacción (definidos en codigo): naturaleza y cuenta asignada. Sin fila = naturaleza por defecto y sin cuenta.';

ALTER TABLE contabilidad.codigo_transaccion ENABLE ROW LEVEL SECURITY;

-- Bitácora encadenada, protección y TRUNCATE prohibido, como el resto.
SELECT contabilidad.auditar_tabla('contabilidad.codigo_transaccion'::regclass);

-- Sembrado: busca la cuenta por su código del catálogo vigente (88 cuentas) y
-- solo si existe, es de movimiento y está activa. ISR por pagar queda sin fila:
-- hoy el catálogo no tiene esa cuenta.
INSERT INTO contabilidad.codigo_transaccion (codigo, naturaleza, cuenta_id)
SELECT s.codigo, s.naturaleza, c.id
  FROM (VALUES
    ('NOM_SUELDO_HABITUDES',            'debito',  '5.3.3.1'),
    ('NOM_SUELDO_ALOJAMIENTO',          'debito',  '5.3.3.2'),
    ('NOM_SUELDO_FORMACION_360',        'debito',  '5.3.3.3'),
    ('NOM_SUELDO_BECAS',                'debito',  '5.3.3.4'),
    ('NOM_SUELDO_ADMINISTRATIVO',       'debito',  '5.3.3.5'),
    ('NOM_AFP_EMPLEADOR_GASTO',         'debito',  '5.3.4.1'),
    ('NOM_SFS_EMPLEADOR_GASTO',         'debito',  '5.3.4.2'),
    ('NOM_SRL_EMPLEADOR_GASTO',         'debito',  '5.3.4.3'),
    ('NOM_INFOTEP_EMPLEADOR_GASTO',     'debito',  '5.3.4.4'),
    ('NOM_AFP_EMPLEADO_X_PAGAR',        'credito', '2.3.1'),
    ('NOM_SFS_EMPLEADO_X_PAGAR',        'credito', '2.3.1'),
    ('NOM_AFP_EMPLEADOR_X_PAGAR',       'credito', '2.3.1'),
    ('NOM_SFS_EMPLEADOR_X_PAGAR',       'credito', '2.3.1'),
    ('NOM_SRL_EMPLEADOR_X_PAGAR',       'credito', '2.3.1'),
    ('NOM_INFOTEP_EMPLEADOR_X_PAGAR',   'credito', '2.3.1')
  ) AS s(codigo, naturaleza, cuenta)
  JOIN contabilidad.cuenta_contable c
    ON c.codigo = s.cuenta AND c.admite_movimiento AND c.activa
ON CONFLICT (codigo) DO NOTHING;
