-- ================================================================
-- GLOBAL EFFECT NEXUS — 0044 · Agenda Institucional de Reuniones
-- ================================================================
-- Sustitución definitiva del antiguo módulo de psicología (cerrado en 0030):
-- Las agendas de citas individuales pasan a ser agendas de reuniones
-- institucionales para todo el personal y la comunidad de la Fundación.
--
-- Tanto el personal interno (administración, dirección, docentes, finanzas,
-- Habitudes) como los estudiantes pueden agendar reuniones de coordinación,
-- seguimiento, tutoría y evaluación, con soporte para:
--   - Modalidad presencial, virtual o híbrida con enlace/sala.
--   - Registro de participantes (anfitrión, invitados, estudiantes).
--   - Minutas de acuerdos y compromisos post-reunión.
--   - Estados claros (programada, en_curso, realizada, cancelada).
-- ================================================================

CREATE TABLE IF NOT EXISTS public.reunion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio                  BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  titulo                 TEXT NOT NULL,
  descripcion            TEXT,
  tipo                   TEXT NOT NULL DEFAULT 'coordinacion'
                         CHECK (tipo IN ('coordinacion', 'seguimiento_estudiante', 'departamental', 'direccion', 'tutoria', 'general')),
  modalidad              TEXT NOT NULL DEFAULT 'presencial'
                         CHECK (modalidad IN ('presencial', 'virtual', 'hibrida')),
  lugar_o_enlace         TEXT,
  fecha                  DATE NOT NULL,
  hora_inicio            TIME NOT NULL,
  hora_fin               TIME NOT NULL,
  organizador_usuario_id UUID NOT NULL REFERENCES public.usuario(id) ON DELETE RESTRICT,
  estudiante_id          UUID REFERENCES public.estudiante(id) ON DELETE SET NULL,
  estado                 TEXT NOT NULL DEFAULT 'programada'
                         CHECK (estado IN ('programada', 'en_curso', 'realizada', 'cancelada', 'reprogramada')),
  conclusiones_o_minuta  TEXT,
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reunion_fecha ON public.reunion(fecha);
CREATE INDEX IF NOT EXISTS idx_reunion_organizador ON public.reunion(organizador_usuario_id);
CREATE INDEX IF NOT EXISTS idx_reunion_estudiante ON public.reunion(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_reunion_estado ON public.reunion(estado);

CREATE TABLE IF NOT EXISTS public.reunion_participante (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id             UUID NOT NULL REFERENCES public.reunion(id) ON DELETE CASCADE,
  usuario_id             UUID REFERENCES public.usuario(id) ON DELETE CASCADE,
  estudiante_id          UUID REFERENCES public.estudiante(id) ON DELETE CASCADE,
  rol_en_reunion         TEXT NOT NULL DEFAULT 'participante'
                         CHECK (rol_en_reunion IN ('anfitrion', 'participante', 'invitado', 'secretario')),
  asistencia             TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK (asistencia IN ('pendiente', 'confirmada', 'asistio', 'ausente', 'justificada')),
  nota                   TEXT,
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_reunion_part_entidad CHECK (usuario_id IS NOT NULL OR estudiante_id IS NOT NULL),
  CONSTRAINT uq_reunion_part_usuario UNIQUE (reunion_id, usuario_id),
  CONSTRAINT uq_reunion_part_estudiante UNIQUE (reunion_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_reunion_part_reunion ON public.reunion_participante(reunion_id);
CREATE INDEX IF NOT EXISTS idx_reunion_part_usuario ON public.reunion_participante(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reunion_part_estudiante ON public.reunion_participante(estudiante_id);

-- ----------------------------------------------------------------
-- Permisos RBAC para agenda de reuniones
-- ----------------------------------------------------------------
INSERT INTO public.permiso (codigo, descripcion) VALUES
  ('reuniones.leer', 'Consultar reuniones agendadas y minutas institucionales'),
  ('reuniones.agendar', 'Solicitar y programar reuniones institucionales o de tutoría'),
  ('reuniones.gestionar', 'Modificar estados, fechas, salas y redactar minutas de reunión')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignación a roles
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
 CROSS JOIN public.permiso p
 WHERE r.nombre IN ('super_admin', 'admin')
   AND p.codigo IN ('reuniones.leer', 'reuniones.agendar', 'reuniones.gestionar')
ON CONFLICT DO NOTHING;

INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
 CROSS JOIN public.permiso p
 WHERE r.nombre IN ('docente', 'contabilidad', 'habitudes', 'estudiante')
   AND p.codigo IN ('reuniones.leer', 'reuniones.agendar')
ON CONFLICT DO NOTHING;
