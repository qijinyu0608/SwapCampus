FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM builder AS pruner
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
COPY --from=pruner /app/node_modules ./node_modules
COPY --from=pruner /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
