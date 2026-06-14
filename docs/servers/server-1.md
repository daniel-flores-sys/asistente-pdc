# Server 1 — Docker Swarm Manager

## Datos del servidor

| Campo | Valor |
|---|---|
| IP privada | 192.168.100.245 |
| Usuario SSH | admin245 |
| Hostname | server-245 |
| Acceso | Solo vía bastión: `ssh -J usrproxy@201.131.45.42 admin245@192.168.100.245` |
| SO | Ubuntu 22.04 LTS |
| Rol | Docker Swarm Manager + todos los microservicios de la aplicación |
| Docker Engine | 29.5.3 |
| Dominio público | https://server-245.rootcode.com.bo (vía Cloudflare → Bastión → este servidor) |

---

## Servicios que corre

| Servicio | Puerto interno | Réplicas |
|---|---|---|
| ms-frontend | 3000 | 1 |
| ms-orchestrator | 3001 | 1 |
| ms-ai-generator | 8000 | 1 (escalable) |
| ms-doc-processor | 8001 | 1 |
| ms-monitor | 8002 | 1 |
| ms-ingestion | 8003 | 1 |
| postgres | 5432 | 1 (solo manager) |
| chromadb | 8004 | 1 (solo manager) |

**Solo ms-frontend:3000 es accesible externamente** vía nginx local → bastión → Cloudflare.
El resto comunica por la red overlay `pdc-overlay` interna.

---

## Flujo de red completo

```
Usuario → Cloudflare (DNS/SSL) → Bastión :443 → nginx bastión → Server-245 :80 → nginx local → ms-frontend :3000
```

---

## nginx local (reverse proxy :80 → :3000)

### Instalación

```bash
sudo apt update && sudo apt install -y nginx
```

### Configuración

Archivo: `/etc/nginx/sites-available/pdc`

```nginx
server {
    listen 80;
    server_name _;

    # Aumentar límite para uploads de documentos pedagógicos al panel admin
    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### Activar y verificar

```bash
# Activar el sitio y eliminar el default
sudo ln -s /etc/nginx/sites-available/pdc /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar sintaxis
sudo nginx -t

# Habilitar inicio automático y arrancar
sudo systemctl enable nginx
sudo systemctl restart nginx

# Verificar que responde en :80
curl -I http://localhost:80
```

---

## Firewall (UFW)

Estado configurado y activo:

```
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere    ← SSH desde bastión
80/tcp                     ALLOW       Anywhere    ← nginx → bastión
2377/tcp                   ALLOW       Anywhere    ← Docker Swarm manager
7946/tcp                   ALLOW       Anywhere    ← Docker Swarm gossip
7946/udp                   ALLOW       Anywhere    ← Docker Swarm gossip
4789/udp                   ALLOW       Anywhere    ← Docker overlay network (VXLAN)
```

Comandos para replicar esta configuración en un servidor nuevo:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 2377/tcp
sudo ufw allow 7946/tcp
sudo ufw allow 7946/udp
sudo ufw allow 4789/udp
sudo ufw enable
```

> **No abrir** los puertos 3001, 8000, 8001, 8002, 8003, 5432, 8004 al exterior.
> Estos solo deben ser accesibles dentro de la red overlay de Docker.

---

## Docker Swarm

### Inicialización (ya realizada)

```bash
docker swarm init --advertise-addr 192.168.100.245
```

Estado actual del nodo:
```
ID                            HOSTNAME     STATUS    AVAILABILITY   MANAGER STATUS   ENGINE VERSION
m9s6hrj2n0nbfr00ckaq1jlrh *   server-245   Ready     Active         Leader           29.5.3
```

### Login a DockerHub

Docker 29+ usa autenticación web por defecto:

```bash
docker login
# Genera un código de dispositivo, lo validás en https://login.docker.com/activate
# Login Succeeded — credenciales guardadas en ~/.docker/config.json
```

> Las credenciales quedan en `/home/admin245/.docker/config.json`.
> Necesario para que Swarm pueda jalar imágenes privadas de DockerHub.

