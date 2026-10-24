-- ================================================================
-- GLOBAL EFFECT NEXUS — SEMBRADO INICIAL (SEED)
-- Motor: PostgreSQL 17 (Supabase)
-- Ejecutar DESPUÉS de aplicar todas las migraciones (0001–0031).
-- Idempotente: usa ON CONFLICT para poder re-ejecutarse.
-- ================================================================

-- ================================================================
-- 1. ROLES INSTITUCIONALES
-- ================================================================
INSERT INTO rol (id, nombre, descripcion) VALUES
  ('441d3b24-9b2f-4b08-8f8e-a9b09db4d952', 'super_admin',  'Acceso absoluto a configuración, auditoría y todos los datos del sistema.'),
  ('0398bbdf-807d-411a-85d7-b8478d1fb52c', 'admin',        'Administración general operativa de la fundación y sus módulos.'),
  ('c34ab7f3-ef5a-471a-85b3-3a5f8b5490a1', 'docente',      'Portal docente: da clases de Global Effect 360, pone tareas y la nota final.'),
  ('d1ba6b9d-5a8b-49ef-871d-55cfb14798ef', 'estudiante',   'Portal estudiantil: revisa notas y materias, y pide trámites a administración.'),
  ('f7e8a9b0-c1d2-43e4-85f6-7b89c0d1e2f3', 'contabilidad', 'Gestión contable, transacciones, aportes y reportes financieros.')
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- ================================================================
-- 2. PERMISOS GRANULARES POR MÓDULO
-- ================================================================
INSERT INTO permiso (id, codigo, descripcion) VALUES
  -- Expedientes
  ('e1a1b1c1-1111-2222-3333-444455556666', 'expedientes.leer',        'Visualizar el listado y detalle de expedientes estudiantiles.'),
  ('e1a1b1c1-2222-2222-3333-444455556666', 'expedientes.escribir',    'Crear y modificar expedientes estudiantiles.'),
  ('e1a1b1c1-3333-2222-3333-444455556666', 'expedientes.eliminar',    'Eliminar expedientes estudiantiles del sistema.'),
  -- Académico
  ('a2a2b2c2-1111-2222-3333-444455556666', 'academico.leer',          'Visualizar materias, clases de 360 y períodos académicos.'),
  ('a2a2b2c2-2222-2222-3333-444455556666', 'academico.escribir',      'Crear y modificar materias, períodos y el catálogo de 360.'),
  ('a2a2b2c2-3333-2222-3333-444455556666', 'calificaciones.registrar','Poner la nota final de las clases de Global Effect 360.'),
  -- Patrocinadores y becas
  ('f3f3b3c3-1111-2222-3333-444455556666', 'patrocinadores.leer',     'Visualizar patrocinadores y aportes.'),
  ('f3f3b3c3-2222-2222-3333-444455556666', 'patrocinadores.escribir', 'Crear y modificar patrocinadores y asignaciones de becas.'),
  -- Finanzas
  ('f4f4b4c4-1111-2222-3333-444455556666', 'finanzas.leer',           'Visualizar transacciones, balances y reportes financieros.'),
  ('f4f4b4c4-2222-2222-3333-444455556666', 'finanzas.escribir',       'Registrar ingresos, egresos y categorías de transacción.'),
  -- Solicitudes y aprobaciones (0031)
  ('b5b5b5c5-1111-2222-3333-444455556666', 'solicitudes.gestionar',   'Revisar, aprobar, rechazar y completar trámites de estudiantes, altas de expediente y becas.'),
  ('b5b5b5c5-2222-2222-3333-444455556666', 'solicitudes.direccion',   'Segundo nivel de aprobación: becas y gastos por encima del umbral.'),
  -- Operaciones
  ('d6d6b6c6-1111-2222-3333-444455556666', 'operaciones.leer',        'Visualizar proyectos, tareas y calendario institucional.'),
  ('d6d6b6c6-2222-2222-3333-444455556666', 'operaciones.escribir',    'Crear proyectos, asignar tareas y agendar eventos.'),
  -- Configuración / usuarios
  ('c7c7b7c7-1111-2222-3333-444455556666', 'usuarios.administrar',    'Invitar, activar/desactivar usuarios y asignar roles y permisos.'),
  -- Inteligencia Artificial
  ('a8a8b8c8-1111-2222-3333-444455556666', 'ia.usar',                 'Usar los asistentes de IA (chat interno / estudiantil, OCR).'),
  ('a8a8b8c8-2222-2222-3333-444455556666', 'ia.administrar',          'Configurar la base de conocimiento y parámetros de la IA.')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- ================================================================
