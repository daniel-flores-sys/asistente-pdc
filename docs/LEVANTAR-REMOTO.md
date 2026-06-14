# Guía: Desplegar en Servidor (Docker Swarm)

> **Arquitectura:** Server 1 (Swarm Manager + servicios PDC) + Server 2 (Ollama CPU-only)  
> **SO:** Ubuntu 22.04 LTS en ambos servidores  
> **Acceso SSH:** todo pasa por el bastión `usrproxy@<BASTION-IP>` (reemplazar con la IP real del servidor)

---

## Topología de red

```
Tu PC / GitHub Actions Runner
      │ SSH  -J usrproxy@<BASTION-IP>
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Bastión / Jump Host                                                 │
│  IP pública: <BASTION-IP>   (usrproxy)                            │
│  Solo reenvía conexiones SSH — no corre servicios de la app        │
└─────────────────────────────────────────┬───────────────────────────┘
                  red privada             │ ProxyJump
                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Server 1 — 8 vCPU / 16 GB RAM / 100 GB SSD                        │
│  IP privada: <SERVER1-IP>  (admin245)                           │
│                                                                     │
│  Docker Swarm Manager                                               │
│  ├── pdc_ms-frontend      :3000  (replica 1)                       │
│  ├── pdc_ms-orchestrator  :3001  (replica 2)                       │
│  ├── pdc_ms-ai-generator  :8000  (replica 3 — escalable)           │
│  ├── pdc_ms-doc-processor :8001  (replica 2)                       │
│  ├── pdc_ms-ingestion     :8003  (replica 1)                       │
│  ├── pdc_postgres         :5432  (replica 1 — solo manager)        │
│  └── pdc_chromadb         :8002  (replica 1 — solo manager)        │
└─────────────────────────────────────────────────────────────────────┘
                         │ HTTP :11434 (Ollama API — red privada)
┌─────────────────────────────────────────────────────────────────────┐
│  Server 2 — 8 vCPU / 24 GB RAM / 30 GB SSD                         │
│  IP privada: <SERVER2-IP>  (admin246)                           │
│                                                                     │
│  Ollama (CPU-only, sin GPU)                                         │
│  └── gemma4:e4b  (~3-8 tok/s en CPU)                               │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │  AWS S3 us-east-1        │
                    │  bucket: pdc-documentos  │
                    │  Almacena .docx generados│
                    └─────────────────────────┘
```

**Conectarse a Server 1 desde tu PC:**

```powershell
# Windows PowerShell
ssh -J usrproxy@<BASTION-IP> admin245@<SERVER1-IP>
```

```bash
# Linux / macOS
ssh -J usrproxy@<BASTION-IP> admin245@<SERVER1-IP>
```

---

## PARTE 1 — Configurar Server 2 (Ollama)

### 1.1 Instalar Ollama

```bash
# En Server 2
curl -fsSL https://ollama.com/install.sh | sh
```

### 1.2 Configurar para escuchar en red local y mantener modelo en RAM

```bash
sudo systemctl edit ollama
```

Agregar entre las marcas `[Service]`:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_CONTEXT_LENGTH=4096"
Environment="OLLAMA_MAX_QUEUE=5"
```

> `OLLAMA_KEEP_ALIVE=-1` es **crítico**: evita que el modelo se descargue de RAM entre llamadas,
> eliminando la penalización de 30-60 segundos de recarga en CPU.

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo systemctl enable ollama
```

### 1.3 Descargar el modelo

```bash
ollama pull gemma4:e4b
```

> Primera descarga: ~9.6 GB. En 24 GB RAM procesa ~3-8 tokens/segundo.

### 1.4 Restringir puerto 11434 — solo desde Server 1

```bash
sudo ufw allow ssh
sudo ufw allow from <SERVER1-IP> to any port 11434
sudo ufw deny 11434
sudo ufw enable
sudo ufw status verbose
```

### 1.5 Verificar conectividad

```bash
# Desde Server 1
curl http://<SERVER2-IP>:11434/api/tags
# Debe devolver la lista de modelos descargados
```

---

## PARTE 2 — Configurar Server 1 (Docker Swarm)

