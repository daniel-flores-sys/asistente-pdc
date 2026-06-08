# Manual de Mantenimiento

---

## Backup de PostgreSQL

### Backup manual

```bash
# En Server 1
docker exec $(docker ps -q -f name=pdc_postgres) \
  pg_dump -U genplan_user genplan_db \
  > backup_$(date +%Y%m%d_%H%M).sql

# Comprimir
gzip backup_$(date +%Y%m%d_%H%M).sql
```

### Backup automático a S3 (cron en Server 1)

```bash
# Agregar a crontab: crontab -e
0 3 * * * docker exec $(docker ps -q -f name=pdc_postgres) \
  pg_dump -U genplan_user genplan_db | gzip | \
  aws s3 cp - s3://pdc-documentos-floresmedina/backups/db_$(date +\%Y\%m\%d).sql.gz
```

### Restaurar backup

```bash
# Restaurar en servidor
gunzip -c backup_20260607.sql.gz | \
  docker exec -i $(docker ps -q -f name=pdc_postgres) \
  psql -U genplan_user genplan_db
```

---

## Actualización de imágenes (rolling update)

### Vía CI/CD (recomendado)

Push a la rama `main` en GitHub dispara GitHub Actions automáticamente:
1. Build imágenes de todos los microservicios
2. Push a DockerHub con tags `:latest` y `:<sha-commit>`
3. Rolling update en Server 1 via SSH

### Manual (si CI/CD falla)

```bash
# En Server 1 — actualizar un servicio específico
docker service update \
  --image danielflores/ms-ai-generator:latest \
  --update-parallelism 1 \
  --update-delay 10s \
  pdc_ms-ai-generator

# Verificar que el update terminó sin errores
docker service ps pdc_ms-ai-generator

# Si el update falla, hacer rollback
docker service rollback pdc_ms-ai-generator
```

---

## Gestión de logs

```bash
# Ver logs de un servicio (últimas 100 líneas, modo follow)
docker service logs pdc_ms-orchestrator --tail 100 -f

# Ver logs con timestamps
docker service logs pdc_ms-ai-generator --timestamps --tail 50

# Guardar logs en archivo
docker service logs pdc_ms-doc-processor > logs_doc_processor_$(date +%Y%m%d).txt

# Limpiar logs de Docker (libera disco)
docker system prune --volumes -f
```

---

## Limpieza de archivos generados

Los archivos `.docx` se generan temporalmente en `ms-doc-processor/output/` antes de subirse a S3.
Si S3 está activo, estos archivos se pueden limpiar regularmente:

```bash
# Limpiar output/ en el contenedor ms-doc-processor
docker exec $(docker ps -q -f name=pdc_ms-doc-processor) \
  find /app/output -name "*.docx" -mtime +1 -delete

# Ver cuánto espacio ocupa output/
docker exec $(docker ps -q -f name=pdc_ms-doc-processor) \
  du -sh /app/output/
```

---

## Actualización de datos de referencia (sin redeploy)

Los temas mensuales, objetivos holísticos, áreas y demás datos normativos
se editan directamente desde el panel de administración `/admin`:

1. Login como admin
2. Ir a `/admin/reference-data`
3. Editar o agregar el dato
4. Cambio efectivo de inmediato (no requiere reiniciar servicios)

---

## Re-indexación de documentos ChromaDB

Si los documentos pedagógicos necesitan ser actualizados:

```bash
# Desde el panel admin → /admin/documentos
# Click en "Re-indexar" en el documento deseado
# Esto llama POST /ingest/{id}/reindex en ms-ingestion

# O via curl (requiere token admin)
curl -X POST http://localhost:8003/docs/{id}/reindex \
  -H "Authorization: Bearer <admin_token>"
```

---

## Mantenimiento de ChromaDB

```bash
# Ver colecciones disponibles
curl http://localhost:8004/api/v1/collections

# Ver cantidad de embeddings por colección
curl http://localhost:8004/api/v1/collections/curriculum_pdc

# Backup de ChromaDB (volumen Docker)
docker run --rm \
  -v chroma_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/chroma_backup_$(date +%Y%m%d).tar.gz /data
```

---

## Rotación de secrets

Si se rotan las credenciales de AWS o DockerHub:

1. Actualizar los GitHub Secrets en el repositorio (Settings → Secrets → Actions)
2. Actualizar el archivo `.env` en Server 1:
   ```bash
   nano ~/.env  # editar valores
   ```
3. Re-desplegar el stack para que tome los nuevos valores:
   ```bash
   docker stack deploy -c docker-compose.yml pdc --with-registry-auth
   ```

Si se rota el `JWT_SECRET`:
- Todas las sesiones activas quedarán inválidas (los docentes tendrán que hacer login de nuevo)
- Es el comportamiento esperado y correcto por seguridad

---

## Checklist de mantenimiento semanal

- [ ] `docker service ls` — todos los servicios con el número correcto de réplicas
- [ ] `docker system df` — verificar uso de disco, limpiar si >80%
- [ ] Revisar alertas en `/admin/monitor` — ¿hubo fallos o reinicios inesperados?
- [ ] Verificar que los backups de PostgreSQL se ejecutaron (`aws s3 ls s3://pdc-documentos-floresmedina/backups/`)
- [ ] Revisar logs de ms-orchestrator por errores 500
