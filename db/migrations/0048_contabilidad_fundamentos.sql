-- ================================================================
-- GLOBAL EFFECT NEXUS — 0048 · Contabilidad: fundamentos (Fase 1)
-- ================================================================
-- Fase 1 de docs/prompts/plan-contabilidad-erp.md. Sobre lo que ya
-- dejaron las 0032–0039 (partida doble, períodos, bitácora con
-- cadena de hash, parámetros con vigencia), añade:
--
--   1. La ENTIDAD: los datos de la Fundación que salen en los
--      formatos de la DGII y en los estados financieros, y la bandera
--      `emision_comprobantes_habilitada` (FALSE): la Fundación no
--      emite facturas, y el día que lo haga se enchufa un facturador
--      homologado detrás de `ComprobanteProvider` sin migrar nada.
--   2. Parámetros limpios. El seed se corrió varias veces sin
--      restricción y cada parámetro quedó repetido (cuatro u ocho
--      veces). Se dejan uno por vigencia y se impide que vuelva a
--      pasar con un índice único.
--   3. `vigente_hasta` es EXCLUSIVA —así la leen el CHECK y
--      `parametro_en`—, pero el seed escribió el 31 de diciembre como
--      último día: ese día no había parámetro vigente. Se corre al 1
--      de enero.
--   4. ITBIS y retenciones como parámetros con vigencia, nunca como
--      constantes en el código. La retención de ISR a personas
--      físicas pasa del 10 % al 15 % el 1 de julio de 2026 (Ley
--      30-26); la Ley 30-26 también cambia la escala del ISR, pero
--      desde 2027, y esa ya estaba cargada. Las dos cosas son
--      compatibles. La nota de cada fila dice qué falta validar con
--      el contador.
--   5. Más tipos de asiento: apertura, cierre y recurrente, además
--      de los automáticos, manuales y de ajuste (los reversos son
--      `ajuste`, como ya hacía `revertir_asiento`).
--   6. Asientos recurrentes: una plantilla que GENERA asientos
--      manuales cuando alguien lo pide. Nunca escribe sola: un asiento
--      que aparece sin que nadie lo genere no tiene a quién preguntar.
--   7. Cerrar y reabrir un período desde la base, con motivo
--      obligatorio al reabrir, para que la bitácora lo registre como
--      acción y no como un UPDATE más.
--   8. "Caja chica dirección" se creó sin padre y quedó fuera del
--      árbol del catálogo: se cuelga de Efectivo y Equivalentes.
--
-- Aplicar como rol `postgres` (SQL Editor de Supabase o conexión directa).
-- ================================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0048_contabilidad_fundamentos.sql', true);

-- ----------------------------------------------------------------
-- 1) La entidad
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.entidad (
  -- Una sola fila: la Fundación. El CHECK lo garantiza sin trigger.
  id                               boolean     PRIMARY KEY DEFAULT true CHECK (id),
  razon_social                     text        NOT NULL,
  nombre_comercial                 text,
  rnc                              text        CHECK (rnc IS NULL OR rnc ~ '^[0-9]{9}$'),
  -- ASFL bajo la Ley 122-05: decide qué ingresos son exentos.
  regimen                          text        NOT NULL DEFAULT 'asfl_122_05'
                                   CHECK (regimen IN ('asfl_122_05')),
  -- Mes en que empieza el ejercicio fiscal (1 = enero).
  inicio_ejercicio_mes             smallint    NOT NULL DEFAULT 1
                                   CHECK (inicio_ejercicio_mes BETWEEN 1 AND 12),
  moneda_base                      text        NOT NULL DEFAULT 'DOP' CHECK (moneda_base = 'DOP'),
  -- Decimales del redondeo de montos. La DGII trabaja con dos.
  decimales                        smallint    NOT NULL DEFAULT 2 CHECK (decimales BETWEEN 0 AND 4),
  direccion                        text,
  telefono                         text,
  email                            text,
  emision_comprobantes_habilitada  boolean     NOT NULL DEFAULT false,
  actualizado_por                  uuid        REFERENCES public.usuario(id),
  actualizado_en                   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO contabilidad.entidad (razon_social, nombre_comercial)
VALUES ('Fundación Global Effect', 'Global Effect')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE contabilidad.entidad IS
  'Datos de la Fundación para formatos DGII y estados financieros. Una sola fila.';
COMMENT ON COLUMN contabilidad.entidad.emision_comprobantes_habilitada IS
  'La Fundación no emite e-CF. En FALSE, ComprobanteProvider solo registra números emitidos fuera del sistema.';

SELECT contabilidad.auditar_tabla('contabilidad.entidad'::regclass);

-- ----------------------------------------------------------------
-- 2) y 3) Parámetros: uno por vigencia, y el fin exclusivo
-- ----------------------------------------------------------------
-- Los parámetros se protegen del DELETE (nada se borra en
-- contabilidad), pero estas filas son copias exactas creadas por un
-- seed repetido: no son historia, son ruido. Se apaga SOLO el
-- disparador que protege, dentro de esta migración; el de la
-- bitácora sigue encendido y deja constancia de cada fila borrada.
ALTER TABLE contabilidad.parametro DISABLE TRIGGER tg_proteger_contabilidad_parametro;

