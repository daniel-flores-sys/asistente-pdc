# Sistema PDC Bolivia — Generación Automatizada de Planificaciones Curriculares

**Universidad San Francisco Xavier de Chuquisaca — COM610 Trabajando en la Nube**  
**Estudiante:** Erik Daniel Flores Medina  

---

## ¿Qué hace este sistema?

Los docentes bolivianos completan un formulario en 4 pasos (datos personales → asignación → áreas curriculares → contexto) y descargan un documento Word (.docx) con formato oficial listo para entregar, generado por IA y almacenado en AWS S3.

Un **panel de administración** permite gestionar docentes, cargar documentos pedagógicos para RAG, configurar el modelo de IA y monitorear el estado del sistema con auto-scaling.

---

## Arquitectura

```
Internet
  └─▶ Bastión nginx (201.131.45.42)
        └─▶ Server 1 nginx (192.168.100.245) — Docker Swarm Manager
              │
              ├─▶ ms-frontend      :3000  (React + Vite + Tailwind)
              │     └─▶ ms-orchestrator  :3001  (NestJS — BFF + auth + créditos)
              │           ├─▶ ms-ai-generator   :8000  (FastAPI + Ollama)
              │           │     └─▶ [RAG] ChromaDB  :8004
              │           │     └─▶ [LLM] Server 2 Ollama :11434
              │           ├─▶ ms-doc-processor  :8001  (FastAPI + python-docx)
              │           ├─▶ ms-ingestion      :8003  (FastAPI + ChromaDB)
              │           └─▶ ms-monitor        :8002  (FastAPI + Docker SDK)
              │
              ├─▶ PostgreSQL :5432  (datos de dominio, usuarios, configuración)
              └─▶ ChromaDB   :8004  (vectores RAG de documentos pedagógicos)

Server 2 (192.168.100.246, 24 GB RAM)
  └─▶ Ollama + gemma3:4b  :11434  (OLLAMA_KEEP_ALIVE=-1 → siempre en RAM)

AWS S3 us-east-1
  └─▶ bucket: pdc-documentos-floresmedina  (archivos .docx generados)
```

---

## Microservicios

| Servicio | Tecnología | Puerto |
|---|---|---|
| ms-frontend | React 18 + Vite + Tailwind CSS | 3000 |
| ms-orchestrator | NestJS + TypeScript | 3001 |
| ms-ai-generator | FastAPI + Python 3.11 + Ollama | 8000 |
| ms-doc-processor | FastAPI + python-docx + boto3 | 8001 |
| ms-monitor | FastAPI + Python + Docker SDK | 8002 |
| ms-ingestion | FastAPI + Python + ChromaDB | 8003 |

Orquestación: **Docker Swarm** · LLM: **Ollama gemma3:4b** · Storage: **AWS S3** · Vector DB: **ChromaDB**

---

## Flujo principal

```
1. Docente abre la app → carga datos de referencia (áreas, trimestres, temas)
2. Completa wizard de 4 pasos → envía formulario con 1 crédito
3. ms-orchestrator coordina:
   a. ms-ai-generator: RAG en ChromaDB + LLM genera JSON del PDC
   b. ms-doc-processor: convierte JSON → .docx → sube a S3
4. Docente descarga el archivo Word
```

---

## Sistema de créditos

- 1 crédito = 1 PDC generado
- El admin asigna créditos manualmente desde el panel
- Los docentes se registran solos (creditos = 0 por defecto)
- Sin créditos: el sistema retorna error 402 antes de llamar a la IA

---

## Panel de administración

Accesible en `/admin` con credenciales de administrador:

| Sección | Función |
|---|---|
| Documentos | Subir PDFs/DOCXs pedagógicos → ChromaDB para RAG |
| Datos de referencia | CRUD de niveles, áreas, temas, objetivos holísticos |
| Configuración | Ajustar parámetros del LLM (temperatura, tokens) y prompts |
| Docentes | Ver cuentas, asignar créditos, activar/desactivar |
| Monitor | Estado del Swarm, métricas, escalar servicios, auto-scaling |

