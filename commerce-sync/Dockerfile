FROM node:20-bookworm-slim AS base
WORKDIR /workspace
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /workspace/backend
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig*.json ./
COPY backend/src ./src
RUN npm run build

FROM builder AS pruner
RUN npm prune --omit=dev

FROM base AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=pruner /workspace/backend/node_modules ./node_modules
COPY --from=pruner /workspace/backend/dist ./dist
CMD ["node", "dist/src/commerce-sync.main.js"]
