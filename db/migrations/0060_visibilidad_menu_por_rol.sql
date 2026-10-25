-- ================================================================
-- GLOBAL EFFECT NEXUS — 0060 · Visibilidad de menús por rol
-- ================================================================
-- El administrador maestro decide qué ven los demás roles.
--
--   estado = 'oculto'    → la entrada desaparece de los menús, las pestañas
--                          del móvil, el buscador y los lanzadores. Si alguien
--                          conoce la dirección, la pantalla sigue abriendo
--                          (con sus permisos de siempre).
--   estado = 'bloqueado' → además, abrirla por la dirección redirige al inicio
--                          del rol.
--
-- Solo se guardan los estados que se apartan del normal: lo que no tiene fila
-- está visible. `clave` es la ruta del módulo (`/contabilidad/nomina`) o
-- `funcion:asistente_ia` para el botón del asistente.
--
-- Ocultar no concede ni quita permisos: el control de acceso a los datos sigue
-- siendo el RBAC (`rol_permiso`, `usuario_permiso`).
-- ================================================================

CREATE TABLE IF NOT EXISTS public.visibilidad_menu (
  rol              TEXT NOT NULL,
  clave            TEXT NOT NULL,
  estado           TEXT NOT NULL CHECK (estado IN ('oculto', 'bloqueado')),
  actualizado_por  UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rol, clave)
);

ALTER TABLE public.visibilidad_menu ENABLE ROW LEVEL SECURITY;
