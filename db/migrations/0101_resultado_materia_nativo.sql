-- ================================================================
-- PORTAL GLOBALEFFECT — 0101 · Resultados por materia, nativos
-- ================================================================
-- El gradua que sube el estudiante sirve para RECONSTRUIRLO al entrar al sistema:
-- se lee, se mapea a las materias del pénsum y queda guardado en el formato propio
-- de la plataforma. A partir de ahí solo se suben calificaciones y el expediente
-- (pénsum, índice, alertas) se recalcula solo. Reemplaza a `avance_pensum` (0100),
-- que guardaba una fila por materia y no podía representar una materia cursada
-- dos veces (p. ej. una retirada que se vuelve a cursar).
--
-- Una fila = UN INTENTO: estudiante + materia + año + ronda del cuatrimestre
-- (R1/R2/R3 → I/II/III). El estado vigente de una materia es su intento más
-- reciente. `nota_numerica` es opcional porque el gradua trae solo la letra y no
-- se inventa un número que no existe.
-- ================================================================

CREATE TABLE resultado_materia (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
  -- Código de la materia del pénsum; en una electiva, el del cupo (ELE015).
  codigo        TEXT NOT NULL,
  detalle       TEXT,
  nombre        TEXT NOT NULL,
  creditos      SMALLINT NOT NULL CHECK (creditos >= 0),
  anio          SMALLINT NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  ronda         SMALLINT NOT NULL CHECK (ronda BETWEEN 1 AND 3),
  -- A, B, C, D, F, P (seminario) o R (retirada), según la universidad.
  letra         TEXT NOT NULL,
  puntos        SMALLINT CHECK (puntos IS NULL OR puntos >= 0),
  nota_numerica NUMERIC(5,2) CHECK (nota_numerica IS NULL OR nota_numerica BETWEEN 0 AND 100),
  fuente        TEXT NOT NULL CHECK (fuente IN ('gradua', 'calificaciones', 'manual')),
  archivo_id    UUID REFERENCES archivo_academico(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estudiante_id, codigo, anio, ronda)
);
CREATE INDEX idx_resultado_materia_estudiante ON resultado_materia(estudiante_id, anio, ronda);
CREATE TRIGGER trg_resultado_materia_updated BEFORE UPDATE ON resultado_materia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lo ya leído en 0100 pasa al formato nativo: «R2 2023» → año 2023, ronda 2.
INSERT INTO resultado_materia (estudiante_id, codigo, detalle, nombre, creditos, anio, ronda, letra, puntos, fuente, archivo_id)
SELECT estudiante_id, codigo, detalle, nombre, creditos,
       substring(periodo FROM '(\d{4})')::smallint,
       substring(periodo FROM 'R(\d)')::smallint,
       letra, puntos, 'gradua', archivo_id
  FROM avance_pensum
 WHERE periodo ~ '^R\d \d{4}$' AND letra IS NOT NULL
ON CONFLICT DO NOTHING;

DROP TABLE avance_pensum;

-- Índice académico según las reglas de la universidad del estudiante, sobre el
-- intento más reciente de cada materia. Es la MISMA cuenta que `calcularIndice`
-- (src/lib/indice-academico.ts): puntos de la letra × créditos, la retirada solo
-- suma al divisor si la universidad lo pide, y se trunca o se redondea a 2
-- decimales. `NULL` si el estudiante no tiene resultados nativos: quien llama usa
-- entonces el historial anterior.
CREATE OR REPLACE FUNCTION indice_estudiante(p_estudiante UUID) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  WITH u AS (
    SELECT un.puntos_por_letra AS pp, un.retirada_cuenta_en_divisor AS rd, un.redondeo_indice AS rr
      FROM estudiante e JOIN universidad un ON un.id = e.universidad_id
     WHERE e.id = p_estudiante
  ), ult AS (
    SELECT DISTINCT ON (codigo) codigo, creditos, letra
      FROM resultado_materia
     WHERE estudiante_id = p_estudiante
     ORDER BY codigo, anio DESC, ronda DESC
  ), calc AS (
    SELECT sum(CASE WHEN ult.letra = 'R' THEN 0
                    ELSE coalesce((u.pp ->> ult.letra)::numeric, 0) * ult.creditos END) AS pts,
           sum(CASE WHEN ult.letra = 'R' THEN (CASE WHEN u.rd THEN ult.creditos ELSE 0 END)
                    WHEN u.pp ? ult.letra THEN ult.creditos
                    ELSE 0 END) AS divisor,
           max(u.rr) AS rr
      FROM ult CROSS JOIN u
  )
  SELECT CASE WHEN divisor > 0
              THEN CASE WHEN rr = 'truncar' THEN floor(pts * 100 / divisor + 0.000000001) / 100
                        ELSE round(pts * 100 / divisor) / 100 END
         END
    FROM calc
$$;
