# ─── Etapa 1: Builder ────────────────────────────────────────────────────────
# Instalamos dependencias en un prefijo separado para copiarlas limpiamente.
# Esta etapa puede tener caché de pip y herramientas de build sin contaminar producción.
FROM python:3.11-slim AS builder

WORKDIR /install

COPY requirements.txt .

# --prefix instala paquetes en /install/deps en lugar del sistema global.
# Así podemos copiarlos a la imagen de producción sin el caché de pip.
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

# ─── Etapa 2: Producción ─────────────────────────────────────────────────────
# Imagen mínima: sin herramientas de build, sin caché de pip.
FROM python:3.11-slim AS production

WORKDIR /app

# Traemos solo los paquetes instalados desde el builder
COPY --from=builder /install/deps /usr/local

COPY src/ ./src/

# Usuario sin privilegios: limita el impacto ante una posible vulnerabilidad
RUN useradd -u 1000 -r appuser
USER appuser

EXPOSE 8000

# Sin --reload en producción: más eficiente y no expone información de archivos internos
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
