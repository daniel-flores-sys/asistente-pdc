# Informe de Avance — Segundo Parcial

**Universidad San Francisco Xavier de Chuquisaca**  
**Asignatura:** Trabajando en la Nube (COM610)  
**Docente:** Ing. Marcelo Quispe Ortega  
**Semestre:** 1/2026  
**Fecha de entrega:** 27 de mayo de 2026

---

**Repositorio GitHub:** https://github.com/daniel-flores-sys/asistente-pdc

**Estudiante:** Erik Daniel Flores Medina

---

## 1. Tabla de Infraestructura / Servicios

### 1.1 Servicios del stack PDC

| Componente | Rol | Tecnología | Puerto expuesto | Estado |
|---|---|---|---|---|
| **ms-frontend** | Interfaz web del docente (wizard 4 pasos) | React + Vite + Tailwind CSS | 3000 | 🟢 Operativo |
| **ms-orchestrator** | Coordinador del flujo completo | NestJS + TypeScript | 3001 | 🟢 Operativo |
| **ms-ai-generator** | Genera JSON del PDC (mock automático) | FastAPI + Python 3.11 | 8000 | 🟢 Operativo |
| **ms-doc-processor** | Genera documento Word + sube a S3 | FastAPI + python-docx + boto3 | 8001 | 🟢 Operativo |
| **postgres** | Base de datos relacional (14 tablas) | PostgreSQL 16 Alpine | 5432 | 🟢 Operativo |
| **chromadb** | Vector store para RAG futuro | ChromaDB latest | 8002 | 🟢 Operativo |
| **ms-ingestion** | Ingesta PDFs → ChromaDB | FastAPI + pdfplumber | 8003 | ⚫ Pendiente (escala 0) |

### 1.2 Infraestructura de despliegue

| Plataforma | Rol | Sistema Operativo | Observación |
|---|---|---|---|
| **Laptop local** | Swarm Manager (nodo único) | Windows 11 + Docker Desktop 4.x | Demo de 2do parcial |
| **Servidor 1** `192.168.100.245` *(inactivo)* | Swarm Manager, stack PDC | Ubuntu 22.04 LTS, 16 GB RAM, 8 vCPU | No disponible — ver bitácora entrada #5 |
| **Servidor 2** `192.168.100.246` *(inactivo)* | Inferencia Ollama (CPU-only) | Ubuntu 22.04 LTS, 24 GB RAM, 8 vCPU | Configurado y probado — ver bitácora entradas #3 y #4 |

### 1.3 Servicios cloud

| Servicio | Proveedor | Región | Estado |
|---|---|---|---|
| **Bucket S3** `tu-bucket-s3` | AWS | us-east-1 | 🟢 Operativo |
| **IAM User** `pdc-s3-uploader` | AWS | Global | 🟢 Operativo |
| **GitHub Actions** CI/CD | GitHub | — | 🟡 En configuración |

---

