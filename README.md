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

## Despliegue rápido

```bash
# En Server 1 — primer despliegue
docker swarm init --advertise-addr 192.168.100.245
docker volume create postgres_data
docker volume create chroma_data
docker login -u <DOCKERHUB_USER>
docker stack deploy -c docker-compose.yml pdc --with-registry-auth
docker service ls
```

Ver guía completa: [docs/LEVANTAR-REMOTO.md](docs/LEVANTAR-REMOTO.md)

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
    ├── PROYECTO.md
    ├── INFORME-2DO-PARCIAL.md
    └── LEVANTAR-REMOTO.md
```

---

## Variables de entorno

Cada servicio tiene un `.env.example`. Los `.env` reales están en `.gitignore` y nunca se suben al repositorio. En producción, los secrets se inyectan vía GitHub Secrets.

```bash
# Credenciales requeridas (nunca en el código)
JWT_SECRET=<32 chars aleatorios>
DB_PASSWORD=<password seguro>
AWS_ACCESS_KEY_ID=<IAM user S3>
AWS_SECRET_ACCESS_KEY=<IAM secret>
ADMIN_EMAIL=admin@pdc.edu.bo
ADMIN_PASSWORD=<password admin>
DOCKERHUB_TOKEN=<token CI/CD>
```

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
