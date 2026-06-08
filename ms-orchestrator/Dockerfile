# ─── Etapa 1: Builder ────────────────────────────────────────────────────────
# Compilamos TypeScript → JavaScript en esta etapa.
# Esta capa nunca llega a producción: solo usamos su output (dist/).
FROM node:20-alpine AS builder

# corepack viene incluido en Node 16.13+ — lo usamos para activar pnpm
# sin necesidad de instalarlo por separado (más limpio y reproducible)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiar solo los manifiestos primero para aprovechar el caché de capas:
# si package.json y pnpm-lock.yaml no cambian, esta capa no se reconstruye
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile garantiza builds reproducibles: falla si el lock está desincronizado
# --ignore-scripts evita postinstall scripts que requieren aprobación interactiva en pnpm v11
# (@nestjs/core postinstall es solo warmup de metadata — no afecta funcionalidad)
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm run build

# ─── Etapa 2: Producción ─────────────────────────────────────────────────────
# Solo copiamos el JS compilado + dependencias de producción.
# Sin TypeScript, sin ts-node-dev, sin código fuente → imagen mínima y segura.
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# --prod instala solo dependencies, excluye devDependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/dist ./dist

# Usuario sin privilegios: limita el impacto ante una posible vulnerabilidad
USER node

EXPOSE 3001

CMD ["node", "dist/main"]
