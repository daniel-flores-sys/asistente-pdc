-- =============================================================================
-- Seed de datos normativos del sistema educativo boliviano
-- =============================================================================
-- Este archivo inserta SOLO los datos que son fijos por normativa del Ministerio
-- de Educación y no cambian entre instituciones:
--   - Niveles educativos (Inicial, Primario, Secundario)
--   - Años de escolaridad por nivel
--   - Áreas curriculares por nivel
--   - Gestión actual y sus trimestres
--   - Admin inicial desde variables de entorno
--
-- TODO: Los siguientes datos los carga el administrador desde el panel:
--   - Objetivos holísticos por año de escolaridad
--   - Temas mensuales por área/trimestre
--   - Docentes y sus créditos
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- NIVELES EDUCATIVOS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO nivel_educativo (nombre) VALUES
    ('Inicial'),
    ('Primario'),
    ('Secundario');

-- ─────────────────────────────────────────────────────────────────────────────
-- AÑOS DE ESCOLARIDAD
-- ─────────────────────────────────────────────────────────────────────────────

-- Nivel Inicial (2 años)
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 1, 'Primer Año'  FROM nivel_educativo WHERE nombre = 'Inicial';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 2, 'Segundo Año' FROM nivel_educativo WHERE nombre = 'Inicial';

-- Nivel Primario (6 años)
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 1, 'Primero'   FROM nivel_educativo WHERE nombre = 'Primario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 2, 'Segundo'   FROM nivel_educativo WHERE nombre = 'Primario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 3, 'Tercero'   FROM nivel_educativo WHERE nombre = 'Primario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 4, 'Cuarto'    FROM nivel_educativo WHERE nombre = 'Primario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 5, 'Quinto'    FROM nivel_educativo WHERE nombre = 'Primario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 6, 'Sexto'     FROM nivel_educativo WHERE nombre = 'Primario';

-- Nivel Secundario (6 años)
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 1, 'Primero de Secundaria'  FROM nivel_educativo WHERE nombre = 'Secundario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 2, 'Segundo de Secundaria' FROM nivel_educativo WHERE nombre = 'Secundario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 3, 'Tercero de Secundaria' FROM nivel_educativo WHERE nombre = 'Secundario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 4, 'Cuarto de Secundaria'  FROM nivel_educativo WHERE nombre = 'Secundario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 5, 'Quinto de Secundaria'  FROM nivel_educativo WHERE nombre = 'Secundario';
INSERT INTO anio_escolaridad (nivel_id, numero, literal)
SELECT id, 6, 'Sexto de Secundaria'   FROM nivel_educativo WHERE nombre = 'Secundario';

-- ─────────────────────────────────────────────────────────────────────────────
-- ÁREAS CURRICULARES
-- ─────────────────────────────────────────────────────────────────────────────

-- Nivel Primario — 9 áreas del currículo base plurinacional
INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Valores Espiritualidades y Religiones', 'VER', '2 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Comunicación y Lenguajes', 'CL', '9 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Ciencias Sociales', 'CS', '3 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Artes Plásticas y Visuales', 'APV', '2 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Educación Musical', 'EM', '2 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Educación Física y Deportes', 'EFD', '3 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Ciencias Naturales', 'CN', '4 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Matemática', 'MAT', '7 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

INSERT INTO area_curricular (nivel_id, nombre, codigo, carga_horaria)
SELECT id, 'Técnica Tecnológica', 'TT', '4 clases de 40 minutos a la semana'
FROM nivel_educativo WHERE nombre = 'Primario';

-- ─────────────────────────────────────────────────────────────────────────────
-- GESTIÓN Y TRIMESTRES ACTUALES
-- ─────────────────────────────────────────────────────────────────────────────

-- Gestión 2026 (año actual)
INSERT INTO gestion (anio) VALUES (2026);

-- Trimestres de 2026 (fechas aproximadas — el admin puede ajustarlas)
INSERT INTO trimestre (gestion_id, numero, fecha_inicio, fecha_fin)
SELECT id, 1, '2026-02-02', '2026-04-10' FROM gestion WHERE anio = 2026;

INSERT INTO trimestre (gestion_id, numero, fecha_inicio, fecha_fin)
SELECT id, 2, '2026-04-20', '2026-07-17' FROM gestion WHERE anio = 2026;

INSERT INTO trimestre (gestion_id, numero, fecha_inicio, fecha_fin)
SELECT id, 3, '2026-07-27', '2026-10-30' FROM gestion WHERE anio = 2026;

-- ─────────────────────────────────────────────────────────────────────────────
-- ADMIN INICIAL
-- ─────────────────────────────────────────────────────────────────────────────
-- El admin se crea desde las variables de entorno ADMIN_EMAIL y ADMIN_PASSWORD.
-- ms-orchestrator hace este INSERT al arrancar si no existe ningún admin.
-- Este script solo prepara la tabla — el hash de bcrypt lo genera el servicio.
--
-- Si necesitas insertar un admin manualmente con contraseña conocida:
-- INSERT INTO admins (nombre, email, password_hash)
-- VALUES ('Administrador', 'admin@pdc.edu.bo', '<bcrypt_hash>');
--
-- Para generar el hash en Python:
-- import bcrypt; bcrypt.hashpw(b'tu_password', bcrypt.gensalt(12)).decode()
-- =============================================================================
