-- 0081 · Conciliación bancaria partida por partida (Observaciones #1).
--
-- La conciliación de la 0036 trabajaba por lotes: cada importación abría una
-- conciliación con su rango y su saldo, y emparejaba contra movimientos del
-- libro de banco. El departamento pidió otra forma de trabajar:
--
--   · El estado de cuenta (.csv) se sube desde la cuenta, las veces que haga
--     falta, y una transacción que ya se subió no se vuelve a guardar: se
--     reconoce por su REFERENCIA del banco.
--   · Conciliar es emparejar una línea del banco con la línea de un asiento
--     que toca la cuenta contable auxiliar del banco (`cuenta_bancaria.
--     cuenta_contable_id`): así entra también un asiento manual que no pasó
--     por el libro de banco.
--   · Lo conciliado se ve en una lista y se puede anular.
--
-- Las tablas de la 0036 se quedan (historial), pero ya no se escriben.

CREATE TABLE IF NOT EXISTS contabilidad.extracto_linea (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id      uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  fecha          date NOT NULL,
  descripcion    text NOT NULL,
  referencia     text,
  monto          numeric(14,2) NOT NULL,  -- con signo, como lo dice el banco
  saldo          numeric(14,2),
  -- Lo que identifica la transacción para no guardarla dos veces: la
  -- referencia del banco o, si la línea no trae, fecha|monto|descripción.
  -- La calcula la app (src/lib/contabilidad/extracto.ts).
  clave          text NOT NULL,
  archivo_nombre text,
  importado_por  uuid NOT NULL REFERENCES public.usuario(id),
  importado_en   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cuenta_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_extracto_linea_cuenta_fecha
  ON contabilidad.extracto_linea (cuenta_id, fecha);

-- Una pareja banco ↔ asiento. Anular no borra (en contabilidad nada se
-- borra): marca la pareja y libera las dos líneas para otra conciliación.
CREATE TABLE IF NOT EXISTS contabilidad.conciliacion_partida (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id         uuid NOT NULL REFERENCES contabilidad.cuenta_bancaria(id),
  extracto_linea_id uuid NOT NULL REFERENCES contabilidad.extracto_linea(id),
  asiento_linea_id  uuid NOT NULL REFERENCES contabilidad.asiento_linea(id),
  conciliado_por    uuid NOT NULL REFERENCES public.usuario(id),
  conciliado_en     timestamptz NOT NULL DEFAULT now(),
  anulado_por       uuid REFERENCES public.usuario(id),
  anulado_en        timestamptz,
  motivo_anulacion  text,
  CHECK ((anulado_en IS NULL) = (anulado_por IS NULL))
);

-- Cada línea, del banco o del asiento, en UNA sola pareja viva.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partida_extracto_viva
  ON contabilidad.conciliacion_partida (extracto_linea_id) WHERE anulado_en IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_partida_asiento_viva
  ON contabilidad.conciliacion_partida (asiento_linea_id) WHERE anulado_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_partida_cuenta
  ON contabilidad.conciliacion_partida (cuenta_id, conciliado_en DESC);

SELECT contabilidad.auditar_tabla('contabilidad.extracto_linea');
SELECT contabilidad.auditar_tabla('contabilidad.conciliacion_partida');
