# Flujo Transversal del Sistema PDC

Describe el recorrido completo de datos desde que el docente abre la aplicación hasta que descarga su PDC.

---

## Diagrama de flujo principal

```
DOCENTE (navegador)
  │
  │  1. GET /api/reference-data
  ├──────────────────────────────→ ms-orchestrator :3001
  │                                      │ SQL paralelo
  │                                      ├→ PostgreSQL: niveles, anios, areas, trimestres, temas
  │  ← JSON: catálogos ←─────────────────┘
  │
  │  2. Rellena formulario (4 pasos):
  │     - Nombre, CI, Título del docente
  │     - Unidad educativa (texto libre), Distrito, Director
  │     - Año de escolaridad (ID), Trimestre (ID)
  │     - Áreas seleccionadas (IDs), Temas por área (IDs)
  │     - Materiales adicionales, Contexto social
  │
  │  3. POST /api/generate  (Bearer JWT)
  ├──────────────────────────────→ ms-orchestrator :3001
  │                                      │ Verifica: usuario activo + créditos > 0
  │                                      │
  │                                      │  POST /generate
  │                                      ├──────────────→ ms-ai-generator :8000
  │                                      │                    │
  │                                      │                    │ SELECT: objetivo_holistico
  │                                      │                    │ SELECT: temas_mes por área/trimestre
  │                                      │                    ├→ PostgreSQL
  │                                      │                    │
  │                                      │                    │ Búsqueda RAG
  │                                      │                    ├→ ChromaDB: chunks relevantes
  │                                      │                    │
  │                                      │                    │ POST /api/generate
  │                                      │                    ├──────────→ Ollama :11434 (Server 2)
  │                                      │                    │            gemma3:4b genera JSON PDC
  │                                      │                    │  ← contenido_pdc JSONB ←─────────────┘
  │                                      │                    │
  │                                      │                    │ INSERT plan_curricular (contenido JSONB)
  │                                      │                    ├→ PostgreSQL
  │                                      │  ← { plan_id, contenido } ←─────────────────────────────
  │                                      │
  │                                      │  POST /doc/{plan_id}/upload
  │                                      ├──────────────→ ms-doc-processor :8001
  │                                      │                    │
  │                                      │                    │ SELECT plan_curricular JOIN
  │                                      │                    │   anio_escolaridad, trimestre
  │                                      │                    ├→ PostgreSQL
  │                                      │                    │
  │                                      │                    │ build_document() → .docx python-docx
  │                                      │                    │
  │                                      │                    │ PutObject (si AWS configurado)
  │                                      │                    ├──────────→ AWS S3 us-east-1
  │                                      │                    │  ← presigned URL (1 hora) ←──────────┘
  │                                      │  ← { download_url, filename } ←──────────────────────────
  │                                      │
  │                                      │ UPDATE usuarios SET creditos = creditos - 1
  │                                      ├→ PostgreSQL
  │                                      │
  │  ← { plan_id, download_url, creditos_restantes } ←────────────────────────────────────────────
  │
  │  4. Descarga el .docx
  └──────────────────────────────→ AWS S3 (URL presignada directa, sin pasar por los servicios)
```

---

## Flujo de autenticación

```
DOCENTE (navegador)
  │
  │  POST /api/auth/register
  │  Body: { nombre, email, password, ci, titulo? }
  ├──────────────────────────────→ ms-orchestrator
  │                                      │ bcrypt hash password
  │                                      │ INSERT usuarios (creditos=0)
  │  ← { id, nombre, email, creditos: 0 } ←──
  │
  │  POST /api/auth/login
  │  Body: { email, password }
  ├──────────────────────────────→ ms-orchestrator
  │                                      │ SELECT usuario WHERE email
  │                                      │ bcrypt.compare(password, hash)
  │                                      │ jwt.sign({ sub: id, email, rol: 'docente' })
  │  ← { access_token, user: { creditos } } ←──
  │
  │  Todas las rutas protegidas:
  │  Header: Authorization: Bearer <token>
  └──────────────────────────────→ ms-orchestrator (JwtAuthGuard verifica)
```

---

## Flujo de ingesta de documentos (admin)

```
ADMIN (panel /admin/documentos)
  │
  │  POST /api/admin/documentos
  │  Body: multipart/form-data { file: PDF }
  ├──────────────────────────────→ ms-orchestrator
  │                                      │  POST /ingest
  │                                      ├──────────────→ ms-ingestion :8003
  │                                      │                    │
  │                                      │                    │ pdfplumber: extrae texto por página
  │                                      │                    │ Chunking: bloques de ~800 chars con overlap 100
  │                                      │                    │
  │                                      │                    │ POST /api/embeddings (por chunk)
  │                                      │                    ├──────────→ Ollama :11434 (Server 2)
  │                                      │                    │            nomic-embed-text
  │                                      │                    │  ← vector 768 dims ←─────────────────
  │                                      │                    │
  │                                      │                    │ client.upsert(collection, vectors)
  │                                      │                    ├→ ChromaDB :8004
  │                                      │                    │
  │                                      │                    │ INSERT documentos_indexados
  │                                      │                    ├→ PostgreSQL
  │                                      │  ← { documento_id, chunks_generados } ←───────────────
  │  ← { id, nombre_archivo, chunks } ←──┘
```

---

## Flujo de configuración (admin)

```
ADMIN
  │
  │  PUT /api/admin/config/llm_params
  │  Body: { temperatura: 0.7, max_tokens: 4096, modelo: "gemma3:4b" }
  ├──────────────────────────────→ ms-orchestrator
  │                                      │ UPDATE system_config SET valor = $1 WHERE clave = 'llm_params'
  │                                      ├→ PostgreSQL
  │  ← { clave, valor, actualizado_en } ←──
  │
  │  Próxima generación de PDC:
  │  ms-ai-generator lee system_config en cada request
  │  SELECT valor FROM system_config WHERE clave IN ('llm_params', 'rag_params', 'prompts')
```

---

## Flujo de ms-monitor (auto-scaling)

```
ms-monitor (background loop cada 30 segundos)
  │
  ├→ Docker socket: GET /services  → lista de servicios Swarm
  ├→ Docker socket: GET /containers/stats → CPU% y RAM de cada tarea
  │
  │  Si CPU% promedio del servicio X > SCALE_UP_CPU_THRESHOLD (70%):
  │  └→ Docker socket: POST /services/{id}/update (replicas + 1)
  │     → Registra alerta: { service: X, event: "scale_up", replicas: N+1 }
  │
  │  Si CPU% promedio < SCALE_DOWN_CPU_THRESHOLD (20%) por 5 minutos:
  │  └→ Docker socket: POST /services/{id}/update (replicas - 1, mínimo 1)
  │     → Registra alerta: { service: X, event: "scale_down", replicas: N-1 }
  │
  │  Los datos de métricas se mantienen en memoria (deque de 200 puntos)
  │  y se exponen vía GET /monitor/metrics para el panel admin
```

---

## Fallbacks configurados

| Componente | Si no está disponible | Comportamiento |
|---|---|---|
| Ollama (Server 2) | Timeout o connection refused | ms-ai-generator usa `mock_data.py` — genera PDC de ejemplo |
| AWS S3 | `AWS_ACCESS_KEY_ID` vacío | ms-doc-processor retorna URL de descarga directa `/doc/{id}` |
| ChromaDB | Sin chunks disponibles | ms-ai-generator genera sin contexto RAG |

Estos fallbacks permiten desarrollo local sin infraestructura cloud y demo sin depender de Server 2.
