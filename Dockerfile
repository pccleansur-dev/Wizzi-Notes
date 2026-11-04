# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Tools para detección de hardware
RUN apk add --no-cache pciutils

# Copiamos el build del frontend y el servidor compilado
COPY --from=builder /app/dist ./dist

# Directorio para las keys (sobreescrito por el volumen en docker-compose)
RUN mkdir -p /app/config

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