---

## Guía de Despliegue Local — Paso a Paso

Esta guía permite replicar el sistema completo en una máquina local con Docker Desktop.  
Sin Ollama configurado el sistema usa **modo mock** (genera un PDC de ejemplo).  
Sin AWS S3 configurado el `.docx` se **descarga directamente** desde el servidor.  
Ambas limitaciones son aceptables para ver el sistema funcionando.

### Paso 1 — Requisitos previos

Instalar las siguientes herramientas antes de continuar:

| Herramienta | Versión mínima | Descarga |
|---|---|---|
| Git | cualquiera | https://git-scm.com |
| Docker Desktop | 4.x (incluye Docker Engine 26+) | https://www.docker.com/products/docker-desktop |

> Docker Desktop debe estar corriendo antes de ejecutar cualquier comando.  
> No se necesita instalar Node.js, Python ni ninguna otra dependencia — todo corre dentro de contenedores.

---

### Paso 2 — Clonar el repositorio

```bash
git clone https://github.com/daniel-flores-sys/asistente-pdc.git
cd asistente-pdc
```

---

### Paso 3 — Crear el archivo de variables de entorno

Crear un archivo llamado `.env` en la **raíz del repositorio** (junto a `docker-compose.yml`).  
Copiar el contenido de abajo y completar los valores marcados:

```env
# ── Base de datos ─────────────────────────────────────────────────────────────
# Usar el mismo valor en POSTGRES_PASSWORD y DB_PASSWORD
POSTGRES_PASSWORD=CambiarEstePassword123
DB_PASSWORD=CambiarEstePassword123

# ── Autenticación JWT ─────────────────────────────────────────────────────────
# Generar con: openssl rand -base64 32
# En PowerShell: [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
JWT_SECRET=reemplazar_con_cadena_aleatoria_de_32_caracteres_minimo

# ── Cuenta de administrador (se crea sola al arrancar) ───────────────────────
ADMIN_EMAIL=admin@pdc.edu.bo
ADMIN_PASSWORD=AdminPass123

# ── Ollama — LLM para generación de PDC ──────────────────────────────────────
# Dejar vacío para usar modo mock (genera PDC de ejemplo sin IA real)
# Con Ollama local: http://host.docker.internal:11434
# Con servidor remoto: http://IP_DEL_SERVIDOR:11434
OLLAMA_URL=

# ── AWS S3 — almacenamiento de documentos .docx ───────────────────────────────
# Dejar vacío para descarga directa (sin S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=us-east-1
```

> Los archivos `.env` están en `.gitignore` — nunca se suben al repositorio.

---

### Paso 4 — Habilitar Docker Swarm

El sistema usa Docker Swarm para orquestación. Inicializarlo una sola vez:

```bash
docker swarm init
```

Verificar que quedó activo:

```bash
docker info | grep -i swarm
# Debe mostrar: Swarm: active
```

> Si ya estaba activo el comando no falla, solo avisa que el nodo ya es manager.

---

### Paso 5 — Construir las imágenes

Ejecutar desde la **raíz del repositorio**. Los 7 comandos construyen todas las imágenes localmente (primera vez tarda 5–15 minutos según la velocidad de internet):

```bash
docker build -t pdc/pdc-postgres:local    -f ms-doc-processor/infra/postgres/Dockerfile ms-doc-processor/infra/postgres/
docker build -t pdc/ms-frontend:local     ms-frontend/
docker build -t pdc/ms-orchestrator:local ms-orchestrator/
docker build -t pdc/ms-ai-generator:local ms-ai-generator/
docker build -t pdc/ms-doc-processor:local ms-doc-processor/
docker build -t pdc/ms-ingestion:local    ms-ingestion/
docker build -t pdc/ms-monitor:local      ms-monitor/
```

Verificar que se crearon todas:

```bash
docker images | grep pdc
```

Debe mostrar 7 imágenes con el tag `local`.

