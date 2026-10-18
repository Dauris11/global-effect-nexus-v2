-- 0043_habitudes_hub_y_evidencias_liceos.sql
-- Hub colaborativo para facilitadores del Programa Habitudes y registro móvil de evidencias en liceos.

-- 1. Tabla de Liceos y Centros Educativos donde opera Habitudes
CREATE TABLE IF NOT EXISTS public.habitudes_liceo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    codigo TEXT UNIQUE,
    distrito_educativo TEXT NOT NULL DEFAULT 'Distrito 06-04 La Vega Oeste',
    director_nombre TEXT,
    telefono TEXT,
    direccion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Repositorio Colaborativo de Recursos y Diapositivas
CREATE TABLE IF NOT EXISTS public.habitudes_recurso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT NOT NULL CHECK (categoria IN ('diapositiva', 'guia_facilitador', 'infografia_didactica', 'dinamica_taller', 'evaluacion')),
    formato TEXT NOT NULL,
    archivo_url TEXT NOT NULL,
    archivo_nombre TEXT NOT NULL,
    tamano_mb NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    subido_por_id UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
    descargas_conteo INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Registro Móvil de Visitas a Liceos y Evidencias Fotográficas
CREATE TABLE IF NOT EXISTS public.habitudes_visita_evidencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liceo_id UUID NOT NULL REFERENCES public.habitudes_liceo(id) ON DELETE RESTRICT,
    facilitador_id UUID NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
    fecha_visita DATE NOT NULL DEFAULT CURRENT_DATE,
    tema_impartido TEXT NOT NULL,
    tanda TEXT NOT NULL CHECK (tanda IN ('matutina', 'vespertina', 'nocturna', 'jornada_extendida')) DEFAULT 'matutina',
    estudiantes_impactados INTEGER NOT NULL DEFAULT 0,
    observaciones TEXT,
    fotos_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    estado TEXT NOT NULL CHECK (estado IN ('borrador', 'completada', 'auditada')) DEFAULT 'completada',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_habitudes_recurso_cat ON public.habitudes_recurso(categoria, activo);
CREATE INDEX IF NOT EXISTS idx_habitudes_visita_liceo ON public.habitudes_visita_evidencia(liceo_id, fecha_visita DESC);
CREATE INDEX IF NOT EXISTS idx_habitudes_visita_facilitador ON public.habitudes_visita_evidencia(facilitador_id, fecha_visita DESC);

-- 4. Permisos RBAC
INSERT INTO public.permiso (codigo, descripcion)
VALUES
    ('habitudes.recursos.leer', 'Descargar presentaciones y materiales didácticos de Habitudes'),
    ('habitudes.recursos.subir', 'Compartir presentaciones y guías pedagógicas en el Hub Habitudes'),
    ('habitudes.evidencias.subir', 'Registrar visitas a liceos y subir fotografías de evidencia'),
    ('habitudes.evidencias.auditar', 'Validar y auditar informes de impacto de liceos')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignar permisos a roles correspondientes
-- super_admin y admin tienen control total
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.rol r
CROSS JOIN public.permiso p
WHERE r.nombre IN ('super_admin', 'admin')
  AND p.codigo IN (
      'habitudes.recursos.leer',
      'habitudes.recursos.subir',
      'habitudes.evidencias.subir',
      'habitudes.evidencias.auditar'
  )
ON CONFLICT DO NOTHING;

-- habitudes y docente pueden leer recursos, subir materiales y registrar evidencias en liceos
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM public.rol r
CROSS JOIN public.permiso p
WHERE r.nombre IN ('habitudes', 'docente')
  AND p.codigo IN (
      'habitudes.recursos.leer',
      'habitudes.recursos.subir',
      'habitudes.evidencias.subir'
  )
ON CONFLICT DO NOTHING;
