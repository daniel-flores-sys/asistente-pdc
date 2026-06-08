# ── Stage 1: Build ──────────────────────────────────────────────────────────
# Compila la app React en archivos estáticos optimizados.
FROM node:20-alpine AS builder

# corepack viene incluido en Node 16.13+ — lo usamos para activar pnpm
# sin necesidad de instalarlo por separado (más limpio y reproducible)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Instalar dependencias primero para aprovechar el caché de Docker:
# si package.json no cambia, esta capa no se reconstruye.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copiar el resto del código y compilar (genera /app/dist)
COPY . .
RUN pnpm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
# Imagen final: solo nginx + los archivos estáticos.
# Sin node_modules, sin código fuente — imagen ~25 MB.
FROM nginx:alpine AS runner

# Proxy /api/* → ms-orchestrator (reemplaza el proxy de Vite del modo dev)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el build de React desde el stage anterior
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
