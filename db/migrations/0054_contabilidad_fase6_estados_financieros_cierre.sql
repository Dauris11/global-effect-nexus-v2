-- ============================================================
-- GLOBAL EFFECT NEXUS — MIGRACIÓN 0054
-- Fase 6 ERP Contabilidad: Reportes, Estados Financieros y Cierre
-- Entidad: Fundación Global Effect (ASFL Ley 122-05)
-- ============================================================

SELECT set_config('app.usuario_id',
                  (SELECT id::text FROM public.usuario WHERE email = 'sistema@globaleffect.org'),
                  true),
       set_config('app.agente', '0054_contabilidad_fase6_estados_financieros_cierre.sql', true);

-- 1. TABLA DE CIERRE ANUAL
-- ============================================================
CREATE TABLE IF NOT EXISTS contabilidad.cierre_anual (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ejercicio           smallint      NOT NULL UNIQUE CHECK (ejercicio BETWEEN 2020 AND 2099),
  fecha_cierre        date          NOT NULL DEFAULT CURRENT_DATE,
  asiento_cierre_id   uuid          REFERENCES contabilidad.asiento(id),
  total_ingresos      numeric(14,2) NOT NULL DEFAULT 0,
  total_gastos        numeric(14,2) NOT NULL DEFAULT 0,
  superavit_deficit   numeric(14,2) NOT NULL DEFAULT 0,
  cerrado_por         uuid          NOT NULL REFERENCES public.usuario(id),
  cerrado_en          timestamptz   NOT NULL DEFAULT now(),
  reabierto_por       uuid          REFERENCES public.usuario(id),
  reabierto_en        timestamptz,
  motivo_reapertura   text,
  notas               text
);

COMMENT ON TABLE contabilidad.cierre_anual IS
  'Registro formal del cierre anual de ejercicio con asiento de cancelación de ingresos y gastos hacia resultados acumulados.';

-- 2. TABLA DE SNAPSHOTS FINANCIEROS INMUTABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS contabilidad.snapshot_financiero (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text        NOT NULL CHECK (tipo IN ('balance_general', 'estado_actividades', 'flujo_efectivo', 'cambios_patrimonio', 'ejecucion_presupuestaria')),
  ejercicio     smallint    NOT NULL CHECK (ejercicio BETWEEN 2020 AND 2099),
  mes           smallint    CHECK (mes BETWEEN 1 AND 12),
  fecha_corte   date        NOT NULL,
  titulo        text        NOT NULL,
  datos_json    jsonb       NOT NULL,
  generado_por  uuid        NOT NULL REFERENCES public.usuario(id),
  generado_en   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE contabilidad.snapshot_financiero IS
  'Fotografía inmutable de un estado financiero oficial a una fecha de corte para auditoría externa o DGII.';

CREATE INDEX IF NOT EXISTS idx_snapshot_financiero_tipo_ejercicio
  ON contabilidad.snapshot_financiero (tipo, ejercicio);

-- 3. FORTALECIMIENTO DE contabilidad.cerrar_periodo
-- ============================================================
CREATE OR REPLACE FUNCTION contabilidad.cerrar_periodo(p_periodo uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Validar que no existan recibos o facturas proveedor en borrador
  IF EXISTS (SELECT 1 FROM contabilidad.recibo
              WHERE periodo_id = p_periodo AND estado = 'borrador')
     OR EXISTS (SELECT 1 FROM contabilidad.factura_proveedor
                 WHERE periodo_id = p_periodo AND estado = 'borrador') THEN
    RAISE EXCEPTION 'periodo_con_borradores';
  END IF;

  -- 2. Validar que no existan nóminas en borrador o pendientes de aprobación
  IF EXISTS (SELECT 1 FROM contabilidad.nomina n
              JOIN contabilidad.periodo_contable p ON p.id = p_periodo
             WHERE n.anio = p.anio AND n.mes = p.mes AND n.estado = 'borrador') THEN
    RAISE EXCEPTION 'periodo_con_nominas_borrador';
  END IF;

  -- 3. Validar que no existan conteos físicos en borrador
  IF EXISTS (SELECT 1 FROM contabilidad.conteo_fisico c
              JOIN contabilidad.periodo_contable p ON p.id = p_periodo
             WHERE EXTRACT(YEAR FROM c.fecha)::int = p.anio
               AND EXTRACT(MONTH FROM c.fecha)::int = p.mes
               AND c.estado = 'borrador') THEN
    RAISE EXCEPTION 'periodo_con_conteos_borrador';
  END IF;

  -- 4. Cerrar el período
  UPDATE contabilidad.periodo_contable
     SET estado = 'cerrado', cerrado_por = contabilidad._usuario_actual(), cerrado_en = now()
   WHERE id = p_periodo AND estado = 'abierto';

  IF NOT FOUND THEN RAISE EXCEPTION 'periodo_no_abierto'; END IF;
END;
$$;

-- 4. AUDITORÍA AUTOMÁTICA
-- ============================================================
SELECT contabilidad.auditar_tabla('contabilidad.cierre_anual');
SELECT contabilidad.auditar_tabla('contabilidad.snapshot_financiero');

-- 5. RLS
-- ============================================================
ALTER TABLE contabilidad.cierre_anual ENABLE ROW LEVEL SECURITY;
ALTER TABLE contabilidad.snapshot_financiero ENABLE ROW LEVEL SECURITY;

