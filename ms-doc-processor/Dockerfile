# ─── Etapa 1: Builder ────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder
WORKDIR /install
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

# ─── Etapa 2: Producción ─────────────────────────────────────────────────────
# Sin caché de pip, sin herramientas de build
FROM python:3.11-slim AS production

WORKDIR /app

COPY --from=builder /install/deps /usr/local

# Copiamos el código fuente y el CLI principal
COPY main.py ./main.py
COPY src/ ./src/

RUN useradd -u 1000 -r appuser
USER appuser

EXPOSE 8001

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
