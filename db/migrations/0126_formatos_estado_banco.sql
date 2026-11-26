-- ================================================================
-- PORTAL GLOBALEFFECT — 0126 · Formatos de estado de cuenta bancario
-- ================================================================
-- Mantenimiento en Configuración contable de los formatos CSV aceptados
-- al subir estados de cuenta en el módulo de bancos.
--
-- Se siembra «Santa Cruz» con la estructura real de exportación de
-- Banco Santa Cruz: omite filas 1 a 8 (cabecera del banco), omite la
-- última fila de totales después de las transacciones y lee las 8
-- columnas oficiales: Fecha de Posteo, Fecha Efectiva, No. Cheque,
-- No. Referencia, Descripción, Retiros, Depósitos y Balance.
--
-- Idempotente. Aplicar como rol `postgres`.
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario
                    WHERE email IN ('sistema@globaleffect.org', 'admin@globaleffect.org')
                    ORDER BY (email = 'sistema@globaleffect.org') DESC LIMIT 1),
                  true),
       set_config('app.agente', '0126_formatos_estado_banco.sql', true);

CREATE TABLE IF NOT EXISTS contabilidad.formato_estado_banco (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               text NOT NULL UNIQUE,
  filas_omitir_inicio  integer NOT NULL DEFAULT 0
                       CHECK (filas_omitir_inicio BETWEEN 0 AND 100),
  omitir_ultima_fila   boolean NOT NULL DEFAULT true,
  columnas             jsonb NOT NULL
                       CHECK (jsonb_typeof(columnas) = 'array' AND jsonb_array_length(columnas) > 0),
  activo               boolean NOT NULL DEFAULT true,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contabilidad.formato_estado_banco IS
  'Formatos CSV configurados para leer estados de cuenta en el módulo de bancos (mantenimiento en Configuración contable).';

ALTER TABLE contabilidad.formato_estado_banco ENABLE ROW LEVEL SECURITY;

SELECT contabilidad.auditar_tabla('contabilidad.formato_estado_banco'::regclass);

INSERT INTO contabilidad.formato_estado_banco
  (nombre, filas_omitir_inicio, omitir_ultima_fila, columnas, activo)
VALUES (
  'Santa Cruz',
  8,
  true,
  '["Fecha de Posteo","Fecha Efectiva","No. Cheque","No. Referencia","Descripción","Retiros","Depósitos","Balance"]'::jsonb,
  true
)
ON CONFLICT (nombre) DO NOTHING;

-- Alinear también `banco.config_estado` del Banco Santa Cruz con los encabezados reales.
UPDATE contabilidad.banco
   SET config_estado = jsonb_build_object(
         'fecha', 'Fecha de Posteo',
         'descripcion', 'Descripción',
         'referencia', 'No. Referencia',
         'debito', 'Retiros',
         'credito', 'Depósitos',
         'saldo', 'Balance',
         'formatoFecha', 'DD/MM/YYYY',
         'separadorDecimal', '.',
         'filasOmitirInicio', 8,
         'omitirUltimaFila', true
       )
 WHERE adaptador = 'santa-cruz';
