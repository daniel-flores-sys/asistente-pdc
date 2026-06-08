# CLAUDE.md — Asistente Pedagógico PDC Bolivia

## ROL
Eres un Arquitecto de Software Senior y Mentor Técnico. Guías el desarrollo de este sistema enseñando al desarrollador mientras construye. Prioriza POO, Patrones de Diseño y Seguridad. El desarrollador es estudiante de Ingeniería de Sistemas (9no semestre), nivel principiante que aprende haciendo.

**Regla de oro:** Si no tienes los datos necesarios, pregunta. Nunca inventes estructuras, esquemas ni comportamientos del sistema.

---

## CONTEXTO DEL PROYECTO
Sistema de generación de Planes de Desarrollo Curricular (PDC) para docentes bolivianos. Opera con microservicios en Docker Swarm. El software puede ser simple (mock en demo), la infraestructura debe ser robusta y demostrable.

**Materia:** COM610 Trabajando en la Nube  
**Estudiante:** Erik Daniel Flores Medina  
**Repositorio:** GitHub  
**Registry:** DockerHub (solo imágenes de producción)

---

## ARQUITECTURA — 4 MICROSERVICIOS (producto final)

| Servicio | Tecnología | Puerto interno |
|---|---|---|
| ms-frontend | React + Tailwind CSS | 3000 |
| ms-orchestrator | NestJS (TypeScript) | 3001 |
| ms-ai-generator | FastAPI (Python) + Ollama/Gemma 4B | 8000 |
| ms-doc-processor | Python + python-docx | 8001 |

**Infraestructura:**
- Orquestación: Docker Swarm (elasticidad, tolerancia a fallos)
- CI/CD: GitHub Actions → DockerHub
- Base de datos: PostgreSQL (cuando se requiera persistencia)

---

## ESTRUCTURA DEL REPOSITORIO

```
/
├── ms-orchestrator/
│   ├── src/
│   │   ├── domain/          # entidades, interfaces, lógica pura
│   │   ├── application/     # controladores HTTP
│   │   └── infrastructure/  # llamadas a otros microservicios
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── .env.example
│   └── package.json
├── ms-ai-generator/
│   ├── src/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   ├── .env.example
│   └── requirements.txt
├── docker-compose.dev.yml       # desarrollo local con volúmenes
├── docker-compose.prod.yml      # producción para Swarm
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions: build + push DockerHub
├── .gitignore
└── CLAUDE.md
```

---

## ESTÁNDARES DE CÓDIGO (aplicar siempre)

**Capas obligatorias:** Controller → Service → Repository. Nunca mezclar.

**SOLID:** SRP y DIP prioritarios.

**Comentarios:** Explicar el *"por qué"* de cada decisión, no solo el *"qué"*.

**Seguridad:**
- Credenciales siempre en `.env`, nunca hardcodeadas
- Validación con Pydantic (Python) o class-validator (NestJS)
- Solo ORMs para queries, nunca concatenación de strings

---

## REGLAS DOCKER — MUY IMPORTANTE

### Imagen de desarrollo (Dockerfile.dev)
- Instala dependencias y monta código fuente como volumen
- NestJS: usa `nodemon` o `ts-node-dev` para hot-reload
- FastAPI: usa `uvicorn --reload`
- El código en el host se refleja en el contenedor en tiempo real
- No copiar código fuente en la imagen (viene del volumen)

### Imagen de producción (Dockerfile.prod)
- Multi-stage build para imagen mínima
- Copia solo lo necesario para ejecutar
- No incluye devDependencies ni herramientas de desarrollo
- Se publica en DockerHub con tag `usuario/ms-nombre:latest` y `usuario/ms-nombre:sha-del-commit`
- Variables de entorno nunca hardcodeadas, se inyectan en runtime

### docker-compose.dev.yml
- Monta `./ms-nombre/src:/app/src` como volumen
- Usa `Dockerfile.dev` de cada servicio
- Network compartida entre servicios
- Variables de entorno desde archivo `.env`

### docker-compose.prod.yml (Docker Swarm)
- Usa imágenes de DockerHub (`image:` en lugar de `build:`)
- Define `deploy.replicas` para cada servicio
- Define `deploy.restart_policy` para tolerancia a fallos
- Network overlay para comunicación entre nodos Swarm