### 2.1 Instalar Docker Engine

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version   # 26.x o superior
```

### 2.2 Inicializar Docker Swarm

```bash
docker swarm init --advertise-addr <SERVER1-IP>
```

---

## PARTE 3 — Configurar CI/CD (GitHub Actions + DockerHub + SSH)

El pipeline automatiza el build y el deploy en cada push a `main`.

Resumen de los 4 secrets necesarios en GitHub:

| Secret | Descripción |
|---|---|
| `DOCKERHUB_USERNAME` | Usuario de DockerHub |
| `DOCKERHUB_TOKEN` | Access Token de DockerHub |
| `SSH_PRIVATE_KEY_BASTION` | Clave privada ED25519 para `usrproxy@<BASTION-IP>` |
| `SSH_PRIVATE_KEY_SERVER` | Clave privada ED25519 para `admin245@<SERVER1-IP>` |

---

## PARTE 4 — Primer deploy del stack

> Esta parte se hace **una sola vez** manualmente. Los deploys siguientes los gestiona el pipeline automáticamente.

### 4.1 Hacer `docker login` en Server 1

Requerido para que el Swarm pueda jalar imágenes de DockerHub:

```bash
docker login -u TU_DOCKERHUB_USERNAME
# Ingresar el Access Token cuando pida contraseña
```

### 4.2 Crear volúmenes persistentes

```bash
docker volume create pdc_postgres_data
docker volume create pdc_chroma_data
```

### 4.3 Copiar el compose y los scripts SQL desde tu PC

```powershell
# Windows — copiar docker-compose.yml
scp -J usrproxy@<BASTION-IP> docker-compose.yml admin245@<SERVER1-IP>:~/

# Copiar scripts de inicialización de la BD
ssh -J usrproxy@<BASTION-IP> admin245@<SERVER1-IP> "mkdir -p ~/sql-init"
scp -J usrproxy@<BASTION-IP> `
  ms-doc-processor\infra\postgres\init\02_pdc_schema.sql `
  ms-doc-processor\infra\postgres\init\03_pdc_seed.sql `
  ms-doc-processor\infra\postgres\init\04_demo_prep.sql `
  ms-doc-processor\infra\postgres\init\05_tema_mes_seed.sql `
  admin245@<SERVER1-IP>:~/sql-init/
```

### 4.4 Deployar el stack

**En Server 1:**

```bash
export DOCKERHUB_USERNAME=tu_usuario
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_S3_BUCKET=pdc-documentos
export AWS_REGION=us-east-1

envsubst < docker-compose.yml | docker stack deploy -c - pdc
```

### 4.5 Inicializar la base de datos

```bash
# Esperar que postgres esté Running (~20 segundos)
docker service ls

POSTGRES_CTR=$(docker ps -q -f name=pdc_postgres)

for script in 02_pdc_schema.sql 03_pdc_seed.sql 04_demo_prep.sql 05_tema_mes_seed.sql; do
  echo "→ $script"
  docker exec -i $POSTGRES_CTR psql -U genplan_user genplan_db < ~/sql-init/$script
done
```

### 4.6 Verificar el deploy

```bash
docker service ls
```

Salida esperada:

```
NAME                        MODE        REPLICAS  IMAGE
pdc_ms-frontend             replicated  1/1       usuario/ms-frontend:latest
pdc_ms-orchestrator         replicated  2/2       usuario/ms-orchestrator:latest
pdc_ms-ai-generator         replicated  3/3       usuario/ms-ai-generator:latest
pdc_ms-doc-processor        replicated  2/2       usuario/ms-doc-processor:latest
pdc_ms-ingestion            replicated  1/1       usuario/ms-ingestion:latest
pdc_postgres                replicated  1/1       postgres:16-alpine
pdc_chromadb                replicated  1/1       chromadb/chroma:latest
```

---

## PARTE 5 — Configurar OLLAMA_URL en ms-ai-generator

```bash
docker service update \
  --env-add OLLAMA_URL=http://<SERVER2-IP>:11434 \
  pdc_ms-ai-generator
```

