# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json tsconfig*.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Stage 2: Production Runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY scripts/health_check.js ./scripts/health_check.js

# Run as non-root unprivileged user
USER node

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD node scripts/health_check.js

CMD ["node", "dist/server.js"]
