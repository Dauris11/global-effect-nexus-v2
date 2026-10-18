-- 0045_director_habitudes_y_mapa_la_vega.sql
-- Director de Habitudes (DH), mapa interactivo exclusivo de La Vega y geolocalización de liceos y viviendas.

-- 1. Rol Director de Habitudes (DH) y permisos de supervisión
INSERT INTO public.rol (nombre, descripcion)
VALUES (
    'dir_habitudes',
    'Director de Habitudes (DH): supervisión pedagógica, monitoreo de profesores, evidencias de liceos y asignaciones'
)
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.permiso (codigo, descripcion)
VALUES (
    'habitudes.supervisar',
    'Monitorear profesores de Habitudes, auditar evidencias fotográficas, gestionar mapa y asignar liceos'
)
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignar permisos a dir_habitudes
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
 CROSS JOIN public.permiso p
 WHERE r.nombre = 'dir_habitudes'
   AND p.codigo IN (
       'habitudes.recursos.leer',
       'habitudes.recursos.subir',
       'habitudes.evidencias.subir',
       'habitudes.evidencias.auditar',
       'habitudes.supervisar',
       'expedientes.postular',
       'operaciones.leer',
       'reuniones.crear',
       'reuniones.leer',
       'rendicion.enviar'
   )
ON CONFLICT DO NOTHING;

-- super_admin y admin también pueden supervisar Habitudes
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  JOIN public.permiso p ON p.codigo = 'habitudes.supervisar'
 WHERE r.nombre IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

-- 2. Campos geográficos en liceos (Acotados estrictamente a la provincia de La Vega)
-- Bounding box de la provincia de La Vega: Latitud [18.7000, 19.4500], Longitud [-70.9500, -70.3500]
ALTER TABLE public.habitudes_liceo
    ADD COLUMN IF NOT EXISTS municipio TEXT NOT NULL DEFAULT 'Concepción de La Vega',
    ADD COLUMN IF NOT EXISTS distrito_municipal TEXT,
    ADD COLUMN IF NOT EXISTS sector TEXT,
    ADD COLUMN IF NOT EXISTS calle TEXT,
    ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_habitudes_liceo_bounds_la_vega'
    ) THEN
        ALTER TABLE public.habitudes_liceo
            ADD CONSTRAINT chk_habitudes_liceo_bounds_la_vega
            CHECK (
                (latitud IS NULL AND longitud IS NULL) OR (
                    latitud >= 18.7000 AND latitud <= 19.4500 AND
                    longitud >= -70.9500 AND longitud <= -70.3500
                )
            );
    END IF;
END $$;

-- 3. Tabla de Asignación de Profesores a Liceos de La Vega
CREATE TABLE IF NOT EXISTS public.habitudes_liceo_profesor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liceo_id UUID NOT NULL REFERENCES public.habitudes_liceo(id) ON DELETE CASCADE,
    profesor_id UUID NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
    tanda TEXT NOT NULL CHECK (tanda IN ('matutina', 'vespertina', 'nocturna', 'jornada_extendida')) DEFAULT 'matutina',
    materia_taller TEXT NOT NULL DEFAULT 'Liderazgo Habitudes',
    activo BOOLEAN NOT NULL DEFAULT true,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    asignado_por UUID REFERENCES public.usuario(id),
    UNIQUE (liceo_id, profesor_id, tanda)
);

CREATE INDEX IF NOT EXISTS idx_liceo_profesor_prof ON public.habitudes_liceo_profesor(profesor_id);
CREATE INDEX IF NOT EXISTS idx_liceo_profesor_lic ON public.habitudes_liceo_profesor(liceo_id);

-- 4. Tabla de Asignación de Estudiantes a Liceos de Habitudes
CREATE TABLE IF NOT EXISTS public.habitudes_liceo_estudiante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liceo_id UUID NOT NULL REFERENCES public.habitudes_liceo(id) ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES public.estudiante(id) ON DELETE CASCADE,
    grado TEXT DEFAULT '5to Secundaria',
    seccion TEXT DEFAULT 'A',
    activo BOOLEAN NOT NULL DEFAULT true,
    registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    registrado_por UUID REFERENCES public.usuario(id),
    UNIQUE (liceo_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_liceo_estudiante_est ON public.habitudes_liceo_estudiante(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_liceo_estudiante_lic ON public.habitudes_liceo_estudiante(liceo_id);

-- 5. Campos geográficos en vivienda del estudiante (estrictamente en La Vega)
ALTER TABLE public.perfil_vivienda
    ADD COLUMN IF NOT EXISTS municipio TEXT NOT NULL DEFAULT 'Concepción de La Vega',
    ADD COLUMN IF NOT EXISTS distrito_municipal TEXT,
    ADD COLUMN IF NOT EXISTS sector TEXT,
    ADD COLUMN IF NOT EXISTS calle TEXT,
    ADD COLUMN IF NOT EXISTS numero_casa TEXT,
    ADD COLUMN IF NOT EXISTS referencia_ubicacion TEXT,
    ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_perfil_vivienda_bounds_la_vega'
    ) THEN
        ALTER TABLE public.perfil_vivienda
            ADD CONSTRAINT chk_perfil_vivienda_bounds_la_vega
            CHECK (
                (latitud IS NULL AND longitud IS NULL) OR (
                    latitud >= 18.7000 AND latitud <= 19.4500 AND
                    longitud >= -70.9500 AND longitud <= -70.3500
                )
            );
    END IF;
END $$;
