-- Costo integral por estudiante becado (plan: docs/estado/plan-costo-por-estudiante.md).
--
-- El gasto de la Fundación se registra por proveedor, cuenta y fondo, pero no
-- por BENEFICIARIO. Aquí se etiqueta cada gasto con el becado al que sirvió
-- (llave opcional: la partida doble no se toca) y una vista suma los cuatro
-- pilares: universidad, materiales, transporte y trámites.
--
-- Adaptaciones al esquema real respecto al plan (que usaba nombres supuestos):
--   · `orden_compra_linea` no tiene `monto_total` sino `total`, y la moneda y la
--     tasa viven en la cabecera `orden_compra`.
--   · No existe `articulo_inventario`: el inventario valorado es
--     `contabilidad.articulo`.
--   · `rendicion_gasto.estudiante_id` lo añade la 0111 (otro frente).
--   · La rendición `contabilizada` genera una factura de proveedor
--     (`factura_proveedor_id`): se excluye esa factura del conteo para no sumar
--     el mismo gasto dos veces.
--
-- Privacidad: estas cifras son de la Junta y de contabilidad; el estudiante,
-- docente, chofer y Habitudes no las ven nunca. Lo cierra el permiso nuevo
-- `expedientes.costos.leer`, más RLS en las tablas y vista sin acceso para los
-- roles de la API pública de Supabase.
--
-- Idempotente. Requiere la 0111 (rendicion_gasto.estudiante_id).

-- 1. Etiqueta del estudiante en los gastos ------------------------------------

