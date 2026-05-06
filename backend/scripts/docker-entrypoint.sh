#!/bin/sh
set -eu

if [ "${RUN_PRISMA_GENERATE:-false}" = "true" ]; then
  echo "Generating Prisma client..."
  npx prisma generate
fi

if [ "${RUN_DB_PUSH:-false}" = "true" ]; then
  echo "Applying schema with prisma db push..."
  npm run db:push
fi

if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "Running core seed..."
  if [ "${NODE_ENV:-development}" = "production" ]; then
    npm run seed:prod
  else
    npm run seed
  fi
fi

if [ -n "${BACKEND_START_COMMAND:-}" ]; then
  exec sh -c "${BACKEND_START_COMMAND}"
fi

if [ "${NODE_ENV:-development}" = "production" ]; then
  exec npm run start
fi

exec npm run dev
