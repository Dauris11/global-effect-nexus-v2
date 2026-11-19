-- ================================================================
-- PORTAL GLOBALEFFECT — 0096 · Permisos del catálogo y reglas por universidad
-- ================================================================
-- 1) `catalogo.leer` / `catalogo.escribir`: el catálogo de universidades y
--    pénsum no debe colgar de `academico.*`, que de fábrica también tienen
--    docentes y estudiantes. El super admin los reparte por rol o por persona.
-- 2) Cada universidad califica a su manera, así que sus reglas se guardan en su
--    fila y no en el código: puntos por letra, letra mínima para aprobar, si la
--    materia retirada («R») cuenta en el divisor del índice y cómo se redondea.
--    `reglas_confirmadas` queda en false hasta que alguien con el reglamento a la
--    vista las verifique: un índice calculado con reglas supuestas no debe pasar
--    por oficial.
-- ================================================================

INSERT INTO public.permiso (codigo, descripcion) VALUES
  ('catalogo.leer',     'Consultar el catálogo de universidades, carreras y pénsum.'),
  ('catalogo.escribir', 'Crear y editar universidades, carreras, pénsums y sus materias.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  CROSS JOIN public.permiso p
 WHERE r.nombre IN ('admin', 'super_admin')
   AND p.codigo IN ('catalogo.leer', 'catalogo.escribir')
ON CONFLICT DO NOTHING;

ALTER TABLE universidad
  ADD COLUMN puntos_por_letra JSONB NOT NULL DEFAULT '{"A":4,"B":3,"C":2,"D":1,"F":0}'::jsonb,
  ADD COLUMN letra_minima_aprobar TEXT NOT NULL DEFAULT 'D',
  ADD COLUMN retirada_cuenta_en_divisor BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN redondeo_indice TEXT NOT NULL DEFAULT 'truncar'
             CHECK (redondeo_indice IN ('truncar', 'redondear')),
  ADD COLUMN reglas_confirmadas BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN universidad.retirada_cuenta_en_divisor IS
  'Si los créditos de una materia retirada (R) se suman al divisor del índice. En UCATECI se dedujo así del reporte de validación: 746 puntos / 209 créditos (206 + 3 de una R) = 3,569 → 3,56.';
