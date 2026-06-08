# Escalamiento del Sistema

---

## Cuándo escalar

El sistema está diseñado para escalar horizontalmente los microservicios stateless.
Los servicios con estado (PostgreSQL, ChromaDB) siempre corren con **1 réplica**.

| Servicio | Escalable | Razón |
|---|---|---|
| ms-frontend | Sí | nginx stateless |
| ms-orchestrator | Sí | Stateless, JWT verifica en cada request |
| ms-ai-generator | **Sí (prioritario)** | El más lento — llama a Ollama, cuello de botella |
| ms-doc-processor | Sí | Generación de Word es CPU-bound |
| ms-monitor | No (1 réplica fija) | Necesita acceso exclusivo al socket Docker Swarm |
| ms-ingestion | Sí (bajo demanda) | Solo el admin lo usa, carga puntual |
| postgres | No | Estado persistente, requiere configuración especial para múltiples réplicas |
| chromadb | No | Estado persistente de vectores |

---

## Escalamiento manual

```bash
# Escalar ms-ai-generator a 3 réplicas (demo de elasticidad)
docker service scale pdc_ms-ai-generator=3

# Verificar que las nuevas réplicas están corriendo
docker service ps pdc_ms-ai-generator

# Ver estado en tiempo real
watch -n 2 docker service ls

# Reducir réplicas
docker service scale pdc_ms-ai-generator=1
```

---

## Auto-scaling vía ms-monitor

ms-monitor corre un loop cada 30 segundos evaluando estas reglas:

```
CPU promedio del servicio > 70%  →  +1 réplica (máximo configurable, default 5)
CPU promedio < 20% por 5 min     →  -1 réplica (mínimo 1)
```

### Configurar umbrales desde el panel admin

`/admin/monitor` → sección "Configuración de auto-scaling"

| Parámetro | Default | Descripción |
|---|---|---|
| `scale_up_cpu_threshold` | 70 | % CPU para escalar hacia arriba |
| `scale_down_cpu_threshold` | 20 | % CPU para escalar hacia abajo |
| `scale_down_delay_minutes` | 5 | Minutos en umbral bajo antes de reducir |
| `max_replicas` | 5 | Máximo de réplicas por servicio |
| `min_replicas` | 1 | Mínimo de réplicas (nunca llega a 0) |

### Verificar que auto-scaling está funcionando

```bash
# Ver alertas de scaling registradas
curl http://localhost:8002/monitor/alerts

# Ver métricas actuales
curl http://localhost:8002/monitor/metrics

# Ver estado de servicios
curl http://localhost:8002/monitor/services
```

---

## Limitaciones de escala con 1 nodo Swarm

Con solo Server 1 como nodo, todas las réplicas corren en la misma máquina.
El escalamiento mejora la concurrencia (más procesos atienden requests simultáneos)
pero no agrega capacidad de cómputo total.

Para escalar más allá de 1 servidor:
1. Instalar Docker Engine en Server 2
2. Unir Server 2 al Swarm como worker: `docker swarm join --token <token> 192.168.100.245:2377`
3. Agregar constraint en docker-compose.yml para que ms-ai-generator vaya al nodo con más RAM

```yaml
# En docker-compose.yml — forzar ms-ai-generator al nodo con más RAM
ms-ai-generator:
  deploy:
    placement:
      constraints:
        - node.hostname == server2  # si se agrega Server 2 como worker
```

---

## Demo de tolerancia a fallos

Demostrar que Swarm reemplaza automáticamente contenedores caídos:

```bash
# 1. Ver IDs de los contenedores del servicio
docker ps | grep ms-orchestrator

# 2. Matar uno forzosamente
docker rm -f <container_id>

# 3. Swarm lo detecta en ~5 segundos y crea uno nuevo
watch -n 1 docker service ps pdc_ms-orchestrator

# 4. Mientras tanto, el servicio sigue respondiendo (si hay ≥2 réplicas)
# La otra réplica absorbe el tráfico automáticamente
```

---

## Estimación de recursos por réplica

| Servicio | RAM típica | CPU en idle | CPU en carga |
|---|---|---|---|
| ms-frontend | ~30 MB | ~0% | ~2% |
| ms-orchestrator | ~150 MB | ~0.5% | ~5% |
| ms-ai-generator | ~120 MB | ~0.5% | ~15% (esperando a Ollama) |
| ms-doc-processor | ~100 MB | ~0.5% | ~20% (generando Word) |
| ms-monitor | ~80 MB | ~1% (polling) | ~2% |
| ms-ingestion | ~200 MB | ~0.5% | ~30% (procesando PDFs) |
| postgres | ~200 MB | ~1% | ~5% |
| chromadb | ~300 MB | ~1% | ~10% |
