# ms-ai-generator

**Rol:** Genera el contenido estructurado del PDC en formato JSON, usando Ollama (Gemma 4B)
enriquecido con RAG desde ChromaDB. Si Ollama no está disponible, usa datos mock.

---

## Stack

| Item | Valor |
|---|---|
| Framework | FastAPI + Python 3.11 |
| Puerto | 8000 |
| BD | PostgreSQL 16 (lectura), ChromaDB (RAG) |
| LLM | Ollama gemma3:4b en Server 2 (:11434) |

---

## Variables de entorno

```env
PORT=8000
ENVIRONMENT=development
OLLAMA_URL=http://192.168.100.246:11434
OLLAMA_MODEL=gemma3:4b
DB_HOST=postgres
DB_PORT=5432
DB_NAME=genplan_db
DB_USER=genplan_user
DB_PASSWORD=genplan_pass
CHROMA_HOST=chromadb
CHROMA_PORT=8004
CHROMA_COLLECTION=curriculum_pdc
```

---

## Endpoints

```
GET /health
  Response: {
    status: "ok",
    service: "ms-ai-generator",
    ollama_available: boolean,
    chroma_available: boolean,
    ollama_model: string
  }

POST /generate
  Body: {
    nombre_docente:      string,
    ci_docente:          string,
    titulo_docente?:     string,
    unidad_educativa:    string,
    distrito:            string,
    nombre_director?:    string,
    anio_escolaridad_id: number,
    trimestre_id:        number,
    areas: [{
      id:     number,
      nombre: string,
      codigo: string
    }],
    temas: {
      [area_id: string]: [{
        semana_num:  number,
        titulo:      string,
        descripcion: string
      }]
    },
    objetivo_holistico: string,
    materiales?:        string,
    contexto_social?:   string
  }

  Response: {
    plan_id:  number,
    contenido: {
      areas: [{
        nombre:             string,
        codigo:             string,
        carga_horaria:      string,
        objetivo_aprendizaje: string,
        semanas: [{
          numero:     number,
          tema:       string,
          practica:   string,
          teoria:     string,
          valoracion: string,
          produccion: string,
          materiales: string[]
        }],
        criterios_evaluacion: {
          ser:   string,
          saber: string,
          hacer: string
        },
        adaptaciones_curriculares: string
      }]
    }
  }
```

---

## Flujo interno de POST /generate

```
1. INSERT plan_curricular (datos del docente + campos libres, contenido = null por ahora)
2. Consulta ChromaDB:
   - query: "planificacion curricular {area} {grado} {temas}"
   - Retorna top-5 chunks más relevantes del corpus pedagógico
3. Construye prompt con:
   - Contexto RAG (chunks recuperados)
   - Datos del docente y asignación
   - Temas seleccionados por semana
   - Objetivo holístico
   - Instrucción: "Genera el contenido pedagógico de cada semana en JSON"
4. POST Ollama /api/generate → espera respuesta JSON del LLM
5. Si Ollama no responde: usa mock_data.build_mock_pdc()
6. UPDATE plan_curricular SET contenido = <json_generado>
7. Retorna { plan_id, contenido }
```

---

## Estructura de carpetas

```
src/
├── domain/
│   └── schemas/
│       └── planificacion.py    # Pydantic models: GenerateRequest, PDCContenido, AreaSchema
├── application/
│   └── routes/
│       └── generate.py         # POST /generate
├── infrastructure/
│   ├── db.py                   # Pool PostgreSQL
│   ├── ollama_client.py        # Llamadas a Ollama
│   ├── chroma_client.py        # Búsqueda RAG en ChromaDB
│   ├── plan_repository.py      # INSERT/UPDATE plan_curricular
│   └── mock_data.py            # Fallback cuando Ollama no está disponible
└── main.py
```

---

## Configuración del LLM (desde system_config)

ms-ai-generator lee la tabla `system_config` al inicio de cada request de generación:

```python
# Claves que lee:
'llm_params'  → { temperatura: 0.7, max_tokens: 4096, modelo: "gemma3:4b" }
'rag_params'  → { top_k: 5, score_threshold: 0.7, collection: "curriculum_pdc" }
'prompts'     → { system_prompt: "Eres un experto...", user_template: "..." }
```

Esto permite que el admin ajuste el comportamiento del LLM sin redeploy.

---

## Carga horaria por área (Primario)

Constantes internas del servicio:

| Código | Área | Carga |
|---|---|---|
| VER | Valores Espiritualidades y Religiones | 2 clases × 40 min/semana |
| CL | Comunicación y Lenguajes | 9 clases × 40 min/semana |
| CS | Ciencias Sociales | 3 clases × 40 min/semana |
| APV | Artes Plásticas y Visuales | 2 clases × 40 min/semana |
| EFD | Educación Física y Deportes | 3 clases × 40 min/semana |
| CN | Ciencias Naturales | 4 clases × 40 min/semana |
| MAT | Matemática | 7 clases × 40 min/semana |
| TT | Técnica Tecnológica | 4 clases × 40 min/semana |
