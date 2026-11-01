-- 0064_sistema_transporte_institucional.sql
-- Sistema de Transporte Institucional en Tiempo Real de la Fundación Global Effect
-- Rutas, horarios fijos, paradas geográficas, inscripciones y seguimiento en vivo del chofer

-- 1. Registrar rol 'chofer'
INSERT INTO public.rol (nombre, descripcion)
VALUES ('chofer', 'Chofer institucional: Operador de rutas de transporte de la Fundación')
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- 2. Permisos del transporte
INSERT INTO public.permiso (codigo, descripcion)
VALUES
  ('transporte.operar', 'Iniciar/finalizar viajes, emitir coordenadas GPS y reportar averías'),
  ('transporte.gestionar', 'Administrar rutas, horarios, paradas e incidencias del transporte')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignar permisos a chofer
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  CROSS JOIN public.permiso p
 WHERE r.nombre = 'chofer'
   AND p.codigo IN ('transporte.operar')
ON CONFLICT DO NOTHING;

-- Asignar permisos a admin y super_admin
INSERT INTO public.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM public.rol r
  CROSS JOIN public.permiso p
 WHERE r.nombre IN ('super_admin', 'admin')
   AND p.codigo IN ('transporte.operar', 'transporte.gestionar')
ON CONFLICT DO NOTHING;

-- 3. Tabla de Rutas
CREATE TABLE IF NOT EXISTS transporte_ruta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(30) NOT NULL UNIQUE,
  nombre varchar(100) NOT NULL,
  descripcion text,
  sentido varchar(20) NOT NULL DEFAULT 'horario' CHECK (sentido IN ('horario', 'antihorario')),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- 4. Paradas geográficas de la ruta
CREATE TABLE IF NOT EXISTS transporte_parada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ruta_id uuid NOT NULL REFERENCES transporte_ruta(id) ON DELETE CASCADE,
  orden integer NOT NULL,
  nombre varchar(100) NOT NULL,
  referencia text,
  lat numeric(9,6) NOT NULL,
  lng numeric(9,6) NOT NULL,
  minutos_estimados integer NOT NULL DEFAULT 0,
  CONSTRAINT uq_transporte_parada_ruta_orden UNIQUE (ruta_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_transporte_parada_ruta_orden ON transporte_parada(ruta_id, orden);

-- 5. Horarios oficiales fijos (Los 4 viajes diarios)
CREATE TABLE IF NOT EXISTS transporte_horario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(30) NOT NULL UNIQUE,
  nombre varchar(100) NOT NULL,
  hora_salida time NOT NULL,
  hora_llegada_estimada time NOT NULL,
  ruta_id uuid NOT NULL REFERENCES transporte_ruta(id),
  orden integer NOT NULL DEFAULT 1,
  activo boolean NOT NULL DEFAULT true
);

-- 6. Inscripción recurrente semanal del estudiante (sin tener que anotarse a diario)
CREATE TABLE IF NOT EXISTS transporte_inscripcion_recurrente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id uuid NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  horario_id uuid NOT NULL REFERENCES transporte_horario(id) ON DELETE RESTRICT,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 6), -- 1=Lunes .. 6=Sábado
  parada_abordaje_id uuid NOT NULL REFERENCES transporte_parada(id),
  parada_destino_id uuid NOT NULL REFERENCES transporte_parada(id),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_transporte_estudiante_dia_horario UNIQUE (estudiante_id, dia_semana, horario_id)
);