---

### Paso 6 — Exportar variables y desplegar el stack

Docker Swarm lee las variables del shell al hacer el deploy. Primero exportarlas, luego desplegar:

**En Git Bash o Linux/macOS:**
```bash
set -a && source .env && set +a
docker stack deploy --resolve-image never -c docker-compose.yml pdc
```

**En PowerShell (Windows):**
```powershell
Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
}
docker stack deploy --resolve-image never -c docker-compose.yml pdc
```

---

### Paso 7 — Verificar que todos los servicios estén corriendo

```bash
docker service ls
```

Esperar hasta que la columna `REPLICAS` muestre `1/1` en todos los servicios (puede tardar 30–60 segundos):

```
NAME                      MODE        REPLICAS   IMAGE
pdc_chromadb              global      1/1        chromadb/chroma:0.6.3
pdc_ms-ai-generator       replicated  1/1        pdc/ms-ai-generator:local
pdc_ms-doc-processor      replicated  1/1        pdc/ms-doc-processor:local
pdc_ms-frontend           replicated  1/1        pdc/ms-frontend:local
pdc_ms-ingestion          replicated  1/1        pdc/ms-ingestion:local
pdc_ms-monitor            replicated  1/1        pdc/ms-monitor:local
pdc_ms-orchestrator       replicated  1/1        pdc/ms-orchestrator:local
pdc_postgres              global      1/1        pdc/pdc-postgres:local
```

> `ms-monitor` puede aparecer en estado `Failed` en Docker Desktop (el GID 988 es específico del servidor de producción). Esto es normal y no afecta al resto del sistema.

Verificar los health checks de cada servicio:

```bash
curl http://localhost:3000           # Frontend (devuelve HTML)
curl http://localhost:3000/api/health # Orchestrator
```

---

### Paso 8 — Acceder a la aplicación

Abrir el navegador en:

```
http://localhost:3000
```

---

### Paso 9 — Primeros pasos dentro de la app

1. **Iniciar sesión como administrador**  
   Ir a `/admin` e ingresar con el email y contraseña del `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

2. **Registrar una cuenta de docente**  
   Ir a la página principal `/` y crear una cuenta de docente (o crearla desde el panel admin en *Docentes*).

3. **Asignar créditos al docente**  
   En el panel admin → sección *Docentes* → seleccionar el usuario → asignar créditos (mínimo 1).

4. **Generar un PDC**  
   Iniciar sesión como docente → completar el wizard de 4 pasos → descargar el `.docx` generado.

---

### Paso 10 — Comandos útiles de monitoreo

```bash
# Ver estado de todos los servicios
docker service ls

# Ver logs de un servicio específico (últimas 50 líneas)
docker service logs pdc_ms-orchestrator --tail 50 --no-trunc
docker service logs pdc_ms-ai-generator --tail 50 --no-trunc

# Escalar un servicio en vivo (demo de elasticidad)
docker service scale pdc_ms-ai-generator=3

# Ver todos los contenedores del stack
docker ps --filter name=pdc_

# Inspeccionar una tarea fallida
docker service ps pdc_ms-orchestrator --no-trunc
```

---

### Paso 11 — Detener y limpiar el sistema

```bash
# Remover el stack completo (los volúmenes de datos se conservan)
docker stack rm pdc

# Esperar que terminen los contenedores (~10 segundos)
docker service ls   # debe quedar vacío

# Borrar volúmenes si se quiere empezar desde cero (¡elimina todos los datos!)
docker volume rm pdc_postgres_data pdc_chroma_data

