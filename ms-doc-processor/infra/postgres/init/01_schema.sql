-- =============================================================================
-- Schema PDC Bolivia — Sistema de Generación de Planificaciones Curriculares
-- =============================================================================
-- Este archivo crea todas las tablas del sistema. Se ejecuta automáticamente
-- cuando el contenedor postgres arranca por primera vez (docker-entrypoint-initdb.d).
--
-- Tablas de referencia (gestionadas desde el panel admin):
--   nivel_educativo, anio_escolaridad, area_curricular, objetivo_holistico,
--   gestion, trimestre, tema_mes
--
-- Tablas de usuarios (autenticación separada por rol):
--   admins (administradores), usuarios (docentes)
--
-- Tablas de operación:
--   plan_curricular (PDCs generados), system_config (configuración JSONB),
--   documentos_indexados (tracking de documentos en ChromaDB)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- DATOS DE REFERENCIA CURRICULAR
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE nivel_educativo (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
    -- Valores: 'Inicial', 'Primario', 'Secundario'
);

CREATE TABLE anio_escolaridad (
    id       SERIAL PRIMARY KEY,
    nivel_id INTEGER NOT NULL REFERENCES nivel_educativo(id),
    numero   SMALLINT NOT NULL,       -- 1, 2, 3...
    literal  VARCHAR(50) NOT NULL,    -- 'Cuarto', 'Quinto', etc.
    UNIQUE (nivel_id, numero)
);

CREATE TABLE area_curricular (
    id            SERIAL PRIMARY KEY,
    nivel_id      INTEGER NOT NULL REFERENCES nivel_educativo(id),
    nombre        VARCHAR(100) NOT NULL,
    codigo        VARCHAR(10) NOT NULL,   -- 'CL', 'MAT', 'CN', etc.
    carga_horaria VARCHAR(100),           -- ej: '9 clases de 40 minutos a la semana'
    UNIQUE (nivel_id, codigo)
);

-- Cada año de escolaridad tiene un objetivo holístico por trimestre.
-- Las cuatro dimensiones corresponden al modelo SEP (Sistema Educativo Plurinacional).
CREATE TABLE objetivo_holistico (
    id                  SERIAL PRIMARY KEY,
    anio_escolaridad_id INTEGER NOT NULL REFERENCES anio_escolaridad(id),
    trimestre_num       SMALLINT NOT NULL,
    ser                 TEXT NOT NULL,
    saber               TEXT NOT NULL,
    hacer               TEXT NOT NULL,
    decidir             TEXT NOT NULL,
    UNIQUE (anio_escolaridad_id, trimestre_num)
);

CREATE TABLE gestion (
    id   SERIAL PRIMARY KEY,
    anio SMALLINT UNIQUE NOT NULL,
    CONSTRAINT anio_valido CHECK (anio > 2000 AND anio < 2100)
);

CREATE TABLE trimestre (
    id           SERIAL PRIMARY KEY,
    gestion_id   INTEGER NOT NULL REFERENCES gestion(id),
    numero       SMALLINT NOT NULL,
    fecha_inicio DATE,
    fecha_fin    DATE,
    CONSTRAINT numero_valido CHECK (numero IN (1, 2, 3)),
    UNIQUE (gestion_id, numero)
);

