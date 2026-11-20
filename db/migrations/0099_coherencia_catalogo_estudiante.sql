-- ================================================================
-- PORTAL GLOBALEFFECT — 0099 · Coherencia del catálogo en el expediente
-- ================================================================
-- Auditoría del expediente: la cadena universidad → carrera → pénsum solo la
-- validaba la aplicación. Un UPDATE a mano (o un fallo futuro) podía dejar a un
-- estudiante con la carrera de otra universidad o un pénsum de otra carrera. Aquí
-- la base la hace cumplir también.
-- ================================================================

CREATE OR REPLACE FUNCTION validar_catalogo_estudiante() RETURNS trigger AS $$
BEGIN
  IF NEW.carrera_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM carrera
        WHERE id = NEW.carrera_id AND universidad_id = NEW.universidad_id) THEN
    RAISE EXCEPTION 'La carrera elegida no pertenece a la universidad del estudiante'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.pensum_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM pensum
        WHERE id = NEW.pensum_id AND carrera_id = NEW.carrera_id) THEN
    RAISE EXCEPTION 'El pénsum elegido no pertenece a la carrera del estudiante'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estudiante_catalogo
  BEFORE INSERT OR UPDATE OF universidad_id, carrera_id, pensum_id ON estudiante
  FOR EACH ROW EXECUTE FUNCTION validar_catalogo_estudiante();

-- El texto espejo (`universidad`, `programa`) de quien ya está enlazado al
-- catálogo pasa a ser las siglas y el nombre de la carrera: seis expedientes
-- tenían todavía el nombre largo escrito a mano y los listados mezclaban formas.
UPDATE estudiante e
   SET universidad = u.siglas
  FROM universidad u
 WHERE u.id = e.universidad_id AND e.universidad IS DISTINCT FROM u.siglas;

UPDATE estudiante e
   SET programa = c.nombre
  FROM carrera c
 WHERE c.id = e.carrera_id AND e.programa IS DISTINCT FROM c.nombre;