## 2. Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│  DOCKER SWARM — Nodo único (Windows 11 + Docker Desktop)            │
│  Red overlay: pdc-overlay (privada, solo servicios internos)        │
│                                                                     │
│  Docente (navegador)                                                │
│        │                                                            │
│        ▼                                                            │
│  ┌──────────────────────────────────────────────────┐               │
│  │  ms-frontend :3000   🟢 OPERATIVO               │               │
│  │  React + Vite + Tailwind                         │               │
│  │  Wizard 4 pasos: docente → asignación →          │               │
│  │  áreas/temas → materiales/contexto               │               │
│  └───────────────────┬──────────────────────────────┘               │
│                      │ GET /api/reference-data                      │
│                      │ POST /api/generate                           │
│                      ▼                                              │
│  ┌──────────────────────────────────────────────────┐               │
│  │  ms-orchestrator :3001   🟢 OPERATIVO            │               │
│  │  NestJS — 2 réplicas (Swarm)                     │               │
│  │  ├─ GET /api/reference-data → PostgreSQL          │               │
│  │  └─ POST /api/generate → ai-generator + doc-proc │               │
│  └──────┬───────────────────────────────────────────┘               │
│         │ POST /generate          │ POST /doc/{id}/upload           │
│         ▼                         ▼                                 │
│  ┌──────────────┐      ┌──────────────────────────────────┐         │
│  │ ms-ai-gen    │      │ ms-doc-processor :8001           │         │
│  │ :8000        │      │ 🟢 OPERATIVO                    │         │
│  │ 🟢 OPER.    │      │                                  │         │
│  │ 2 réplicas   │      │ 1. fetch_plan() — 14 tablas SQL │         │
│  │ Swarm        │      │ 2. build_document() — python-docx│         │
│  │              │ id   │ 3. upload_to_s3() — boto3        │         │
│  │ mock PDC     │─────▶│ 4. Retorna presigned URL (1 hora)│         │
│  │ automático   │      └──────────────────┬───────────────┘         │
│  └──────┬───────┘                         │                         │
│         │ SQL                             │ HTTPS upload            │
│         ▼                                 ▼                         │
│  ┌──────────────┐              ┌──────────────────────┐             │
│  │ PostgreSQL   │              │  AWS S3  us-east-1   │             │
│  │ :5432        │              │  🟢 OPERATIVO        │  (externo)  │
│  │ 🟢 OPER.    │              │  bucket:             │             │
│  │ genplan_db   │              │  tu-bucket-s3        │             │
│  │ 14 tablas    │              │  pdc/*.docx          │             │
│  └──────────────┘              └──────────────────────┘             │
│                                └──────────────────────┘             │
│                                                                     │
│  ┌────────────────────────────────────────────────────┐             │
│  │  chromadb :8002   🟢 OPERATIVO (uso futuro RAG)   │             │
│  └────────────────────────────────────────────────────┘             │
│                                                                     │
│  ┌────────────────────────────────────────────────────┐             │
│  │  ms-ingestion :8003   ⚫ PENDIENTE (escala=0)      │             │
│  │  Flujo separado — no requerido para generar PDC    │             │
│  └────────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘

GitHub Actions ──▶ DockerHub     🟡 EN CONFIGURACIÓN
(ci.yml listo, DOCKERHUB_TOKEN pendiente de configurar)

┌─────────────────────────────────────────────────────────────────────┐
│  Servidor 2 — 192.168.100.246  (USFX, no disponible para el demo)  │
│  Ollama + gemma4:e4b  🟡 EN CONFIGURACIÓN                          │
│  OLLAMA_HOST=0.0.0.0 y OLLAMA_MODELS configurados vía systemd.      │
│  Integración con ms-ai-generator pendiente (OLLAMA_URL apuntaría     │
│  a este servidor cuando esté accesible).                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Leyenda de estado

| Símbolo | Estado | Descripción |
|---|---|---|
| 🟢 **OPERATIVO** | Funcionando | Demostrable con curl / navegador en este momento |
| 🟡 **EN CONFIGURACIÓN** | Parcialmente listo | Estructura construida, falta configuración puntual |
| ⚫ **PENDIENTE** | No activo | Fuera del alcance de este parcial o flujo separado |

---

## 3. Bitácora de Avance

| # | Fecha | Actividad | Responsable | Dificultad superada |
|---|---|---|---|---|
| 1 | 2026-05-10 | Diseño del esquema PostgreSQL (14 tablas normalizadas) y arquitectura de microservicios con capas domain/application/infrastructure. | Erik D. Flores M. | Decidir la granularidad de microservicios sin sobrecomplicar. Solución: 4 servicios con responsabilidad única (SRP). |
| 2 | 2026-05-15 | ms-doc-processor: generación de documento Word con python-docx. Tabla de 6 columnas, celdas coloreadas, estilo Arial Narrow, datos reales de PostgreSQL (14 JOINs). | Erik D. Flores M. | `colspan` en python-docx no existe como parámetro. Solución: usar `merge()` sobre la grilla de celdas para combinarlas manualmente. |
| 3 | 2026-05-18 | **Servidor 2 — Ollama no accesible externamente.** `curl http://192.168.100.246:11434` desde Server 1 fallaba inmediatamente. Diagnóstico: `sudo ss -tulpn \| grep 11434` mostró que Ollama escuchaba en `127.0.0.1:11434` (solo localhost). Solución: crear `/etc/systemd/system/ollama.service.d/override.conf` manualmente (el asistente interactivo `systemctl edit` descartaba los cambios al guardar). El archivo inyecta `OLLAMA_HOST=0.0.0.0`. Tras `daemon-reload` + restart, `ss` mostró `0.0.0.0:11434`. | Erik D. Flores M. | `systemctl edit` abría un buffer temporal y los cambios fuera del bloque permitido eran silenciosamente descartados. La solución fue saltar el asistente y escribir el archivo override directamente con `tee`. |
| 4 | 2026-05-19 | **Servidor 2 — Disco lleno al descargar modelo Gemma.** `ollama pull gemma4:e4b` se interrumpía: la partición raíz (donde Ollama guarda modelos en `/usr/share/ollama/.ollama/models`) estaba al 100%. Diagnóstico: `df -h`. Solución: sin alterar particiones, se agregó al mismo `override.conf` la variable `OLLAMA_MODELS=/ruta/disco/ampliado/ollama/models` apuntando a un volumen con más espacio. El archivo final queda con dos variables en un solo lugar: `OLLAMA_HOST` y `OLLAMA_MODELS`. Gemma descargó correctamente tras el reinicio. | Erik D. Flores M. | Mover la ruta de modelos por variable de entorno es más seguro que redimensionar particiones LVM en producción porque no toca el sistema operativo. Riesgo de perder el SO si se falla un resize en producción. |
| 5 | 2026-05-20 | **Migración USFX → entorno local.** Los servidores de la Facultad de Tecnología dejaron de estar disponibles antes de completar la integración Ollama–ms-ai-generator y antes de configurar los secrets del CI/CD. Todo el stack se migró a Windows 11 + Docker Desktop como Swarm de un nodo. | Erik D. Flores M. | `docker stack deploy` no soporta bind mounts con rutas relativas (requiere volúmenes nombrados o imágenes con el contenido embebido). Solución: imagen `pdc-postgres:local` con un Dockerfile que copia los scripts SQL en el momento del build. |
| 6 | 2026-05-23 | Integración AWS S3: `s3_uploader.py` con boto3 + endpoint `POST /doc/{id}/upload`. Credenciales inyectadas en Swarm con `docker service update --env-add`. | Erik D. Flores M. | Dos errores encadenados: (1) IAM `AccessDenied` — usuario `pdc-s3-uploader` existía pero sin política adjunta. (2) `NoSuchBucket` — espacio en blanco al final del nombre del bucket en `.env`. Ambos resueltos. |
| 7 | 2026-05-27 | CI/CD GitHub Actions: `ci.yml` construido y listo en el repositorio. **No resuelto:** secrets `DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN` no fueron configurados antes de la caída del servidor. El pipeline aún no ha corrido. Queda pendiente para el tercer parcial. | Erik D. Flores M. | Sin secrets válidos en GitHub el paso de push a DockerHub falla con 401. La estructura del workflow es correcta; solo falta la credencial. |

---

## 4. Comandos Principales

### Hito 1 — Verificar infraestructura levantada

```powershell
# Estado del Swarm y todos los servicios
docker service ls

# Contenedores activos con puertos
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Ping interno entre servicios (dentro de la red overlay)
docker run --rm --network pdc-overlay alpine ping -c 3 ms-orchestrator
```

### Hito 2 — Demostración de temas avanzados

**Tema 1: Docker Swarm — orquestación, elasticidad y tolerancia a fallos**

```powershell
# Ver réplicas activas
docker service ls

# Escalar ms-ai-generator a 3 réplicas (demo elasticidad)
docker service scale pdc_ms-ai-generator=3
docker service ls   # ver 3/3

# Matar un contenedor (demo tolerancia a fallos)
docker ps --filter name=pdc_ms-ai-generator -q
# Copiar un ID y eliminar:
docker rm -f <container_id>
docker service ps pdc_ms-ai-generator   # Swarm lo reemplaza automáticamente
```

**Tema 2: AWS S3 — almacenamiento cloud con URL pre-firmada**

```powershell
# Flujo completo: genera PDC y sube a S3
curl -s -X POST http://localhost:3001/api/generate `
  -H "Content-Type: application/json" `
  -d '{
    "nombre": "Docente Demo", "ci": "12345678", "titulo": "Lic.",
    "unidad_educativa_id": 1, "anio_escolaridad_id": 6, "trimestre_id": 1,
    "areas_seleccionadas": [2, 8],
    "temas_seleccionados": {"2": [], "8": []},
    "materiales": "Texto de aprendizaje, cuaderno",
    "contexto_social": "Comunidad rural del municipio"
  }'
# Respuesta: { "plan_id": N, "download_url": "https://tu-bucket-s3.s3.amazonaws.com/pdc/PDC_...", "filename": "PDC_UEDemo_T1_P1.docx" }

# Verificar datos de referencia (áreas, temas, unidades, trimestres)
curl http://localhost:3001/api/reference-data
```

### Hito 3 — Seguridad y buenas prácticas

```powershell
# 1. .env ignorado por Git
cat .gitignore | Select-String ".env"

# 2. Sin contraseñas en el código fuente (debe retornar vacío)
grep -r "password" ms-ai-generator/src/ ms-orchestrator/src/ ms-doc-processor/src/
grep -r "AWS_SECRET" ms-ai-generator/src/ ms-orchestrator/src/ ms-doc-processor/src/

# 3. Contenedores de producción corren con usuario no-root
# (appuser en ms-ai-generator y ms-doc-processor, node en ms-orchestrator)
docker exec $(docker ps --filter name=pdc_ms-ai-generator -q | Select-Object -First 1) whoami
# → appuser

# 4. Red overlay: servicios solo accesibles dentro de Docker
docker network ls --filter name=pdc-overlay
docker network inspect pdc-overlay
```

```bash
# En consola AWS — mostrar política IAM del usuario pdc-s3-uploader:
# IAM > Users > pdc-s3-uploader > Permissions
# La política solo permite s3:* en el bucket "tu-bucket-s3"
# No tiene acceso a EC2, RDS ni ningún otro servicio AWS
```

### Servidor 2 — Configuración Ollama (referencia, no demo en vivo)

```bash
# Diagnóstico: verificar que Ollama escucha solo en localhost
sudo ss -tulpn | grep 11434
# → 127.0.0.1:11434  (problema: no accesible externamente)

# Solución: crear override de systemd manualmente (sin editor interactivo)
sudo mkdir -p /etc/systemd/system/ollama.service.d/
sudo tee /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_MODELS=/mnt/disco-grande/ollama/models"
EOF

# Aplicar cambios y reiniciar
sudo systemctl daemon-reload
sudo systemctl restart ollama

# Verificar: ahora escucha en todas las interfaces
sudo ss -tulpn | grep 11434
# → 0.0.0.0:11434  (correcto)

# Probar desde Server 1 (192.168.100.245)
curl http://192.168.100.246:11434/api/tags
# → { "models": [{ "name": "gemma4:e4b", ... }] }
```

> **Por qué systemctl edit fallaba:** el asistente interactivo abre un buffer temporal con comentarios de protección. Las líneas escritas fuera del bloque `[Service]` válido son descartadas silenciosamente al cerrar. La solución directa con `tee` evita el editor completamente.

### Comandos de referencia Docker Swarm

```powershell
# Deploy inicial (desde cero)
docker swarm init
docker stack deploy --resolve-image never -c docker-compose.yml pdc
docker service scale pdc_ms-ingestion=0

# Rolling update de un servicio sin downtime
docker service update --image pdc/ms-orchestrator:local pdc_ms-orchestrator

# Inyectar variable de entorno en caliente
docker service update --env-add AWS_ACCESS_KEY_ID=<clave> pdc_ms-doc-processor

# Remover stack
docker stack rm pdc
```

---

## 5. Evidencias de los Servicios Funcionando

### 5.1 — Todos los servicios Up en Docker Swarm

```
[CAPTURA: swarm-services.png]
Comando: docker service ls
Resultado esperado:
ID             NAME                      REPLICAS   IMAGE
...            pdc_ms-frontend           1/1        pdc/ms-frontend:local
...            pdc_ms-orchestrator       2/2        pdc/ms-orchestrator:local
...            pdc_ms-ai-generator       2/2        pdc/ms-ai-generator:local
...            pdc_ms-doc-processor      1/1        pdc/ms-doc-processor:local
...            pdc_postgres              1/1        pdc-postgres:local
...            pdc_chromadb              1/1        chromadb/chroma:latest
...            pdc_ms-ingestion          0/0        pdc/ms-ingestion:local (detenido)
```

### 5.2 — ms-frontend: formulario de 4 pasos

```
[CAPTURA: frontend-wizard.png]
URL: http://localhost:3000
Mostrar: Paso 3 con checkboxes de áreas curriculares y temas del mes
```

### 5.3 — Flujo completo: generación de PDC con URL S3

```
[CAPTURA: generate-s3-url.png]
Comando: curl -s -X POST http://localhost:3001/api/generate -H "Content-Type: application/json" -d '{...}'
Resultado esperado:
{
  "plan_id": N,
  "asignacion_maestro_id": N,
  "download_url": "https://tu-bucket-s3.s3.amazonaws.com/pdc/PDC_UEDemo_T1_P1.docx?AWSAccessKeyId=...&Expires=...&Signature=...",
  "filename": "PDC_UEDemo_T1_P1.docx"
}
```

### 5.4 — Bucket S3 con el archivo subido

```
[CAPTURA: s3-bucket.png]
Consola AWS > S3 > tu-bucket-s3 > carpeta pdc/
Mostrar: PDC_UEDemo_T1_P1.docx con fecha de carga y tamaño
```

### 5.5 — Documento Word generado correctamente

```
[CAPTURA: docx-open.png]
Abrir PDC_UEDemo_T1_P1.docx en Microsoft Word o LibreOffice
Mostrar: encabezado PDC, tablas por área curricular, semanas con
práctica, teoría, valoración y producción correctamente formateadas
```

### 5.6 — Elasticidad: escalar servicio en vivo

```
[CAPTURA: scale-demo.png]
Comandos:
  docker service scale pdc_ms-ai-generator=3
  docker service ls
Mostrar: ms-ai-generator 3/3 réplicas activas
```

### 5.7 — Tolerancia a fallos: contenedor reemplazado automáticamente

```
[CAPTURA: fault-tolerance.png]
Comandos:
  docker rm -f <container_id>
  docker service ps pdc_ms-ai-generator
Mostrar: una tarea Shutdown y una nueva Started/Running
```

### 5.8 — Seguridad: .env ignorado por Git

```
[CAPTURA: gitignore.png]
Comando: cat .gitignore | grep ".env"
Resultado: .env
Comando: grep -r "password" ms-ai-generator/src/  →  sin resultados
```

### 5.9 — IAM User con permisos restrictivos

```
[CAPTURA: iam-policy.png]
Consola AWS > IAM > Users > pdc-s3-uploader > Permissions
Mostrar: política inline con s3:* solo para el bucket tu-bucket-s3
No tiene acceso a EC2, RDS ni otros servicios
```

### 5.10 — PostgreSQL: datos persistidos

```
[CAPTURA: postgres-data.png]
Comando:
  docker exec -it $(docker ps --filter name=pdc_postgres -q) psql -U genplan_user -d genplan_db -c "SELECT id, numero_plan FROM plan_curricular ORDER BY id DESC LIMIT 5;"
Mostrar: filas con los planes generados durante la demo
```

---

## 6. Estructura del Repositorio

```
asistente-pdc/
├── ms-frontend/               # React + Vite + Tailwind — wizard 4 pasos
│   ├── src/
│   │   ├── App.tsx            # Estado del wizard, 4 pasos + pantalla resultado
│   │   └── api.ts             # getReferenceData() y generatePDC() con tipos TS
│   └── Dockerfile
│
├── ms-orchestrator/           # NestJS TypeScript — coordinador :3001
│   ├── src/
│   │   ├── infrastructure/
│   │   │   ├── db.ts                       # Pool pg (PostgreSQL directo)
│   │   │   └── services/
│   │   │       ├── ai-generator.service.ts # Llama a ai-gen y doc-proc
│   │   │       └── reference-data.service.ts  # Datos para dropdowns
│   │   └── application/controllers/
│   │       └── planificacion.controller.ts # GET /api/reference-data, POST /api/generate
│   └── package.json
│
├── ms-ai-generator/           # FastAPI Python — generador PDC :8000
│   ├── src/
│   │   ├── domain/schemas/planificacion.py  # Pydantic: GenerateRequest
│   │   ├── infrastructure/
│   │   │   ├── mock_data.py                 # build_mock_pdc() → formato correcto
│   │   │   └── plan_repository.py           # upserts + save_plan() en PostgreSQL
│   │   └── application/routes/generate.py   # POST /generate
│   └── requirements.txt
│
├── ms-doc-processor/          # FastAPI Python — generador Word + S3 :8001
│   ├── main.py                # CLI original (14 JOINs SQL, python-docx)
│   ├── src/
│   │   ├── app.py             # Wrapper FastAPI: GET /doc/{id}, POST /doc/{id}/upload
│   │   └── s3_uploader.py     # boto3: upload + presigned URL (1 hora)
│   └── infra/postgres/init/   # Esquema SQL + seeds (14 tablas + tema_mes)
│
├── ms-ingestion/              # FastAPI Python — ingesta PDF → ChromaDB :8003
│                              # (flujo separado, escala=0 en demo)
│
└── docker-compose.yml             # Docker Swarm deployment
├── .github/workflows/ci.yml       # Build + push a DockerHub en push a main
└── docs/
    ├── INFORME-2DO-PARCIAL.md ← este archivo
    └── LEVANTAR-REMOTO.md
```

---

## 7. Decisiones de Diseño

**Por qué el formato JSONB fue el cambio más crítico**  
`main.py` espera `{ "areas": [...] }` con campos específicos por semana. El mock original devolvía `datos_generales` / `contenidos` — completamente incompatible. Sin corregir esto, ningún documento Word se habría generado. El error era silencioso: el código no fallaba, simplemente producía un `.docx` vacío.

**Por qué `pg` (raw) en vez de TypeORM en el orchestrator**  
TypeORM requiere entidades, decoradores y migraciones. Para 5 queries de lectura y algunos upserts en un demo, un `Pool` de `pg` es más directo, más transparente y eliminó una capa de abstracción sin valor. Se puede migrar a TypeORM cuando el proyecto crezca.

**Por qué S3 tiene fallback automático**  
Si `AWS_ACCESS_KEY_ID` está vacío, `s3_uploader.py` retorna `None` y el endpoint devuelve la URL de descarga directa (`/doc/{plan_id}`). El sistema nunca falla por falta de credenciales S3 — esto hace el desarrollo local más ágil.

**Por qué Docker Swarm en vez de Kubernetes**  
Swarm está integrado en Docker Engine sin infraestructura adicional. Para demostrar elasticidad y tolerancia a fallos con recursos de laptop, Swarm es la herramienta correcta. Kubernetes requeriría un clúster dedicado (minikube/kind) con overhead significativo.

**Por qué `--resolve-image never` en el deploy local**  
`docker stack deploy` intenta hacer pull de las imágenes por defecto. Al construir localmente con tags `pdc/*:local`, el flag evita que Swarm intente conectarse a DockerHub y falle porque esas imágenes no están publicadas ahí.

---

## 8. Próximos Pasos — Tercer Parcial

- **CI/CD GitHub Actions**: configurar secrets `DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN` en el repositorio GitHub → el pipeline construye y publica automáticamente con cada push a `main`
- **Integración Ollama + Gemma**: cuando esté disponible un servidor con suficiente RAM, reemplazar `build_mock_pdc()` por llamada HTTP a Ollama con prompt estructurado
- **Pipeline RAG**: usar chunks de ChromaDB (ya operativo) como contexto en el prompt del LLM
- **Deploy en producción**: usar `docker-compose.yml` en servidor Ubuntu con las imágenes de DockerHub
