# Imagen de PostgreSQL con el schema y los datos de semilla ya incluidos.
# Se usa en el entorno local con Docker Swarm (stack deploy no soporta bind mounts).
# En producción se ejecutan los SQL manualmente tras el primer deploy.
FROM postgres:16-alpine

# Los archivos .sql en /docker-entrypoint-initdb.d se ejecutan en orden
# alfabético cuando el volumen de datos está vacío (primer arranque).
# 01_schema.sql    → crea todas las tablas del sistema
# 02_seed_normativos.sql → inserta datos fijos del Ministerio (niveles, áreas, gestión 2026)
# Los datos variables (objetivos, temas, UE, docentes) los carga el admin desde el panel.
COPY init/01_schema.sql          /docker-entrypoint-initdb.d/01_schema.sql
COPY init/02_seed_normativos.sql /docker-entrypoint-initdb.d/02_seed_normativos.sql