DELETE FROM contabilidad.parametro p
 USING contabilidad.parametro q
 WHERE p.clave = q.clave
   AND p.vigente_desde = q.vigente_desde
   AND p.valor = q.valor
   AND (p.creado_en, p.id) > (q.creado_en, q.id);

UPDATE contabilidad.parametro
   SET vigente_hasta = vigente_hasta + 1
 WHERE extract(month FROM vigente_hasta) = 12
   AND extract(day FROM vigente_hasta) = 31;

ALTER TABLE contabilidad.parametro ENABLE TRIGGER tg_proteger_contabilidad_parametro;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parametro_clave_desde
  ON contabilidad.parametro (clave, vigente_desde);

COMMENT ON COLUMN contabilidad.parametro.vigente_hasta IS
  'Primer día en que el parámetro YA NO vale (exclusivo). NULL = sin fin.';

-- ----------------------------------------------------------------
-- 4) ITBIS y retenciones
-- ----------------------------------------------------------------
INSERT INTO contabilidad.parametro (clave, valor, vigente_desde, vigente_hasta, fuente, nota) VALUES
  ('itbis.tasa.general',  '{"tasa": 0.18}', '2013-01-01', NULL, 'Ley 253-12',
   'Tasa general del ITBIS.'),
  ('itbis.tasa.reducida', '{"tasa": 0.16}', '2013-01-01', NULL, 'Ley 253-12',
   'Tasa reducida para los bienes que lista la ley. Validar la lista con el contador.'),
  ('itbis.tasa.exento',   '{"tasa": 0}',    '2013-01-01', NULL, 'Ley 253-12',
   'Bienes y servicios exentos y tasa cero.'),
  ('retencion.isr.persona_fisica', '{"tasa": 0.10, "conceptos": ["honorarios", "alquileres", "comisiones"]}',
   '2012-01-01', '2026-07-01', 'Código Tributario art. 309',
   'Retención a personas físicas antes de la Ley 30-26.'),
  ('retencion.isr.persona_fisica', '{"tasa": 0.15, "conceptos": ["honorarios", "alquileres", "comisiones"]}',
   '2026-07-01', NULL, 'Ley 30-26',
   'Retención a personas físicas desde el 1 de julio de 2026. Confirmar con el contador.'),
  ('retencion.itbis.servicios_persona_fisica', '{"tasa": 0.30}', '2005-01-01', NULL, 'Norma General 02-05',
   'Porción del ITBIS facturado que se retiene a personas físicas por servicios. En revisión para emisores electrónicos.'),
  ('retencion.itbis.total', '{"tasa": 1.00}', '2010-01-01', NULL, 'Norma General 08-10',
   'Retención del 100 % del ITBIS en los casos que la norma enumera. Validar los casos con el contador.')
ON CONFLICT (clave, vigente_desde) DO NOTHING;

-- ----------------------------------------------------------------
-- 5) Tipos de asiento
-- ----------------------------------------------------------------
ALTER TABLE contabilidad.asiento DROP CONSTRAINT IF EXISTS asiento_tipo_check;
ALTER TABLE contabilidad.asiento
  ADD CONSTRAINT asiento_tipo_check
  CHECK (tipo IN ('automatico', 'manual', 'ajuste', 'apertura', 'cierre', 'recurrente'));

