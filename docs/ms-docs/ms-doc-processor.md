# ms-doc-processor

**Rol:** Convierte el JSON de un plan curricular almacenado en PostgreSQL en un documento
Word (.docx) con el formato oficial boliviano (tablas por área, colores, fuentes específicas)
y lo sube a AWS S3. Devuelve una URL de descarga al orquestador.

---

## Stack

| Item | Valor |
|---|---|
| Framework | FastAPI + Python 3.11 |
| Puerto | 8001 |
| BD | PostgreSQL 16 |
| Librerías clave | python-docx, boto3 |

---

## Variables de entorno

```env
PORT=8001
ENVIRONMENT=development
DB_HOST=postgres
DB_PORT=5432
DB_NAME=genplan_db
DB_USER=genplan_user
DB_PASSWORD=genplan_pass
OUTPUT_DIR=./output
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=pdc-documentos-floresmedina
AWS_REGION=us-east-1
S3_PRESIGNED_EXPIRY=3600
```

Si `AWS_ACCESS_KEY_ID` está vacío, el servicio opera en modo local: devuelve una URL
de descarga directa (`/doc/{id}`) en lugar de una URL de S3.

---

## Endpoints

```
GET /health
  Response: {
    status: "ok",
    service: "ms-doc-processor",
    s3_configured: boolean
  }

POST /doc/{plan_id}/upload
  Acción: Genera el .docx desde la BD y lo sube a S3
  Response: {
    s3_url:      string | null,    # URL presignada S3 (1 hora), null si S3 no está configurado
    fallback_url: string,          # /doc/{plan_id} — descarga directa siempre disponible
    filename:    string            # nombre del archivo: PDC_{UE}_{grado}_T{trimestre}_{año}.docx
  }

GET /doc/{plan_id}
  Acción: Descarga directa del .docx (regenera el documento si no está en output/)
  Response: StreamingResponse (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
```

---

## Estructura del documento Word generado

### Encabezado (tabla de datos referenciales)

```
EDUCACIÓN PRIMARIA COMUNITARIA VOCACIONAL
PLAN DE DESARROLLO CURRICULAR Nº {numero_plan}

┌─────────────────────┬──────────────────────────┐
│ Distrito educativo  │ Unidad educativa          │
│ Nivel               │ Año de escolaridad        │
│ Director/a (colspan 2)                          │
│ Maestro/a (colspan 2)                           │
│ Áreas (colspan 2)                               │
│ Trimestre           │ Del: {fecha} al: {fecha}  │
└─────────────────────┴──────────────────────────┘
```

### Desarrollo (una tabla por área curricular)

```
┌────────────────────────────────────────────────────────────────────┐
│ NOMBRE DEL ÁREA (fondo verde claro, colspan 6)                     │
├───────────────┬───────────┬────────────┬──────────┬────────┬───────┤
│ Obj.Aprend.   │ Contenidos│  Momentos  │ Recursos │Períodos│Crit.  │
├───────────────┼───────────┼────────────┼──────────┼────────┼───────┤
│ Semana 1      │ tema      │ práctica   │materiales│ horas  │ SER   │
│               │           │ teoría     │          │        │ SABER │
│               │           │ valoración │          │        │ HACER │
│               │           │ producción │          │        │       │
├───────────────┼───────────┼────────────┼──────────┼────────┼───────┤
│ Semana 2...   │           │            │          │        │       │
├───────────────┴───────────┴────────────┴──────────┴────────┴───────┤
│ Adaptaciones curriculares (colspan 6)                              │
└────────────────────────────────────────────────────────────────────┘
```

**Formato visual:**
- Fuente: Arial Narrow 9-10pt para contenido, 11pt para títulos
- Encabezado de área: fondo `#E2EFD9` (verde claro)
- Filas impares: blanco; filas pares: verde claro
- Márgenes: 1.5 cm todos los lados

---

## Query SQL (simplificada con nuevo schema)

```sql
SELECT
  pc.id,
  pc.numero_plan,
  pc.nombre_docente,
  pc.ci_docente,
  pc.titulo_docente,
  pc.unidad_educativa,
  pc.distrito,
  pc.nombre_director,
  pc.contenido,
  ae.literal       AS anio_escolaridad,
  t.numero         AS trimestre,
  t.fecha_inicio,
  t.fecha_fin,
  g.anio           AS gestion
FROM plan_curricular pc
JOIN anio_escolaridad ae ON ae.id = pc.anio_escolaridad_id
JOIN trimestre t ON t.id = pc.trimestre_id
JOIN gestion g ON g.id = t.gestion_id
WHERE pc.id = $1
```

---

## Estructura de carpetas

```
src/
├── domain/
│   └── schemas/
│       └── plan.py               # Pydantic: PlanData
├── application/
│   ├── routes/
│   │   └── doc.py                # POST /doc/{id}/upload, GET /doc/{id}
│   └── services/
│       └── doc_builder.py        # build_document(plan) → python-docx Document
├── infrastructure/
│   ├── db.py
│   ├── plan_repository.py        # SELECT plan con JOIN
│   └── s3_uploader.py            # boto3 upload + presigned URL
└── app.py
```
