-- 0125 · Actividades: el nivel entre el proyecto y la tarea.
--
-- Un proyecto como la Academia de Liderazgo se reparte en actividades con sus
-- propias fechas y su propio estado a lo largo del año; cada actividad agrupa
-- tareas. Las fases (0062) son las etapas del Gantt y no llevan estado ni
-- responsable, por eso no se reutilizan.

CREATE TABLE IF NOT EXISTS public.actividad (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id    UUID NOT NULL REFERENCES public.proyecto(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'planificacion'
                 CHECK (estado IN ('planificacion', 'en_curso', 'pausado', 'completado')),
  prioridad      TEXT NOT NULL DEFAULT 'media'
                 CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  fecha_inicio   DATE,
  fecha_fin      DATE,
  responsable_id UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT actividad_fechas_validas
    CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_actividad_proyecto ON public.actividad(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_actividad_fechas ON public.actividad(fecha_inicio, fecha_fin);

DROP TRIGGER IF EXISTS trg_actividad_updated ON public.actividad;
CREATE TRIGGER trg_actividad_updated BEFORE UPDATE ON public.actividad
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Una tarea suelta del proyecto sigue siendo válida: la actividad es opcional.
ALTER TABLE public.tarea
  ADD COLUMN IF NOT EXISTS actividad_id UUID REFERENCES public.actividad(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarea_actividad ON public.tarea(actividad_id);
