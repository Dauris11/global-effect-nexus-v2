-- Anulación de los registros manuales de costo por estudiante (0112).
--
-- En contabilidad nada se borra: un material o un cobro de transporte mal
-- cargado se ANULA con motivo y quién lo anuló, y se vuelve a registrar bien.
-- La fila queda para la auditoría y la vista de detalle (de la que beben el
-- expediente y el reporte) deja de contarla.
--
-- El transporte tenía UNIQUE (estudiante, período): con anulación, la fila
-- anulada seguiría bloqueando el registro corregido, así que la unicidad pasa
-- a un índice parcial sobre las filas vigentes.
--
-- Idempotente. Requiere la 0112.

ALTER TABLE public.estudiante_material_costo
  ADD COLUMN IF NOT EXISTS anulado_en timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_por uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_anulacion text;

ALTER TABLE public.estudiante_transporte_costo
  ADD COLUMN IF NOT EXISTS anulado_en timestamptz,
  ADD COLUMN IF NOT EXISTS anulado_por uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_anulacion text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estudiante_material_costo_anulacion_check') THEN
    ALTER TABLE public.estudiante_material_costo
      ADD CONSTRAINT estudiante_material_costo_anulacion_check
      CHECK (anulado_en IS NULL OR length(btrim(COALESCE(motivo_anulacion, ''))) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estudiante_transporte_costo_anulacion_check') THEN
    ALTER TABLE public.estudiante_transporte_costo
      ADD CONSTRAINT estudiante_transporte_costo_anulacion_check
      CHECK (anulado_en IS NULL OR length(btrim(COALESCE(motivo_anulacion, ''))) > 0);
  END IF;
END $$;

ALTER TABLE public.estudiante_transporte_costo
  DROP CONSTRAINT IF EXISTS uq_estudiante_periodo_transporte;
CREATE UNIQUE INDEX IF NOT EXISTS uq_estudiante_periodo_transporte_vigente
  ON public.estudiante_transporte_costo (estudiante_id, periodo_id)
  WHERE anulado_en IS NULL;

-- Misma vista que la 0112, sin los registros anulados (mismas columnas, así
-- que `v_estudiante_costo_total` y los permisos de la vista siguen intactos).
CREATE OR REPLACE VIEW public.v_estudiante_costo_detalle AS
  SELECT f.estudiante_id,
         f.fecha_emision AS fecha,
         COALESCE(f.pilar_costo, 'universidad') AS pilar,
         f.concepto,
         p.nombre AS origen,
         f.ncf AS referencia,
         round(f.total * COALESCE(f.tasa, 1), 2) AS monto_dop,
         'factura'::text AS fuente,
         f.id AS fuente_id
    FROM contabilidad.factura_proveedor f
    JOIN contabilidad.proveedor p ON p.id = f.proveedor_id
   WHERE f.estado = 'aprobada'
     AND f.estudiante_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.rendicion_gasto rg
        WHERE rg.factura_proveedor_id = f.id AND rg.estudiante_id IS NOT NULL)
     AND NOT EXISTS (
       SELECT 1 FROM contabilidad.orden_compra_linea l
        WHERE l.orden_compra_id = f.orden_compra_id AND l.estudiante_id IS NOT NULL)
  UNION ALL
  SELECT l.estudiante_id,
         oc.fecha,
         COALESCE(l.pilar_costo, 'universidad'),
         l.descripcion,
         p.nombre,
         'OC-' || oc.numero::text,
         round(l.total * COALESCE(oc.tasa, 1), 2),
         'orden_compra',
         l.id
    FROM contabilidad.orden_compra_linea l
    JOIN contabilidad.orden_compra oc ON oc.id = l.orden_compra_id
    JOIN contabilidad.proveedor p ON p.id = oc.proveedor_id
   WHERE oc.estado = 'facturada' AND l.estudiante_id IS NOT NULL
  UNION ALL
  SELECT m.estudiante_id, m.fecha, 'materiales', m.concepto,
         NULL::text, NULL::text, m.costo_total_dop, 'material', m.id
    FROM public.estudiante_material_costo m
   WHERE m.anulado_en IS NULL
  UNION ALL
  SELECT t.estudiante_id, pe.fecha_inicio, 'transporte',
         COALESCE(t.observaciones, 'Transporte ' || pe.nombre),
         NULL::text, pe.nombre, t.costo_asignado_dop, 'transporte', t.id
    FROM public.estudiante_transporte_costo t
    JOIN public.periodo pe ON pe.id = t.periodo_id
   WHERE t.anulado_en IS NULL
  UNION ALL
  SELECT rg.estudiante_id, rg.fecha_comprobante, 'tramites', rg.concepto,
         rg.proveedor_nombre, COALESCE(rg.ncf, rg.codigo), rg.monto_total, 'rendicion', rg.id
    FROM public.rendicion_gasto rg
   WHERE rg.estudiante_id IS NOT NULL
     AND rg.estado IN ('aprobada', 'contabilizada');