Verificar que el servicio responde:

```bash
curl http://localhost:8000/health
```

---

## PARTE 6 — Demo de Elasticidad y Tolerancia a Fallos

### 6.1 Escalar ms-ai-generator en vivo

```bash
# Escalar a 5 réplicas (demo de elasticidad)
docker service scale pdc_ms-ai-generator=5

# Verificar réplicas levantando
docker service ps pdc_ms-ai-generator

# Volver a 3
docker service scale pdc_ms-ai-generator=3
```

### 6.2 Demo de tolerancia a fallos

```bash
# 1. Identificar un contenedor del servicio
docker ps --filter name=pdc_ms-ai-generator

# 2. Matar uno — Swarm lo reemplaza en ~10 segundos
docker rm -f <container_id>

# 3. Verificar reposición automática
docker service ps pdc_ms-ai-generator
# La tarea vieja aparece como "Shutdown", la nueva como "Running"

# 4. Confirmar que el servicio siguió respondiendo
curl http://localhost:8000/health
```

---

## PARTE 7 — Verificación end-to-end en producción

```bash
# 1. Health checks de todos los servicios
curl http://localhost:3000            # ms-frontend (página React)
curl http://localhost:3001/api/health # ms-orchestrator
curl http://localhost:8000/health     # ms-ai-generator
curl http://localhost:8001/health     # ms-doc-processor
curl http://localhost:8003/health     # ms-ingestion

# 2. Datos de referencia (áreas, temas, unidades)
curl http://localhost:3001/api/reference-data | python3 -m json.tool

# 3. Generar PDC completo
curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Docente Demo", "ci": "12345678", "titulo": "Lic.",
    "unidad_educativa_id": 1, "anio_escolaridad_id": 6, "trimestre_id": 1,
    "areas_seleccionadas": [2, 8],
    "temas_seleccionados": {"2": [], "8": []},
    "materiales": "Texto de aprendizaje",
    "contexto_social": "Comunidad rural del municipio"
  }' | python3 -m json.tool
# Devuelve: { plan_id, download_url (S3), filename }

# 4. Seguridad — verificar que .env no está en repo
git show HEAD:.gitignore | grep ".env"
```

---

## PARTE 8 — Actualización de imágenes (rolling update automático)

Después de configurar el CI/CD, los updates son automáticos:

```bash
# Cada push a main ejecuta el pipeline que hace este update automáticamente.
# Si necesitas forzarlo manualmente:
docker service update --image $DOCKERHUB_USERNAME/ms-ai-generator:latest pdc_ms-ai-generator

# Verificar que el update avanza (1 réplica a la vez)
docker service ps pdc_ms-ai-generator
```

---

## Comandos de limpieza

```bash
# Remover el stack completo
docker stack rm pdc

# Esperar y verificar
docker service ls  # debe estar vacío

# Remover volúmenes si se quiere empezar desde cero
docker volume rm pdc_postgres_data pdc_chroma_data

# Salir del Swarm
docker swarm leave --force
```

---

## Troubleshooting de producción

| Síntoma | Causa | Solución |
|---|---|---|
| Réplicas en `Pending` | Imagen no publicada en DockerHub | Verificar que el pipeline CI/CD completó |
| Réplicas en `Failed` | Error al arrancar | `docker service logs pdc_ms-ai-generator` |
| ms-ai-generator no llama a Ollama | `OLLAMA_URL` no configurado | `docker service update --env-add OLLAMA_URL=http://<SERVER2-IP>:11434 pdc_ms-ai-generator` |
| `.docx` sin S3 URL | Variables AWS no configuradas | `docker service update --env-add AWS_ACCESS_KEY_ID=... pdc_ms-doc-processor` |
| Stack no deploya con `${}` | Variables no exportadas | Usar `envsubst < docker-compose.yml \| docker stack deploy -c - pdc` |
| BD vacía, servicios con error 500 | Scripts SQL no ejecutados | Ejecutar PARTE 4.5 |
| SSH Permission denied desde Actions | Clave pública no autorizada | Ver [configurar-cicd.md](./configurar-cicd.md) PARTE 2.4 |