-- `pilar_costo` dice a qué pilar pertenece la factura o la línea (una factura
-- de laptops no es universidad). Sin valor cuenta como universidad: es lo
-- habitual (matrícula, créditos).
ALTER TABLE contabilidad.factura_proveedor
  ADD COLUMN IF NOT EXISTS estudiante_id uuid REFERENCES public.estudiante(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pilar_costo text;

ALTER TABLE contabilidad.orden_compra_linea
  ADD COLUMN IF NOT EXISTS estudiante_id uuid REFERENCES public.estudiante(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pilar_costo text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'factura_proveedor_pilar_costo_check') THEN
    ALTER TABLE contabilidad.factura_proveedor
      ADD CONSTRAINT factura_proveedor_pilar_costo_check
      CHECK (pilar_costo IS NULL OR pilar_costo IN ('universidad', 'materiales', 'transporte', 'tramites'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orden_compra_linea_pilar_costo_check') THEN
    ALTER TABLE contabilidad.orden_compra_linea
      ADD CONSTRAINT orden_compra_linea_pilar_costo_check
      CHECK (pilar_costo IS NULL OR pilar_costo IN ('universidad', 'materiales', 'transporte', 'tramites'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_factura_proveedor_estudiante
  ON contabilidad.factura_proveedor (estudiante_id) WHERE estudiante_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orden_compra_linea_estudiante
  ON contabilidad.orden_compra_linea (estudiante_id) WHERE estudiante_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rendicion_gasto_estudiante
  ON public.rendicion_gasto (estudiante_id) WHERE estudiante_id IS NOT NULL;

-- 2. Materiales y equipamiento entregados, valorados --------------------------
CREATE TABLE IF NOT EXISTS public.estudiante_material_costo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id      uuid NOT NULL REFERENCES public.estudiante(id) ON DELETE CASCADE,
  articulo_id        uuid REFERENCES contabilidad.articulo(id) ON DELETE SET NULL,
  concepto           varchar(150) NOT NULL,
  cantidad           integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  costo_unitario_dop numeric(12,2) NOT NULL CHECK (costo_unitario_dop >= 0),
  costo_total_dop    numeric(12,2) GENERATED ALWAYS AS (cantidad * costo_unitario_dop) STORED,
  fecha              date NOT NULL DEFAULT CURRENT_DATE,
  creado_por         uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  creado_en          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estudiante_material_costo_est
  ON public.estudiante_material_costo (estudiante_id, fecha);

-- 3. Transporte institucional por cuatrimestre --------------------------------
-- Se registra A MANO por cuatrimestre y solo para quien usa la guagua (Rincón,
-- Jima, Ranchito, Saba Rey y Rancho Viejo): el costo NO se reparte entre todos
-- los becados. El prorrateo automático (combustible + mantenimiento + chofer
-- entre quienes tienen `transporte_inscripcion_recurrente` activa) queda para
-- la Fase 3; aquí solo está donde guardarlo.
CREATE TABLE IF NOT EXISTS public.estudiante_transporte_costo (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id      uuid NOT NULL REFERENCES public.estudiante(id) ON DELETE CASCADE,
  periodo_id         uuid NOT NULL REFERENCES public.periodo(id) ON DELETE RESTRICT,
  dias_asignados     smallint NOT NULL DEFAULT 0 CHECK (dias_asignados >= 0),
  costo_asignado_dop numeric(10,2) NOT NULL CHECK (costo_asignado_dop >= 0),
  observaciones      text,
  creado_por         uuid REFERENCES public.usuario(id) ON DELETE SET NULL,
  creado_en          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_estudiante_periodo_transporte UNIQUE (estudiante_id, periodo_id)
);

ALTER TABLE public.estudiante_material_costo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estudiante_transporte_costo ENABLE ROW LEVEL SECURITY;

-- 4. Detalle: una fila por gasto imputado a un estudiante ---------------------
-- Fuente única del desglose del expediente y de los totales: así el filtro por
-- período y el KPI nunca discrepan.
--
-- Regla anti doble conteo de la compra a un proveedor:
--   · línea de orden de compra: cuenta cuando la orden está `facturada` (el
--     compromiso ya es gasto) y es la que reparte entre varios estudiantes;
--   · factura: cuenta si está `aprobada`, tiene estudiante y NO viene de una
--     orden con líneas imputadas ni de una rendición imputada.
-- Importes en DOP: total × tasa (la tasa es nula cuando la moneda es DOP).
-- La rendición no guarda tasa: su monto se toma tal cual (casi siempre DOP).
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
  UNION ALL
  SELECT t.estudiante_id, pe.fecha_inicio, 'transporte',
         COALESCE(t.observaciones, 'Transporte ' || pe.nombre),
         NULL::text, pe.nombre, t.costo_asignado_dop, 'transporte', t.id
    FROM public.estudiante_transporte_costo t
    JOIN public.periodo pe ON pe.id = t.periodo_id
  UNION ALL
  SELECT rg.estudiante_id, rg.fecha_comprobante, 'tramites', rg.concepto,
         rg.proveedor_nombre, COALESCE(rg.ncf, rg.codigo), rg.monto_total, 'rendicion', rg.id
    FROM public.rendicion_gasto rg
   WHERE rg.estudiante_id IS NOT NULL
     AND rg.estado IN ('aprobada', 'contabilizada');

-- 5. Vista consolidada por estudiante -----------------------------------------
-- `cuatrimestres_cursados`: días desde el ingreso entre 120 (un cuatrimestre),
-- hacia arriba y como mínimo 1. Termina hoy si el becado sigue en el programa,
-- y en su última actualización si ya salió (graduado, retirado, inactivo).
-- `aportes_patrocinador`: monto mensual de cada asignación por los meses
-- completos transcurridos, solo asignaciones activas o finalizadas.
-- Es una ESTIMACIÓN (no hay tabla de aportes recibidos); la contrasta con el
-- costo, no es contabilidad de donaciones.
CREATE OR REPLACE VIEW public.v_estudiante_costo_total AS
  SELECT e.id AS estudiante_id,
         e.nombre,
         e.cedula,
         e.estado::text AS estado,
         e.fecha_ingreso,
         e.universidad_id,
         COALESCE(u.siglas, e.universidad) AS universidad,
         e.carrera_id,
         COALESCE(c.nombre, e.programa) AS carrera,
         COALESCE(d.total_universidad, 0) AS total_universidad,
         COALESCE(d.total_materiales, 0) AS total_materiales,
         COALESCE(d.total_transporte, 0) AS total_transporte,
         COALESCE(d.total_rendiciones, 0) AS total_rendiciones,
         COALESCE(d.total, 0) AS costo_total_acumulado,
         GREATEST(1, CEIL(
           (CASE WHEN e.estado::text IN ('graduado', 'retirado', 'inactivo')
                 THEN e.updated_at::date ELSE CURRENT_DATE END
            - COALESCE(e.fecha_ingreso, CURRENT_DATE)) / 120.0))::int AS cuatrimestres_cursados,
         COALESCE(a.aportes, 0) AS aportes_patrocinador
    FROM public.estudiante e
    LEFT JOIN public.universidad u ON u.id = e.universidad_id
    LEFT JOIN public.carrera c ON c.id = e.carrera_id
    LEFT JOIN (
      SELECT estudiante_id,
             SUM(monto_dop) FILTER (WHERE pilar = 'universidad') AS total_universidad,
             SUM(monto_dop) FILTER (WHERE pilar = 'materiales') AS total_materiales,
             SUM(monto_dop) FILTER (WHERE pilar = 'transporte') AS total_transporte,
             SUM(monto_dop) FILTER (WHERE pilar = 'tramites') AS total_rendiciones,
             SUM(monto_dop) AS total
        FROM public.v_estudiante_costo_detalle
       GROUP BY estudiante_id
    ) d ON d.estudiante_id = e.id
    LEFT JOIN (
      SELECT ab.estudiante_id,
             SUM(ab.monto * GREATEST(0,
               EXTRACT(YEAR FROM age(LEAST(COALESCE(ab.fecha_fin, CURRENT_DATE), CURRENT_DATE), ab.fecha_inicio)) * 12
               + EXTRACT(MONTH FROM age(LEAST(COALESCE(ab.fecha_fin, CURRENT_DATE), CURRENT_DATE), ab.fecha_inicio))
             )) AS aportes
        FROM public.asignacion_beca ab
       WHERE ab.estado IN ('activo', 'finalizado')
       GROUP BY ab.estudiante_id
    ) a ON a.estudiante_id = e.id;

-- Las vistas se ejecutan con los permisos de su dueño y se saltan la RLS: se
-- piden con los del que consulta, y se cierran a la API pública de Supabase.
DO $$
DECLARE
  v_rol text;
BEGIN
  BEGIN
    ALTER VIEW public.v_estudiante_costo_detalle SET (security_invoker = true);
    ALTER VIEW public.v_estudiante_costo_total SET (security_invoker = true);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'security_invoker no disponible: %', SQLERRM;
  END;
  FOREACH v_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
      EXECUTE format('REVOKE ALL ON public.v_estudiante_costo_detalle FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON public.v_estudiante_costo_total FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON public.estudiante_material_costo FROM %I', v_rol);
      EXECUTE format('REVOKE ALL ON public.estudiante_transporte_costo FROM %I', v_rol);
    END IF;
  END LOOP;
END $$;

-- 6. Permiso: quién puede ver el costo de un becado ---------------------------
-- super_admin, contabilidad y admin (informes a la Junta). Nunca estudiante,
-- docente, chofer ni Habitudes. `contabilidad.leer` no sirve: `admin` no lo
-- tiene y contabilidad ve cosas que la Junta no necesita en el expediente.
INSERT INTO public.permiso (codigo, descripcion) VALUES
  ('expedientes.costos.leer',
   'Ver el costo integral de un becado (universidad, materiales, transporte, trámites) y el reporte comparativo por carrera.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo = 'expedientes.costos.leer'
 WHERE r.nombre IN ('super_admin', 'contabilidad', 'admin')
ON CONFLICT DO NOTHING;
