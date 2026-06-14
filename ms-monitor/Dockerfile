# ─── Etapa 1: Instalar dependencias en directorio separado
# Permite copiar solo los paquetes compilados a la imagen final sin pip/wheel
FROM python:3.11-slim AS builder
WORKDIR /install
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

# ─── Etapa 2: Imagen de producción mínima
FROM python:3.11-slim AS production
WORKDIR /app

# Copiar dependencias instaladas desde la etapa builder
COPY --from=builder /install/deps /usr/local

# Copiar código fuente
COPY src/ ./src/

# Usuario no-root para reducir superficie de ataque
# Nota: El socket de Docker se monta como bind mount con permisos del host.
# El usuario 'appuser' necesita pertenecer al grupo 'docker' del host,
# o el socket debe tener permisos 666. En producción, ajustar según el host.
RUN useradd -u 1000 -r appuser
USER appuser

EXPOSE 8002

# 1 worker es suficiente para monitoreo — el loop asyncio maneja la concurrencia
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "1"]
