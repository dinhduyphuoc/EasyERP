# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci \
  && npx prisma generate

FROM deps AS development
ENV NODE_ENV=development
COPY . .
RUN chmod +x /app/scripts/docker-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--", "/app/scripts/docker-entrypoint.sh"]

FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM base AS production
WORKDIR /app
RUN groupadd --system nodejs \
  && useradd --system --gid nodejs --create-home nodeuser
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/lib/database ./lib/database
COPY --from=build /app/global-bundle.pem ./global-bundle.pem
RUN chmod +x /app/scripts/docker-entrypoint.sh \
  && chown -R nodeuser:nodejs /app
USER nodeuser
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--", "/app/scripts/docker-entrypoint.sh"]
