FROM node:22-bookworm-slim AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3001

FROM base AS dev
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

FROM base AS prod
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