CREATE TABLE tema_mes (
    id                  SERIAL PRIMARY KEY,
    area_curricular_id  INTEGER NOT NULL REFERENCES area_curricular(id),
    anio_escolaridad_id INTEGER NOT NULL REFERENCES anio_escolaridad(id),
    trimestre_num       SMALLINT NOT NULL,
    semana_num          SMALLINT NOT NULL,
    titulo              VARCHAR(200) NOT NULL,
    descripcion         TEXT,
    UNIQUE (area_curricular_id, anio_escolaridad_id, trimestre_num, semana_num)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- USUARIOS Y AUTENTICACIÓN
-- ─────────────────────────────────────────────────────────────────────────────

-- Administradores del sistema (tabla separada de los docentes)
CREATE TABLE admins (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,    -- bcrypt, salt rounds=12
    activo        BOOLEAN DEFAULT TRUE,
    creado_en     TIMESTAMPTZ DEFAULT NOW()
);

-- Docentes (usuarios que generan PDCs)
CREATE TABLE usuarios (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,    -- bcrypt, salt rounds=12
    ci            VARCHAR(20) UNIQUE,       -- carnet de identidad boliviano
    titulo        VARCHAR(50),             -- 'Lic.', 'Prof.', 'Dr.', etc.
    creditos      SMALLINT DEFAULT 0,       -- 1 crédito = 1 PDC generado
    activo        BOOLEAN DEFAULT TRUE,
    creado_en     TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT creditos_no_negativos CHECK (creditos >= 0)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANES CURRICULARES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE plan_curricular (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
    anio_escolaridad_id INTEGER NOT NULL REFERENCES anio_escolaridad(id),
    trimestre_id        INTEGER NOT NULL REFERENCES trimestre(id),

    -- Datos libres que llena el docente — no se normalizan en tablas separadas
    -- porque varían por institución y no necesitan búsquedas relacionales
    nombre_docente      VARCHAR(150) NOT NULL,
    ci_docente          VARCHAR(20),
    titulo_docente      VARCHAR(50),
    unidad_educativa    TEXT NOT NULL,
    distrito            TEXT,
    nombre_director     TEXT,

    -- Número de plan dentro del trimestre para ese docente (1-10)
    numero_plan         SMALLINT DEFAULT 1,

    -- El PDC completo en formato JSON estructurado
    -- { areas: [{ nombre, codigo, semanas: [{ practica, teoria, valoracion... }] }] }
    contenido           JSONB,

    -- Guardados por ms-orchestrator tras recibir la respuesta de ms-doc-processor
    filename            TEXT,
    download_url        TEXT,

    creado_en           TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT numero_plan_valido CHECK (numero_plan BETWEEN 1 AND 10)
);

-- Índice para búsquedas por docente (historial)
CREATE INDEX idx_plan_curricular_usuario ON plan_curricular(usuario_id);
-- Índice GIN para búsquedas dentro del JSONB (futuro)
CREATE INDEX idx_plan_curricular_contenido ON plan_curricular USING GIN (contenido);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIGURACIÓN DEL SISTEMA
-- ─────────────────────────────────────────────────────────────────────────────

-- Parámetros configurables desde el panel admin, sin necesidad de redeploy.
-- Claves definidas:
--   'llm_params'    → { modelo, temperatura, max_tokens, top_p }
--   'rag_params'    → { top_k, score_threshold, collection }
--   'ingest_params' → { chunk_size, chunk_overlap, embed_model }
--   'prompts'       → { system_prompt, user_template }
CREATE TABLE system_config (
    clave        VARCHAR(100) PRIMARY KEY,
    valor        JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENTOS INDEXADOS EN CHROMADB
-- ─────────────────────────────────────────────────────────────────────────────

-- Metadata de los documentos pedagógicos que el admin sube e indexa en ChromaDB.
-- El estado permite saber qué está activo sin consultar ChromaDB directamente.
CREATE TABLE documentos_indexados (
    id               SERIAL PRIMARY KEY,
    nombre_archivo   VARCHAR(255) NOT NULL,
    tipo             VARCHAR(20) NOT NULL,    -- 'pdf', 'docx', 'txt'
    chunks_generados INTEGER DEFAULT 0,
    chroma_ids       TEXT[],                 -- IDs de los vectores en ChromaDB
    estado           VARCHAR(20) DEFAULT 'indexado',  -- 'indexado', 'error', 'eliminado'
    subido_por       INTEGER REFERENCES admins(id),
    creado_en        TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT estado_valido CHECK (estado IN ('indexado', 'error', 'eliminado'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES ADICIONALES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_anio_escolaridad_nivel ON anio_escolaridad(nivel_id);
CREATE INDEX idx_area_curricular_nivel ON area_curricular(nivel_id);
CREATE INDEX idx_trimestre_gestion ON trimestre(gestion_id);
CREATE INDEX idx_tema_mes_area ON tema_mes(area_curricular_id);
CREATE INDEX idx_tema_mes_anio ON tema_mes(anio_escolaridad_id);
CREATE INDEX idx_tema_mes_trimestre ON tema_mes(trimestre_num);