---

## Primer despliegue (stack PDC)

### Preparación del entorno

`docker stack deploy` no acepta `--env-file`. Las variables deben estar en el entorno de la sesión:

```bash
# 1. Crear .env en el servidor con los valores de producción
nano ~/.env
```

Contenido mínimo:
```env
REGISTRY=danielfloressys
IMAGE_TAG=latest

JWT_SECRET=<mismo valor que GitHub Secret JWT_SECRET>
ADMIN_EMAIL=admin@pdc.edu.bo
ADMIN_PASSWORD=<mismo valor que GitHub Secret ADMIN_PASSWORD>

OLLAMA_URL=http://192.168.100.246:11434

AWS_ACCESS_KEY_ID=<de GitHub Secrets>
AWS_SECRET_ACCESS_KEY=<de GitHub Secrets>
AWS_S3_BUCKET=<de GitHub Secrets>
AWS_REGION=us-east-1
```

```bash
# 2. Copiar docker-compose.yml al servidor (desde máquina local)
scp -J usrproxy@201.131.45.42 docker-compose.yml admin245@192.168.100.245:~/

# 3. Exportar variables al entorno de la sesión
set -a && source ~/.env && set +a

# 4. Deploy (--with-registry-auth pasa las credenciales de docker login a Swarm)
docker stack deploy --with-registry-auth -c ~/docker-compose.yml pdc

# 5. Verificar que los servicios levantaron (puede tardar 1-2 min)
docker service ls
```

> **Nota:** Los volúmenes `postgres_data` y `chroma_data` se crean automáticamente
> en el nodo manager al hacer el primer `docker stack deploy`. No es necesario crearlos
> manualmente.

### Verificación post-deploy

```bash
# Todos deben mostrar REPLICAS 1/1
docker service ls

# Logs del orchestrator para verificar que conectó a la BD
docker service logs pdc_ms-orchestrator --tail 50

# Verificar que nginx proxea al frontend
curl -I http://localhost:80
```

---

## Actualizaciones (rolling update vía CI/CD)

Después del primer deploy, cada push a `main` en GitHub:
1. Construye imágenes nuevas en DockerHub
2. Requiere aprobación manual en GitHub → Settings → Environments → production
3. Hace rolling update de cada servicio via SSH+ProxyJump

```bash
# Rolling update manual de un servicio específico
docker service update \
  --image danielfloressys/ms-orchestrator:latest \
  --with-registry-auth \
  pdc_ms-orchestrator
```

---

## ms-monitor — Docker socket

ms-monitor monta el socket de Docker para monitorear y escalar servicios Swarm:

```yaml
ms-monitor:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  deploy:
    placement:
      constraints:
        - node.role == manager   # OBLIGATORIO: solo el manager tiene permisos Swarm
```

---

## Comandos de operación

```bash
# Estado de todos los servicios del stack
docker service ls

# Tareas de un servicio (en qué contenedor, estado)
docker service ps pdc_ms-ai-generator

# Logs en tiempo real
docker service logs pdc_ms-orchestrator --tail 100 -f

# Escalar un servicio (demo de elasticidad)
docker service scale pdc_ms-ai-generator=3

# Forzar fallo para demo de tolerancia a fallos
docker ps                          # obtener ID del contenedor
docker rm -f <container_id>        # Swarm lo reemplaza automáticamente

# Remover el stack completo
docker stack rm pdc

# Monitoreo de recursos
docker system df
df -h
htop
```

---

## Seguridad

- SSH key-only, no password (`PasswordAuthentication no` en `/etc/ssh/sshd_config`)
- El archivo `~/.env` con credenciales nunca se sube a git — se crea manualmente en el servidor
- PostgreSQL, ChromaDB y los microservicios internos no tienen puertos expuestos al exterior
- JWT_SECRET, DB_PASSWORD y AWS keys se inyectan en runtime desde `~/.env`
- UFW activo con solo los puertos necesarios abiertos