CREATE INDEX IF NOT EXISTS idx_transporte_recurrente_estudiante ON transporte_inscripcion_recurrente(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_transporte_recurrente_dia_horario ON transporte_inscripcion_recurrente(dia_semana, horario_id) WHERE activo = true;

-- 7. Inscripción puntual diaria (acceso rápido o sin login con matrícula / nombre)
CREATE TABLE IF NOT EXISTS transporte_inscripcion_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  horario_id uuid NOT NULL REFERENCES transporte_horario(id),
  estudiante_id uuid REFERENCES estudiante(id) ON DELETE SET NULL,
  nombre_beneficiario varchar(150) NOT NULL,
  matricula_o_telefono varchar(50),
  parada_abordaje_id uuid NOT NULL REFERENCES transporte_parada(id),
  parada_destino_id uuid NOT NULL REFERENCES transporte_parada(id),
  presente boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transporte_diaria_fecha_horario ON transporte_inscripcion_diaria(fecha, horario_id);

-- 8. Viaje en ejecución (control por el chofer y geolocalización en tiempo real)
CREATE TABLE IF NOT EXISTS transporte_viaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horario_id uuid NOT NULL REFERENCES transporte_horario(id),
  chofer_id uuid NOT NULL REFERENCES usuario(id),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado varchar(20) NOT NULL DEFAULT 'programado'
    CHECK (estado IN ('programado', 'en_curso', 'completado', 'averiado', 'cancelado')),
  lat_actual numeric(9,6),
  lng_actual numeric(9,6),
  rumbo numeric(5,2) DEFAULT 0,
  velocidad_kmh numeric(5,2) DEFAULT 0,
  parada_actual_id uuid REFERENCES transporte_parada(id),
  iniciado_en timestamptz,
  finalizado_en timestamptz,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transporte_viaje_fecha_estado ON transporte_viaje(fecha, estado);

-- 9. Incidencias y reportes de avería del chofer
CREATE TABLE IF NOT EXISTS transporte_incidencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id uuid NOT NULL REFERENCES transporte_viaje(id) ON DELETE CASCADE,
  chofer_id uuid NOT NULL REFERENCES usuario(id),
  tipo varchar(30) NOT NULL CHECK (tipo IN ('averia_mecanica', 'transito_pesado', 'desvio_ruta', 'accidente', 'otro')),
  descripcion text NOT NULL,
  lat numeric(9,6),
  lng numeric(9,6),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transporte_incidencia_viaje ON transporte_incidencia(viaje_id);

-- 10. Datos iniciales (Rutas, Paradas y Horarios de La Vega)
DO $$
DECLARE
  v_ruta_principal uuid;
  v_ruta_inversa uuid;
BEGIN
  -- Rutas
  INSERT INTO transporte_ruta (codigo, nombre, descripcion, sentido)
  VALUES (
    'RUTA_PRINCIPAL',
    'Ruta Principal: La Vega – Controba – Jima – Ranchito – Sabana Rey',
    'Recorrido desde La Vega/UCATECI pasando por Cruce de Controba, Rincón, Jima Abajo, La Ceivita, El Ranchito y Sabana Rey con retorno interior.',
    'horario'
  )
  ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_ruta_principal;

  INSERT INTO transporte_ruta (codigo, nombre, descripcion, sentido)
  VALUES (
    'RUTA_INVERSA',
    'Ruta Alternativa / Inversa: La Vega – Sabana Rey – Ranchito – Jima',
    'Recorrido inverso entrando por dentro hacia Sabana Rey, El Ranchito, La Ceivita, Jima Abajo, Rincón, Controba y La Vega.',
    'antihorario'
  )
  ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_ruta_inversa;

  -- Paradas Ruta Principal
  IF NOT EXISTS (SELECT 1 FROM transporte_parada WHERE ruta_id = v_ruta_principal) THEN
    INSERT INTO transporte_parada (ruta_id, orden, nombre, referencia, lat, lng, minutos_estimados) VALUES
      (v_ruta_principal, 1, 'UCATECI', 'Campus Universitario (Terminal)', 19.214800, -70.536500, 0),
      (v_ruta_principal, 2, 'Oficina Central Fundación Global Effect', 'Calle Restauración / Centro La Vega', 19.222000, -70.529000, 10),
      (v_ruta_principal, 3, 'Cruce de Controba', 'Autopista Duarte con Entrada a Rincón', 19.182000, -70.472000, 25),
      (v_ruta_principal, 4, 'Rincón', 'Parque Central de Rincón', 19.155000, -70.408000, 40),
      (v_ruta_principal, 5, 'Jima Abajo (Cimabajo)', 'Centro de Jima Abajo / Calle Duarte', 19.133000, -70.380000, 55),
      (v_ruta_principal, 6, 'La Ceivita (La Cevita)', 'Carretera Principal La Ceivita', 19.152000, -70.355000, 68),
      (v_ruta_principal, 7, 'El Ranchito', 'Cruce Carretera La Vega - San Francisco', 19.185000, -70.362000, 80),
      (v_ruta_principal, 8, 'Sabana Rey', 'Entrada Principal Sabana Rey', 19.208000, -70.395000, 95),
      (v_ruta_principal, 9, 'Camino por dentro / Periferia', 'Conexión interior hacia La Vega', 19.220000, -70.470000, 110);
  END IF;

  -- Paradas Ruta Inversa
  IF NOT EXISTS (SELECT 1 FROM transporte_parada WHERE ruta_id = v_ruta_inversa) THEN
    INSERT INTO transporte_parada (ruta_id, orden, nombre, referencia, lat, lng, minutos_estimados) VALUES
      (v_ruta_inversa, 1, 'UCATECI', 'Campus Universitario (Terminal)', 19.214800, -70.536500, 0),
      (v_ruta_inversa, 2, 'Oficina Central Fundación Global Effect', 'Centro La Vega', 19.222000, -70.529000, 10),
      (v_ruta_inversa, 3, 'Camino por dentro / Periferia', 'Conexión interior este', 19.220000, -70.470000, 20),
      (v_ruta_inversa, 4, 'Sabana Rey', 'Entrada Sabana Rey', 19.208000, -70.395000, 35),
      (v_ruta_inversa, 5, 'El Ranchito', 'Cruce El Ranchito', 19.185000, -70.362000, 50),
      (v_ruta_inversa, 6, 'La Ceivita (La Cevita)', 'Carretera La Ceivita', 19.152000, -70.355000, 62),
      (v_ruta_inversa, 7, 'Jima Abajo (Cimabajo)', 'Centro Jima Abajo', 19.133000, -70.380000, 75),
      (v_ruta_inversa, 8, 'Rincón', 'Parque Central de Rincón', 19.155000, -70.408000, 90),
      (v_ruta_inversa, 9, 'Cruce de Controba', 'Autopista Duarte', 19.182000, -70.472000, 105);
  END IF;

  -- Los 4 Horarios Diarios Oficiales
  INSERT INTO transporte_horario (codigo, nombre, hora_salida, hora_llegada_estimada, ruta_id, orden)
  VALUES
    ('VIAJE_06AM', 'Viaje 1: Matutino (06:00 AM – 08:00 AM)', '06:00:00', '08:00:00', v_ruta_principal, 1),
    ('VIAJE_12M',  'Viaje 2: Mediodía (12:00 PM – 01:30 PM)', '12:00:00', '13:30:00', v_ruta_principal, 2),
    ('VIAJE_06PM', 'Viaje 3: Tarde (06:00 PM – 07:30 PM)',    '18:00:00', '19:30:00', v_ruta_principal, 3),
    ('VIAJE_08PM', 'Viaje 4: Noche (08:00 PM – 09:30 PM)',    '20:00:00', '21:30:00', v_ruta_principal, 4)
  ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        hora_salida = EXCLUDED.hora_salida,
        hora_llegada_estimada = EXCLUDED.hora_llegada_estimada;
END $$;