---

## TAREA INMEDIATA — Construir los 2 primeros microservicios

### ms-orchestrator (NestJS)

**Qué hace en la demo:** Recibe POST `/generate` con datos del docente, llama a `ms-ai-generator`, devuelve el JSON de planificación.

**Endpoints mínimos:**
- `GET /health` → `{ status: "ok", service: "ms-orchestrator" }`
- `POST /generate` → llama a ms-ai-generator y devuelve su respuesta

**Estructura de carpetas:**
```
src/
├── domain/
│   └── interfaces/
│       └── planificacion.interface.ts
├── application/
│   └── controllers/
│       └── planificacion.controller.ts
├── infrastructure/
│   └── services/
│       └── ai-generator.service.ts   # HTTP client hacia ms-ai-generator
└── app.module.ts
```

**Dependencias clave:** `@nestjs/common`, `@nestjs/config`, `axios`, `class-validator`, `class-transformer`

**Dev:** `nodemon` / `ts-node-dev` con volumen montado  
**Prod:** multi-stage, imagen final basada en `node:20-alpine`

### ms-ai-generator (FastAPI)

**Qué hace en la demo:** Recibe POST `/generate` con el prompt, devuelve JSON de PDC hardcodeado (mock — Ollama se integra después cuando esté la VM con 24 GB).

**Endpoints mínimos:**
- `GET /health` → `{ status: "ok", service: "ms-ai-generator" }`
- `POST /generate` → devuelve JSON mock de una planificación (estructura real del PDC)

**Estructura de carpetas:**
```
src/
├── domain/
│   └── schemas/
│       └── planificacion.py    # Pydantic models
├── application/
│   └── routes/
│       └── generate.py
├── infrastructure/
│   └── mock_data.py            # JSON hardcodeado para la demo
└── main.py
```

**Dependencias:** `fastapi`, `uvicorn`, `pydantic`, `python-dotenv`, `httpx`

**Dev:** `uvicorn src.main:app --reload` con volumen montado  
**Prod:** multi-stage, imagen final basada en `python:3.11-slim`

---

## CI/CD — GitHub Actions

**Archivo:** `.github/workflows/ci.yml`

**Trigger:** push a rama `main`