-- ----------------------------------------------------------------
-- 6) Asientos recurrentes
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.asiento_recurrente (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text        NOT NULL,
  concepto        text        NOT NULL,
  -- [{cuenta_id, debe, haber, descripcion}], el mismo formato que
  -- crear_asiento. El cuadre se comprueba al generar, no aquí.
  lineas          jsonb       NOT NULL CHECK (jsonb_typeof(lineas) = 'array'),
  -- Día del mes en que toca. Un 31 en febrero cae el último día.
  dia_del_mes     smallint    NOT NULL DEFAULT 1 CHECK (dia_del_mes BETWEEN 1 AND 31),
  activo          boolean     NOT NULL DEFAULT true,
  -- Último mes generado (YYYY-MM-01): impide generar dos veces el mismo.
  ultimo_generado date,
  creado_por      uuid        NOT NULL REFERENCES public.usuario(id),
  creado_en       timestamptz NOT NULL DEFAULT now()
);

SELECT contabilidad.auditar_tabla('contabilidad.asiento_recurrente'::regclass);
ALTER TABLE contabilidad.asiento_recurrente ENABLE ROW LEVEL SECURITY;

-- Genera el asiento del mes de `p_fecha` si no se generó ya.
CREATE OR REPLACE FUNCTION contabilidad.generar_recurrente(p_plantilla uuid, p_fecha date)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_plantilla contabilidad.asiento_recurrente%ROWTYPE;
  v_mes date := date_trunc('month', p_fecha)::date;
  v_fecha date;
  v_id uuid;
BEGIN
  SELECT * INTO v_plantilla FROM contabilidad.asiento_recurrente
   WHERE id = p_plantilla FOR UPDATE;

  IF NOT FOUND OR NOT v_plantilla.activo THEN
    RAISE EXCEPTION 'plantilla_inactiva';
  END IF;
  IF v_plantilla.ultimo_generado IS NOT NULL AND v_plantilla.ultimo_generado >= v_mes THEN
    RAISE EXCEPTION 'ya_generado';
  END IF;

  v_fecha := least(v_mes + (v_plantilla.dia_del_mes - 1),
                   (v_mes + interval '1 month' - interval '1 day')::date);

  v_id := contabilidad.crear_asiento(v_fecha, v_plantilla.concepto, 'recurrente',
                                     'contabilidad.asiento_recurrente', v_plantilla.id,
                                     v_plantilla.lineas);

  UPDATE contabilidad.asiento_recurrente SET ultimo_generado = v_mes WHERE id = p_plantilla;
  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------
-- 7) Cerrar y reabrir un período
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION contabilidad.cerrar_periodo(p_periodo uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Un borrador olvidado en un mes cerrado ya no se podría contabilizar.
  IF EXISTS (SELECT 1 FROM contabilidad.recibo
              WHERE periodo_id = p_periodo AND estado = 'borrador')
     OR EXISTS (SELECT 1 FROM contabilidad.factura_proveedor
                 WHERE periodo_id = p_periodo AND estado = 'borrador') THEN
    RAISE EXCEPTION 'periodo_con_borradores';
  END IF;

  UPDATE contabilidad.periodo_contable
     SET estado = 'cerrado', cerrado_por = contabilidad._usuario_actual(), cerrado_en = now()
   WHERE id = p_periodo AND estado = 'abierto';

  IF NOT FOUND THEN RAISE EXCEPTION 'periodo_no_abierto'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION contabilidad.reabrir_periodo(p_periodo uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(length(trim(p_motivo)), 0) < 10 THEN
    RAISE EXCEPTION 'motivo_requerido';
  END IF;

  UPDATE contabilidad.periodo_contable
     SET estado = 'abierto', reabierto_por = contabilidad._usuario_actual(),
         reabierto_en = now(), motivo_reapertura = trim(p_motivo)
   WHERE id = p_periodo AND estado = 'cerrado';

  IF NOT FOUND THEN RAISE EXCEPTION 'periodo_no_cerrado'; END IF;
END;
$$;

-- ----------------------------------------------------------------
-- 8) Catálogo: la cuenta que quedó sin padre
-- ----------------------------------------------------------------
UPDATE contabilidad.cuenta_contable h
   SET padre_id = p.id
  FROM contabilidad.cuenta_contable p
 WHERE h.codigo = '1.1.01.03'
   AND p.codigo = '1.1.01'
   AND h.padre_id IS NULL;
