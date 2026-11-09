-- 0075 · Los programas por rol alcanzan también a dir_habitudes y chofer.
--
-- La 0041 creó `proyecto_rol` con un CHECK de cuatro roles, anterior a la 0064
-- (chofer) y la 0065 (dir_habitudes). «Mi día» lee esa tabla por el rol de la
-- persona, así que a esos dos roles nunca les llegaba ningún programa aunque el
-- super_admin quisiera asignárselo. Ni super_admin ni estudiante entran: el
-- primero lo ve todo y el segundo no tiene jornada de personal.

ALTER TABLE public.proyecto_rol DROP CONSTRAINT IF EXISTS proyecto_rol_rol_check;
ALTER TABLE public.proyecto_rol
  ADD CONSTRAINT proyecto_rol_rol_check
  CHECK (rol IN ('admin', 'docente', 'contabilidad', 'habitudes', 'dir_habitudes', 'chofer'));