-- 3. ASIGNACIÓN DE PERMISOS A ROLES
-- ================================================================
DELETE FROM rol_permiso;

-- Por código y no por UUID: los permisos que añadieron las migraciones
-- (0015, 0025, 0031) no tienen un UUID fijo en este archivo, y este
-- reparto tiene que ser el mismo que `PERMISOS_POR_ROL` en
-- `src/lib/rbac.ts` y que deja la 0031 en una base ya desplegada.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
  FROM rol r
  JOIN permiso p ON p.codigo = ANY (CASE r.nombre
    -- SUPER ADMIN: todo menos postular, que es el trabajo de Habitudes.
    WHEN 'super_admin' THEN ARRAY(SELECT codigo FROM permiso
                                   WHERE codigo <> 'expedientes.postular')
    -- ADMIN: la operación entera, el expediente incluido; sin finanzas,
    -- usuarios, administración de IA ni el segundo nivel de aprobación.
    WHEN 'admin' THEN ARRAY[
      'academico.escribir', 'academico.leer',
      'expedientes.eliminar', 'expedientes.escribir', 'expedientes.leer',
      'ia.usar', 'landing.administrar',
      'operaciones.escribir', 'operaciones.leer',
      'patrocinadores.escribir', 'patrocinadores.leer',
      'solicitudes.gestionar']
    WHEN 'docente' THEN ARRAY[
      'academico.leer', 'calificaciones.registrar', 'operaciones.leer']
    WHEN 'estudiante' THEN ARRAY['academico.leer', 'ia.usar']
    WHEN 'contabilidad' THEN ARRAY[
      'finanzas.escribir', 'finanzas.leer', 'patrocinadores.leer']
    WHEN 'habitudes' THEN ARRAY['expedientes.postular']
  END);

-- ================================================================
-- 4. USUARIO ADMINISTRADOR MAESTRO
-- Email: admin@globaleffect.org   Password: admin123 (bcrypt)
-- ================================================================
INSERT INTO usuario (id, email, password_hash, nombre, idioma, activo, rol_id) VALUES
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'admin@globaleffect.org',
   '$2y$10$tZ26mU7e324gBv1u1rWzKujF7aYQ2h5mQn85YlFp8K19GvR6Y3f2a',
   'Administrador Global Effect', 'es', TRUE,
   '441d3b24-9b2f-4b08-8f8e-a9b09db4d952')
ON CONFLICT (email) DO UPDATE SET rol_id = EXCLUDED.rol_id, activo = EXCLUDED.activo;

-- ================================================================
-- 5. PERÍODOS ACADÉMICOS
-- ================================================================
INSERT INTO periodo (id, nombre, fecha_inicio, fecha_fin, estado) VALUES
  ('e3b0c442-98fc-1c14-9afb-f389a94dec93', '2026-I',  '2026-01-07', '2026-04-28', 'activo'),
  ('d8a3f81e-128a-4c28-984e-336785b9b2ff', '2026-II', '2026-05-05', '2026-08-25', 'planificado')
ON CONFLICT (nombre) DO UPDATE SET estado = EXCLUDED.estado;

-- ================================================================
-- 6. MATERIAS DE PRUEBA
-- ================================================================
INSERT INTO materia (id, nombre, codigo, descripcion, periodo_id, creditos, profesor_nombre, estado, horario, aula) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Introducción al Liderazgo', 'LID-101', 'Fundamentos de liderazgo y programa Habitudes.', 'e3b0c442-98fc-1c14-9afb-f389a94dec93', 3, 'Roberto Gómez', 'activa', 'Lunes 09:00 - 11:30', 'Aula A-1'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Inglés como Segundo Idioma (Básico)', 'ENG-101', 'Desarrollo de lectura y habla.', 'e3b0c442-98fc-1c14-9afb-f389a94dec93', 4, 'Sarah Jenkins', 'activa', 'Martes y Jueves 14:00 - 16:00', 'Lab 2')
ON CONFLICT DO NOTHING;

-- ================================================================
-- 7. PATROCINADOR DE PRUEBA
-- ================================================================
INSERT INTO patrocinador (id, nombre, tipo, email, telefono, pais, estado, monto_mensual, notas) VALUES
  ('330e8400-e29b-41d4-a716-446655440005', 'Hope Foundation US', 'ong', 'contact@hopefoundation.org', '+1 555-019-2834', 'Estados Unidos', 'activo', 250.00, 'Patrocina el programa de becas universitarias.')
ON CONFLICT DO NOTHING;
