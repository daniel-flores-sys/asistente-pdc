# ms-orchestrator

**Rol:** BFF (Backend for Frontend) y orquestador del flujo completo de generación de PDC.
Es el único servicio que habla directamente con el frontend. Coordina ms-ai-generator,
ms-doc-processor y ms-ingestion. Gestiona autenticación JWT, créditos e historial.

---

## Stack

| Item | Valor |
|---|---|
| Framework | NestJS + TypeScript |
| Puerto | 3001 |
| BD | PostgreSQL 16 |
| Auth | JWT HS256, 8h |

---

## Variables de entorno

```env
PORT=3001
NODE_ENV=development
AI_GENERATOR_URL=http://ms-ai-generator:8000
DOC_PROCESSOR_URL=http://ms-doc-processor:8001
DOC_PROCESSOR_PUBLIC_URL=http://localhost:8001
INGESTION_URL=http://ms-ingestion:8003
MONITOR_URL=http://ms-monitor:8002
DB_HOST=postgres
DB_PORT=5432
DB_NAME=genplan_db
DB_USER=genplan_user
DB_PASSWORD=genplan_pass
JWT_SECRET=                  # mínimo 32 caracteres aleatorios
JWT_EXPIRES_IN=8h
ALLOWED_ORIGINS=http://localhost:3000
```

---

## Endpoints

### Públicos (sin autenticación)

```
GET /api/health
  Response: { status: "ok", service: "ms-orchestrator" }

POST /api/auth/login
  Body:     { email: string, password: string }
  Response: { access_token: string, user: { id, nombre, email, creditos } }

POST /api/auth/register
  Body:     { nombre: string, email: string, password: string, ci: string, titulo?: string }
  Response: { id, nombre, email, creditos: 0 }

GET /api/reference-data
  Response: {
    niveles: [{ id, nombre }],
    anios_escolaridad: [{ id, nivel_id, numero, literal }],
    areas_curriculares: [{ id, nivel_id, nombre, codigo }],
    trimestres: [{ id, gestion_id, numero, fecha_inicio, fecha_fin }],
    temas_mes: [{ id, area_id, anio_id, trimestre_num, semana_num, titulo, descripcion }]
  }
```

### Docente (requiere Bearer JWT)

```
GET /api/auth/me
  Response: { id, nombre, email, creditos, activo }

POST /api/generate
  Body: {
    nombre_docente:      string,
    ci_docente:          string,
    titulo_docente?:     string,
    unidad_educativa:    string,
    distrito:            string,
    nombre_director?:    string,
    anio_escolaridad_id: number,
    trimestre_id:        number,
    areas_seleccionadas: number[],
    temas_seleccionados: { [area_id: string]: number[] },
    materiales?:         string,
    contexto_social?:    string
  }
  Response: {
    plan_id:            number,
    download_url:       string,
    filename:           string,
    creditos_restantes: number
  }
  Errors:
    401 - Token inválido o expirado
    402 - Sin créditos disponibles
    400 - Datos de entrada inválidos

GET /api/historial
  Response: [{
    plan_id:          number,
    fecha:            string,
    unidad_educativa: string,
    trimestre:        number,
    filename:         string,
    download_url:     string
  }]
```

### Admin (requiere Bearer JWT con rol admin)

```
# Docentes
GET  /api/admin/usuarios
POST /api/admin/usuarios
  Body: { nombre, email, password, ci, titulo?, creditos? }
PUT  /api/admin/usuarios/:id/creditos
  Body: { creditos: number }
PUT  /api/admin/usuarios/:id/activo
  Body: { activo: boolean }

# Datos de referencia
GET/POST /api/admin/referencia/niveles
GET/POST /api/admin/referencia/anios
GET/POST /api/admin/referencia/areas
GET/POST/DELETE /api/admin/referencia/temas
GET/POST/PUT /api/admin/referencia/objetivos

# Configuración del sistema
GET /api/admin/config
PUT /api/admin/config/:clave
  Claves: 'llm_params' | 'rag_params' | 'ingest_params' | 'prompts'

# Documentos RAG
GET    /api/admin/documentos
POST   /api/admin/documentos   (multipart: file PDF|DOCX|TXT)
DELETE /api/admin/documentos/:id

# Monitor — proxy hacia ms-monitor
GET  /api/admin/monitor/services
GET  /api/admin/monitor/metrics
POST /api/admin/monitor/scale    Body: { service_name, replicas }
GET  /api/admin/monitor/alerts
GET  /api/admin/monitor/config
PUT  /api/admin/monitor/config
```

---

## Estructura de carpetas

```
src/
├── domain/
│   └── interfaces/
│       ├── planificacion.interface.ts
│       └── usuario.interface.ts
├── application/
│   └── controllers/
│       ├── auth.controller.ts
│       ├── planificacion.controller.ts
│       ├── historial.controller.ts
│       └── admin/
│           ├── admin-usuarios.controller.ts
│           ├── admin-referencia.controller.ts
│           ├── admin-config.controller.ts
│           ├── admin-documentos.controller.ts
│           └── admin-monitor.controller.ts
├── infrastructure/
│   ├── db.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   └── services/
│       ├── ai-generator.service.ts
│       ├── doc-processor.service.ts
│       ├── ingestion.service.ts
│       ├── monitor.service.ts
│       ├── reference-data.service.ts
│       └── usuario.service.ts
├── app.module.ts
└── main.ts
```

---

## Flujo interno de POST /api/generate

1. `JwtAuthGuard` verifica el token JWT
2. `UsuarioService.verificarCreditos(usuario_id)` — lanza 402 si creditos = 0
3. Resolución de datos desde PG: objetivo_holistico, temas por área/trimestre seleccionados
3. `AiGeneratorService` resuelve desde PostgreSQL los IDs recibidos del frontend: areas completas, temas seleccionados y objetivo_holistico del anio/trimestre
4. `AiGeneratorService` arma el contrato interno de `ms-ai-generator` y llama `POST /generate` con `{ areas, temas, objetivo_holistico, datos_docente }`
6. `UsuarioService.descontarCredito(usuario_id)` — UPDATE creditos = creditos - 1
7. Retorna `{ plan_id, download_url, filename, creditos_restantes }`
