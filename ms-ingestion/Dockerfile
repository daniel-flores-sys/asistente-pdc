# ─── Etapa 1: Builder ────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder
WORKDIR /install
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

# ─── Etapa 2: Producción ─────────────────────────────────────────────────────
FROM python:3.11-slim AS production

WORKDIR /app
COPY --from=builder /install/deps /usr/local
COPY src/ ./src/

RUN useradd -u 1000 -r appuser
USER appuser

EXPOSE 8003

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "2"]
