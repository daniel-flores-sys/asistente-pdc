# ms-monitor

**Rol:** Monitoreo en tiempo real y auto-scaling del stack Docker Swarm. Conecta al socket
de Docker para leer métricas de contenedores, aplicar reglas de escalamiento automático
y permitir control manual desde el panel de administración.

---

## Stack

| Item | Valor |
|---|---|
| Framework | FastAPI + Python 3.11 |
| Puerto | 8002 |
| BD | Ninguna (estado en memoria + Docker socket) |
| Lib clave | docker SDK for Python (docker==7.x) |

---

## Variables de entorno

```env
PORT=8002
ENVIRONMENT=development
SCALE_UP_CPU_THRESHOLD=70
SCALE_DOWN_CPU_THRESHOLD=20
SCALE_DOWN_DELAY_MINUTES=5
MAX_REPLICAS=5
MIN_REPLICAS=1
DOCKER_SOCKET=/var/run/docker.sock
MONITOR_USER=root
```

---

## Requisitos de despliegue

```yaml
# docker-compose.yml — sección de ms-monitor
ms-monitor:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  deploy:
    replicas: 1
    placement:
      constraints:
        - node.role == manager   # OBLIGATORIO: el socket Swarm solo funciona en el manager
```

> ms-monitor **siempre tiene 1 réplica** y **siempre en el nodo manager**.
> El socket de Docker Swarm (`/var/run/docker.sock`) solo permite comandos de orquestación
> (scale, update) desde el nodo manager. En un worker, el socket existe pero no puede
> ejecutar `docker service scale`.

---

## Endpoints

```
GET /health
  Response: {
    status:         "ok",
    service:        "ms-monitor",
    swarm_active:   boolean,
    services_count: number
  }

GET /monitor/services
  Response: [{
    name:              string,
    replicas_running:  number,
    replicas_desired:  number,
    image:             string,
    ports:             string[],
    tasks: [{
      id:         string,
      state:      "running" | "failed" | "shutdown" | "starting",
      node:       string,
      updated_at: string
    }]
  }]

GET /monitor/metrics
  Response: [{
    service_name:  string,
    cpu_percent:   number,     # promedio de todas las réplicas
    memory_mb:     number,     # total de todas las réplicas
    restart_count: number      # reinicios en las últimas 24 horas
  }]

POST /monitor/scale
  Body:     { service_name: string, replicas: number }
  Response: {
    service_name:  string,
    old_replicas:  number,
    new_replicas:  number
  }
  Errors:
    400 - replicas fuera del rango [MIN_REPLICAS, MAX_REPLICAS]
    404 - servicio no encontrado
    403 - no se puede escalar ms-monitor ni postgres ni chromadb

GET /monitor/alerts
  Response: [{
    timestamp:  string,
    service:    string,
    event:      "scale_up" | "scale_down" | "container_restart" | "service_down",
    details:    string,
    old_value:  number | null,
    new_value:  number | null
  }]
  Nota: mantiene las últimas 200 alertas en memoria circular

GET /monitor/config
PUT /monitor/config
  Body/Response: {
    scale_up_cpu_threshold:    number,   # default 70
    scale_down_cpu_threshold:  number,   # default 20
    scale_down_delay_minutes:  number,   # default 5
    max_replicas:              number,   # default 5
    min_replicas:              number    # default 1
  }
```

---

## Flujo del loop de monitoreo

```
asyncio background task — se ejecuta cada 30 segundos vía asyncio.to_thread(_run_one_cycle)
(to_thread evita bloquear el event loop de uvicorn durante llamadas síncronas al Docker SDK):

1. docker_client.services.list(filters={"label": "com.docker.stack.namespace=pdc"})
   → Lista servicios del stack PDC

2. Para cada servicio con réplicas > 0:
   - tasks = service.tasks(filters={"desired-state": "running"})
   - Para cada task: docker_client.containers.get(task.status.container_status.container_id)
   - container.stats(stream=False) → CPU% y RAM MB

3. Calcular promedio de CPU por servicio

4. Evaluar reglas de auto-scaling:
   a. Si cpu_avg > SCALE_UP_CPU_THRESHOLD y replicas < MAX_REPLICAS:
      → service.scale(replicas + 1)
      → Registrar alerta "scale_up"
   
   b. Si cpu_avg < SCALE_DOWN_CPU_THRESHOLD:
      → Agregar timestamp al contador de "en umbral bajo"
      → Si lleva SCALE_DOWN_DELAY_MINUTES en umbral bajo y replicas > MIN_REPLICAS:
         → service.scale(replicas - 1)
         → Registrar alerta "scale_down"
         → Resetear contador

5. Detectar contenedores reiniciados recientemente:
   → Registrar alerta "container_restart" si restart_count aumentó

Servicios excluidos del auto-scaling:
  - pdc_ms-monitor (este mismo servicio)
  - pdc_postgres
  - pdc_chromadb
```

---

## Estructura de carpetas

```
src/
├── domain/
│   └── schemas/
│       └── monitor.py           # Pydantic: ServiceInfo, MetricInfo, AlertInfo, ScaleConfig
├── application/
│   └── routes/
│       └── monitor.py           # GET/POST endpoints
├── infrastructure/
│   ├── docker_client.py         # Wrapper del Docker SDK
│   └── metrics_store.py         # Estado en memoria: métricas + alertas (deque)
├── monitor_loop.py              # asyncio task de monitoreo
└── main.py                      # Inicia FastAPI + lanza monitor_loop como background task
```

---

## Seguridad

- ms-monitor **no está expuesto directamente al exterior**
- El frontend admin llama a `/api/admin/monitor/*` en ms-orchestrator
- ms-orchestrator actúa como proxy y verifica el JWT de admin antes de reenviar
- El socket Docker se monta como `:ro` (read-only) donde sea posible
- El endpoint `POST /monitor/scale` de ms-monitor solo acepta conexiones desde la red overlay `pdc-overlay`