# Salir del modo Swarm
docker swarm leave --force
```

---

### Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Servicio en `0/1` o `Failed` | Error al arrancar | `docker service logs pdc_<nombre> --tail 30` |
| `No such image` al hacer deploy | Imagen no construida | Ejecutar los 7 comandos del Paso 5 |
| Error 500 al llamar a la API | Variables de entorno no cargadas | Re-exportar `.env` y volver a hacer deploy |
| Error 402 al generar PDC | Docente sin créditos | Asignar créditos desde el panel admin |
| `ms-monitor` en Failed | GID 988 no existe en Docker Desktop | Normal en local — no afecta al sistema |
| App en blanco en el navegador | Frontend aún arrancando | Esperar 30 segundos y recargar |
| `.docx` sin URL de descarga | S3 no configurado | El archivo se descarga igual por `/doc/<id>` |

---

## Despliegue en Producción (Servidores Linux)

Para desplegar en servidores reales con Docker Swarm, Ollama remoto y CI/CD automático:

→ [docs/LEVANTAR-REMOTO.md](docs/LEVANTAR-REMOTO.md)

El pipeline de CI/CD en `.github/workflows/deploy.yml` automatiza el proceso completo:  
build → push a DockerHub → rolling update en el servidor con aprobación manual.

---

## Estructura del repositorio

```
asistente-pdc/
├── ms-frontend/                  # React + Vite + Tailwind
├── ms-orchestrator/              # NestJS (BFF, auth, créditos)
├── ms-ai-generator/              # FastAPI (generación PDC con LLM)
├── ms-doc-processor/             # FastAPI (Word + S3)
│   └── infra/postgres/           # Imagen PostgreSQL + scripts de inicialización
├── ms-ingestion/                 # FastAPI (ingesta PDFs → ChromaDB)
├── ms-monitor/                   # FastAPI (monitoreo + auto-scaling Swarm)
├── docker-compose.yml            # Docker Swarm deployment
├── .github/workflows/deploy.yml  # CI/CD: build → DockerHub → rolling update
└── docs/
    ├── servers/                  # Configuración de cada servidor
    ├── processes/                # Flujo transversal, mantenimiento, seguridad
    ├── ms-docs/                  # Especificación técnica de cada microservicio
    └── LEVANTAR-REMOTO.md        # Guía de despliegue en servidores Linux
```

---

## Variables de entorno

Cada microservicio tiene su propio `.env.example` con la descripción de cada variable.  
Los `.env` reales están en `.gitignore` y nunca se suben al repositorio.  
En producción las credenciales se inyectan como GitHub Secrets.

| Variable | Requerida | Descripción |
|---|---|---|
| `POSTGRES_PASSWORD` | Sí | Password de PostgreSQL |
| `DB_PASSWORD` | Sí | Igual que `POSTGRES_PASSWORD` |
| `JWT_SECRET` | Sí | Clave para firmar tokens (mín. 32 chars) |
| `ADMIN_PASSWORD` | Sí | Password de la cuenta admin inicial |
| `ADMIN_EMAIL` | No | Email admin (default: admin@pdc.edu.bo) |
| `OLLAMA_URL` | No | URL de Ollama — vacío = modo mock |
| `AWS_ACCESS_KEY_ID` | No | IAM key para S3 — vacío = descarga directa |
| `AWS_SECRET_ACCESS_KEY` | No | IAM secret para S3 |
| `AWS_S3_BUCKET` | No | Nombre del bucket S3 |

---

## Documentación

| Documento | Descripción |
|---|---|
| [docs/servers/bastion.md](docs/servers/bastion.md) | Configuración del bastión nginx |
| [docs/servers/server-1.md](docs/servers/server-1.md) | Docker Swarm Manager |
| [docs/servers/server-2.md](docs/servers/server-2.md) | Ollama + configuración RAM |
| [docs/processes/flujo-transversal.md](docs/processes/flujo-transversal.md) | Flujo completo de datos |
| [docs/processes/seguridad.md](docs/processes/seguridad.md) | JWT, secrets, CORS, UFW |
| [docs/processes/escalamiento.md](docs/processes/escalamiento.md) | Auto-scaling y Swarm |
| [docs/processes/mantenimiento.md](docs/processes/mantenimiento.md) | Backups, updates, logs |
| [docs/ms-docs/](docs/ms-docs/) | Especificación técnica de cada microservicio |
