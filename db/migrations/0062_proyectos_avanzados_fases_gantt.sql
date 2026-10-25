-- ================================================================
-- GLOBAL EFFECT NEXUS — 0062 · Proyectos Avanzados, Fases y Gantt
-- ================================================================
-- Extiende el modelo de operaciones (0009 y 0041) para dar soporte al
-- visualizador interactivo Gantt, subtareas, hitos, fases estructuradas,
-- dependencias lógicas y cálculo de ruta crítica.
-- ================================================================

-- 1. Fases del Proyecto
CREATE TABLE IF NOT EXISTS public.proyecto_fase (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  orden       INTEGER NOT NULL DEFAULT 1,
  color       TEXT DEFAULT '#2096BA',
  fecha_inicio DATE,
  fecha_fin    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fase_proyecto ON public.proyecto_fase(proyecto_id, orden);

-- 2. Hitos del Proyecto (Milestones)
CREATE TABLE IF NOT EXISTS public.proyecto_hito (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  fecha       DATE NOT NULL,
  alcanzado   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hito_proyecto ON public.proyecto_hito(proyecto_id, fecha);

-- 3. Extensión de la tabla tarea para soportar Gantt, fechas, esfuerzo y jerarquía
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS fase_id UUID REFERENCES public.proyecto_fase(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tarea_padre_id UUID REFERENCES public.tarea(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS progreso INTEGER DEFAULT 0 CHECK (progreso >= 0 AND progreso <= 100),
  ADD COLUMN IF NOT EXISTS horas_estimadas NUMERIC(6,2) DEFAULT 0 CHECK (horas_estimadas >= 0),
  ADD COLUMN IF NOT EXISTS horas_reales NUMERIC(6,2) DEFAULT 0 CHECK (horas_reales >= 0),
  ADD COLUMN IF NOT EXISTS es_hito BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tarea_fase ON public.tarea(fase_id);
CREATE INDEX IF NOT EXISTS idx_tarea_padre ON public.tarea(tarea_padre_id);
CREATE INDEX IF NOT EXISTS idx_tarea_fechas ON public.tarea(fecha_inicio, fecha_limite);

-- 4. Dependencias Lógicas entre Tareas (Gantt: Fin-Inicio FS, Inicio-Inicio SS)
CREATE TABLE IF NOT EXISTS public.tarea_dependencia (
  tarea_origen_id  UUID NOT NULL REFERENCES public.tarea(id) ON DELETE CASCADE,
  tarea_destino_id UUID NOT NULL REFERENCES public.tarea(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL DEFAULT 'FS' CHECK (tipo IN ('FS', 'SS', 'FF', 'SF')),
  dias_retraso     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tarea_origen_id, tarea_destino_id),
  CONSTRAINT chk_no_autodependencia CHECK (tarea_origen_id <> tarea_destino_id)
);
CREATE INDEX IF NOT EXISTS idx_dep_destino ON public.tarea_dependencia(tarea_destino_id);

-- 5. Poblar fases e hitos por defecto para los proyectos existentes
INSERT INTO public.proyecto_fase (proyecto_id, nombre, orden)
SELECT p.id, 'Fase 1: Planificación y Diseño', 1
  FROM public.proyecto p
 WHERE NOT EXISTS (SELECT 1 FROM public.proyecto_fase pf WHERE pf.proyecto_id = p.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.proyecto_fase (proyecto_id, nombre, orden)
SELECT p.id, 'Fase 2: Ejecución Operativa', 2
  FROM public.proyecto p
 WHERE EXISTS (SELECT 1 FROM public.proyecto_fase pf WHERE pf.proyecto_id = p.id AND pf.orden = 1)
   AND NOT EXISTS (SELECT 1 FROM public.proyecto_fase pf WHERE pf.proyecto_id = p.id AND pf.orden = 2)
ON CONFLICT DO NOTHING;