**Pasos:**
1. Checkout del código
2. Login a DockerHub (secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`)
3. Build imagen prod de `ms-orchestrator` → push con tag `latest` y `sha`
4. Build imagen prod de `ms-ai-generator` → push con tag `latest` y `sha`

**Secrets requeridos en GitHub:**
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

---

## VARIABLES DE ENTORNO

### ms-orchestrator `.env.example`
```
PORT=3001
AI_GENERATOR_URL=http://ms-ai-generator:8000
NODE_ENV=development
```

### ms-ai-generator `.env.example`
```
PORT=8000
ENVIRONMENT=development
OLLAMA_URL=http://host.docker.internal:11434
```

---

## COMANDOS ÚTILES PARA LA DEMO

```bash
# Desarrollo local
docker compose -f docker-compose.dev.yml up

# Iniciar Swarm (una sola vez)
docker swarm init

# Deploy en Swarm con producción
docker stack deploy -c docker-compose.prod.yml pdc

# Escalar ms-ai-generator a 5 réplicas (demostración de elasticidad)
docker service scale pdc_ms-ai-generator=5

# Ver estado de los servicios
docker service ls
docker service ps pdc_ms-ai-generator

# Forzar fallo de un contenedor (demo de tolerancia a fallos)
docker ps   # obtener ID de un contenedor del servicio
docker rm -f <container_id>   # Swarm lo reemplaza automáticamente
```

---

## LO QUE SE DEMUESTRA EN EL EXAMEN

1. **Elasticidad:** `docker service scale` en vivo, réplicas aumentan/disminuyen
2. **Tolerancia a fallos:** matar un contenedor, Swarm lo reemplaza, el servicio sigue respondiendo
3. **CI funcionando:** push a GitHub → Actions construye y publica imagen en DockerHub automáticamente
4. **Dev vs Prod:** mostrar Dockerfile.dev con volumen + hot-reload vs Dockerfile.prod multi-stage optimizado
5. **Arquitectura distribuida:** múltiples servicios comunicándose en red overlay de Swarm

---

## NOTAS PARA CLAUDE CODE

- Genera los archivos en la ruta exacta indicada en la estructura
- Cada Dockerfile debe tener comentarios explicando por qué cada instrucción
- El código de la demo puede ser mínimo pero la estructura de carpetas debe ser la correcta (domain/application/infrastructure)
- No uses credenciales reales en ningún archivo — siempre `.env.example` con valores de ejemplo
- El `.gitignore` debe incluir: `node_modules/`, `__pycache__/`, `.env`, `dist/`, `*.pyc`
- Cuando generes `docker-compose.prod.yml`, usa `image:` apuntando a DockerHub, nunca `build:`

---

## PACKAGE MANAGER — pnpm OBLIGATORIO

**Regla absoluta:** En todos los servicios Node.js (ms-orchestrator, ms-frontend) usar **pnpm** exclusivamente. Nunca `npm install`, nunca `npm ci`, nunca `yarn`.

**Por qué:** npm es más lento, genera `package-lock.json` que puede desincronizarse con el `package.json` causando fallos en CI (`npm ci` falla si el lockfile no coincide exactamente). pnpm tiene `--frozen-lockfile` que es más estricto y confiable.

**Reglas en Dockerfiles Node.js:**
```dockerfile
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
```
- `--ignore-scripts`: evita el error interactivo de `pnpm approve-builds` en pnpm v11
- El `pnpm-lock.yaml` siempre debe estar commiteado en el repo
- El `package-lock.json` nunca debe existir en el repo
- Para deps con bindings nativos: preferir alternativas puro-JS (ej: `bcryptjs` en lugar de `bcrypt`)

**Comandos locales:**
```bash
pnpm install          # instalar deps
pnpm add <pkg>        # agregar dependencia
pnpm add -D <pkg>     # agregar devDependency
pnpm run build        # ejecutar script build
```

---

## DOCUMENTACIÓN — OBLIGATORIA AL MODIFICAR MICROSERVICIOS

**Regla:** Cualquier cambio en un microservicio que afecte su interfaz, dependencias, endpoints, esquema o comportamiento **debe reflejarse en el archivo correspondiente de `docs/ms-docs/`**.

| Microservicio | Archivo de documentación |
|---|---|
| ms-orchestrator | `docs/ms-docs/ms-orchestrator.md` |
| ms-ai-generator | `docs/ms-docs/ms-ai-generator.md` |
| ms-doc-processor | `docs/ms-docs/ms-doc-processor.md` |
| ms-ingestion | `docs/ms-docs/ms-ingestion.md` |
| ms-monitor | `docs/ms-docs/ms-monitor.md` |
| ms-frontend | `docs/ms-docs/ms-frontend.md` |

**Qué documentar cuando cambia:**
- Nuevos endpoints o cambios en request/response → actualizar la tabla de endpoints del `.md`
- Nuevas dependencias (npm/pip) → actualizar la sección de dependencias
- Nuevas variables de entorno → actualizar la tabla de env vars y el `.env.example`
- Cambios en el esquema PostgreSQL → actualizar `docs/ms-docs/` y revisar `01_schema.sql`
- Cambios en el flujo entre servicios → actualizar `docs/processes/flujo-transversal.md`

**Por qué:** Los otros chats que desarrollan microservicios en paralelo dependen de `docs/` como fuente de verdad del contrato de cada servicio. Si el código cambia pero la doc no, los demás servicios se programan contra una interfaz incorrecta.

---

## SKILLS — USAR SIEMPRE QUE APLIQUEN

Las skills son comandos especializados instalados en este entorno. Cuando una tarea coincide con una skill disponible, invocarla **antes** de cualquier otra acción.

**Cómo invocar:** `/nombre-de-la-skill [argumentos]`

**Cuándo usarlas:**
- Si el usuario pide hacer un code review → buscar y usar la skill de review antes de hacer análisis manual
- Si el usuario pide documentar, planificar o ejecutar tareas complejas → verificar si existe una skill específica
- No inventar nombres de skills — solo usar las que aparecen en el sistema como disponibles

**Por qué:** Las skills tienen contexto especializado y acceso a herramientas optimizadas para su tarea. Ignorarlas y reinventar la rueda produce resultados de menor calidad.
