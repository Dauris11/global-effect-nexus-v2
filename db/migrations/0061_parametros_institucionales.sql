-- ================================================================
-- GLOBAL EFFECT NEXUS — 0061 · Parámetros institucionales
-- ================================================================
-- Cierra el pendiente de /configuracion: «no existe tabla donde
-- guardarlos». Los parámetros que antes estaban escritos en el código
-- (el horario del comedor, los mínimos de la beca, el correo de contacto)
-- pasan a vivir aquí y se editan desde la pantalla.
--
-- Solo se guarda lo que se aparta del valor por defecto. Qué claves
-- existen, de qué tipo son y cuál es su valor normal lo dice el código
-- (src/lib/parametros.ts): la base no puede inventar un parámetro que
-- ningún código lee. Sin fila = valor por defecto.
--
-- Los parámetros FISCALES siguen en contabilidad.parametro, con vigencia
-- temporal y fuente legal; esta tabla es para lo institucional.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.parametro_institucional (
  clave            TEXT PRIMARY KEY,
  valor            TEXT NOT NULL,
  actualizado_por  UUID REFERENCES public.usuario(id) ON DELETE SET NULL,
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parametro_institucional ENABLE ROW LEVEL SECURITY;
