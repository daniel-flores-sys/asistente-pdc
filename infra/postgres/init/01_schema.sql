-- =============================================================================
-- Schema PDC Bolivia — Sistema de Generación de Planificaciones Curriculares
-- =============================================================================
-- Usa UUID en todas las tablas para evitar colisiones y facilitar merges.
-- Requiere la extensión pgcrypto (incluida en postgres:16 oficial).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- DATOS DE REFERENCIA CURRICULAR
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE nivel_educativo (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) UNIQUE NOT NULL
    -- Valores: 'Inicial', 'Primario', 'Secundario'
);

CREATE TABLE anio_escolaridad (
    id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    nivel_id UUID    NOT NULL REFERENCES nivel_educativo(id) ON DELETE CASCADE,
    numero   SMALLINT NOT NULL,      -- 1, 2, 3...
    literal  VARCHAR(50) NOT NULL,   -- 'Cuarto', 'Quinto', etc.
    UNIQUE (nivel_id, numero)
);

CREATE TABLE area_curricular (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    nivel_id      UUID    NOT NULL REFERENCES nivel_educativo(id) ON DELETE CASCADE,
    nombre        VARCHAR(100) NOT NULL,
    codigo        VARCHAR(10)  NOT NULL,   -- 'CL', 'MAT', 'CN', etc.
    carga_horaria VARCHAR(100),
    UNIQUE (nivel_id, codigo)
);

-- Objetivo holístico por año de escolaridad y trimestre (modelo SEP boliviano).
-- Las cuatro dimensiones ser/saber/hacer/decidir son obligatorias.
CREATE TABLE objetivo_holistico (
    id                  UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    anio_escolaridad_id UUID     NOT NULL REFERENCES anio_escolaridad(id) ON DELETE CASCADE,
    trimestre_num       SMALLINT NOT NULL,
    ser                 TEXT     NOT NULL,
    saber               TEXT     NOT NULL,
    hacer               TEXT     NOT NULL,
    decidir             TEXT     NOT NULL,
    CONSTRAINT trimestre_valido CHECK (trimestre_num IN (1, 2, 3)),
    UNIQUE (anio_escolaridad_id, trimestre_num)
);

CREATE TABLE gestion (
    id   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    anio SMALLINT UNIQUE NOT NULL,
    CONSTRAINT anio_valido CHECK (anio > 2000 AND anio < 2100)
);

CREATE TABLE trimestre (
    id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    gestion_id   UUID     NOT NULL REFERENCES gestion(id) ON DELETE CASCADE,
    numero       SMALLINT NOT NULL,
    fecha_inicio DATE,
    fecha_fin    DATE,
    CONSTRAINT numero_valido CHECK (numero IN (1, 2, 3)),
    UNIQUE (gestion_id, numero)
);

-- Un tema por trimestre (no por semana). Organiza el contenido curricular
-- de cada área para un año de escolaridad en un trimestre dado.
CREATE TABLE tema_trimestral (
    id                  UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    area_curricular_id  UUID     NOT NULL REFERENCES area_curricular(id) ON DELETE CASCADE,
    anio_escolaridad_id UUID     NOT NULL REFERENCES anio_escolaridad(id) ON DELETE CASCADE,
    trimestre_num       SMALLINT NOT NULL,
    titulo              VARCHAR(200) NOT NULL,
    descripcion         TEXT,
    CONSTRAINT trimestre_valido CHECK (trimestre_num IN (1, 2, 3)),
    UNIQUE (area_curricular_id, anio_escolaridad_id, trimestre_num)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USUARIOS Y AUTENTICACIÓN
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE admins (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        VARCHAR(150) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    activo        BOOLEAN      DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE usuarios (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        VARCHAR(150) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    ci            VARCHAR(20)  UNIQUE,
    titulo        VARCHAR(50),
    creditos      SMALLINT     DEFAULT 0,
    activo        BOOLEAN      DEFAULT TRUE,
    creado_en     TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT creditos_no_negativos CHECK (creditos >= 0)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANES CURRICULARES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE plan_curricular (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id          UUID         NOT NULL REFERENCES usuarios(id),
    anio_escolaridad_id UUID         NOT NULL REFERENCES anio_escolaridad(id),
    trimestre_id        UUID         NOT NULL REFERENCES trimestre(id),

    nombre_docente      VARCHAR(150) NOT NULL,
    ci_docente          VARCHAR(20),
    titulo_docente      VARCHAR(50),
    unidad_educativa    TEXT         NOT NULL,
    distrito            TEXT,
    nombre_director     TEXT,

    numero_plan         SMALLINT     DEFAULT 1,

    -- PDC completo en JSON estructurado
    contenido           JSONB,

    filename            TEXT,
    download_url        TEXT,

    creado_en           TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT numero_plan_valido CHECK (numero_plan BETWEEN 1 AND 10)
);

CREATE INDEX idx_plan_curricular_usuario    ON plan_curricular(usuario_id);
CREATE INDEX idx_plan_curricular_contenido  ON plan_curricular USING GIN (contenido);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIGURACIÓN DEL SISTEMA
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE system_config (
    clave          VARCHAR(100) PRIMARY KEY,
    valor          JSONB        NOT NULL,
    actualizado_en TIMESTAMPTZ  DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENTOS INDEXADOS EN CHROMADB
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE documentos_indexados (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_archivo   VARCHAR(255) NOT NULL,
    tipo             VARCHAR(20)  NOT NULL,
    chunks_generados INTEGER      DEFAULT 0,
    chroma_ids       TEXT[],
    estado           VARCHAR(20)  DEFAULT 'indexado',
    subido_por       UUID         REFERENCES admins(id),
    creado_en        TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT estado_valido CHECK (estado IN ('indexado', 'error', 'eliminado'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES ADICIONALES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_anio_escolaridad_nivel   ON anio_escolaridad(nivel_id);
CREATE INDEX idx_area_curricular_nivel    ON area_curricular(nivel_id);
CREATE INDEX idx_trimestre_gestion        ON trimestre(gestion_id);
CREATE INDEX idx_tema_trimestral_area     ON tema_trimestral(area_curricular_id);
CREATE INDEX idx_tema_trimestral_anio     ON tema_trimestral(anio_escolaridad_id);
CREATE INDEX idx_tema_trimestral_trim     ON tema_trimestral(trimestre_num);
CREATE INDEX idx_objetivo_anio            ON objetivo_holistico(anio_escolaridad_id);
