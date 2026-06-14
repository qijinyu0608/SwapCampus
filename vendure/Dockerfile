FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS builder
COPY tsconfig*.json ./
COPY vite.config.mts ./
COPY src ./src
COPY static ./static
RUN npm run build
RUN npm run build:dashboard
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN mkdir -p /app/data
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static ./static
EXPOSE 3000
CMD ["node", "./dist/index.js"]
