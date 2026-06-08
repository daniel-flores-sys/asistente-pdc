# ms-ingestion

**Rol:** Procesa documentos pedagógicos (PDFs, DOCX, TXT) para alimentar el sistema RAG.
Extrae texto, divide en chunks, genera embeddings via Ollama y los almacena en ChromaDB.
Registra metadata en PostgreSQL para que el admin pueda ver y gestionar los documentos indexados.

---

## Stack

| Item | Valor |
|---|---|
| Framework | FastAPI + Python 3.11 |
| Puerto | 8003 |
| BD | PostgreSQL 16 + ChromaDB |
| Embeddings | Ollama (nomic-embed-text) via Server 2 |

---

## Variables de entorno

```env
PORT=8003
ENVIRONMENT=development
CHROMA_HOST=chromadb
CHROMA_PORT=8004
CHROMA_COLLECTION=curriculum_pdc
DB_HOST=postgres
DB_PORT=5432
DB_NAME=genplan_db
DB_USER=genplan_user
DB_PASSWORD=genplan_pass
OLLAMA_URL=http://192.168.100.246:11434
EMBED_MODEL=nomic-embed-text
CHUNK_SIZE=800
CHUNK_OVERLAP=100
```

---

## Endpoints

```
GET /health
  Response: {
    status:           "ok",
    service:          "ms-ingestion",
    chroma_connected: boolean,
    collections:      [{ nombre, total_documentos }]
  }

POST /ingest
  Body: multipart/form-data {
    file:      PDF | DOCX | TXT,
    coleccion?: string   (default: "curriculum_pdc")
  }
  Response: {
    documento_id:      number,
    coleccion:         string,
    chunks_generados:  number,
    mensaje:           string
  }

GET /docs
  Response: [{
    id:               number,
    nombre_archivo:   string,
    tipo:             string,
    chunks_generados: number,
    estado:           "indexado" | "error" | "eliminado",
    creado_en:        string
  }]

DELETE /docs/{id}
  Acción: elimina vectores de ChromaDB + actualiza estado en PostgreSQL
  Response: { eliminado: true, chunks_removidos: number }

POST /docs/{id}/reindex
  Acción: re-extrae texto y regenera embeddings del documento
  Response: { chunks_generados: number }
```

---

## Flujo de ingesta

```
1. Recibir archivo (PDF|DOCX|TXT)
2. Extraer texto:
   - PDF: pdfplumber, página por página
   - DOCX: python-docx, párrafos
   - TXT: lectura directa
3. Chunking: bloques de ~800 caracteres con overlap de 100 caracteres
   - Mínimo 50 chars por chunk (descarta fragmentos vacíos)
4. Por cada chunk:
   POST http://ollama:11434/api/embeddings
   Body: { model: "nomic-embed-text", prompt: chunk }
   → vector float[] de 768 dimensiones
5. client.upsert(collection="curriculum_pdc", vectors=[...], metadatas=[...])
   metadata por chunk: { source: filename, page: N, chunk_index: M }
6. INSERT documentos_indexados (nombre_archivo, tipo, chunks_generados, chroma_ids, estado)
```

---

## Documentos recomendados para el corpus RAG

Los documentos que el admin debe ingestar para que el sistema tenga buen contexto pedagógico:

| Documento | Descripción |
|---|---|
| Guía PDC Primaria (Ministerio) | Estructura normativa oficial del PDC boliviano |
| Texto de Aprendizaje 2025 | Contenidos curriculares oficiales por grado |
| Lineamientos Curriculares | Orientaciones del currículo base plurinacional |
| Planes y Programas oficiales | Distribución de contenidos por área/grado/trimestre |

---

## Estructura de carpetas

```
src/
├── domain/
│   └── schemas/
│       └── ingestion.py         # Pydantic: IngestResponse, DocumentoInfo
├── application/
│   └── routes/
│       └── ingest.py            # POST /ingest, GET /docs, DELETE /docs/{id}
├── infrastructure/
│   ├── db.py
│   ├── documento_repository.py  # INSERT/UPDATE documentos_indexados
│   ├── text_extractor.py        # pdfplumber, python-docx, plain text
│   ├── chunker.py               # División en chunks con overlap
│   ├── embed_client.py          # Llamadas a Ollama /api/embeddings
│   └── chroma_store.py          # ChromaDB client
└── main.py
```
