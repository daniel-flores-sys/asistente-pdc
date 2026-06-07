# ─── Etapa 1: Builder ────────────────────────────────────────────────────────
# Compilamos TypeScript → JavaScript en esta etapa.
# Esta capa nunca llega a producción: solo usamos su output (dist/).
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./

# npm ci garantiza builds reproducibles: requiere package-lock.json y no lo modifica.
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc -p tsconfig.json

# ─── Etapa 2: Producción ─────────────────────────────────────────────────────
# Solo copiamos el JS compilado + dependencias de producción.
# Sin TypeScript, sin ts-node-dev, sin código fuente → imagen mínima y segura.
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json* ./

# --omit=dev excluye devDependencies (typescript, ts-node-dev, @types/*)
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Usuario sin privilegios: limita el impacto ante una posible vulnerabilidad
USER node

EXPOSE 3001

CMD ["node", "dist/main"]
