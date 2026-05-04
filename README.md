# EasyERP

## Docker

Copy `.env.docker.example` to `.env` if you want to override the default Docker values.

### Database envs

Backend now uses environment names grouped by runtime profile:

- `DATABASE_PROFILE`
- `DATABASE_DEVELOPMENT_URL`
- `DATABASE_DEVELOPMENT_SHADOW_URL`
- `DATABASE_PRODUCTION_REGION`
- `DATABASE_PRODUCTION_HOST`
- `DATABASE_PRODUCTION_PORT`
- `DATABASE_PRODUCTION_NAME`
- `DATABASE_PRODUCTION_USER`
- `DATABASE_PRODUCTION_PASSWORD`
- `DATABASE_PRODUCTION_SCHEMA`

The old envs still work as fallbacks for now:

- `DB_CONNECTION`
- `LOCAL_DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `AWS_PG_*`
- `DATABASE_URL`

### Development

Runs:
- `postgres`
- `redis`
- `backend` with hot reload via `tsx watch`
- `frontend` with Vite hot reload

```bash
docker compose --profile dev up --build
```

URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Postgres: `localhost:5432`

### Production

Runs:
- `postgres`
- `redis`
- `backend` in normal runtime mode
- `frontend` as static assets served by `nginx`

```bash
docker compose --profile prod up --build -d
```

URLs:
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3001`

### Notes

- Dev profile auto-runs `prisma db push` on startup for convenience.
- Prod profile does **not** auto-run `db push` unless you set `AUTO_DB_PUSH=true`.
- Backend cache uses Redis automatically when `REDIS_URL` is set, and falls back to in-memory cache if Redis is unavailable.
- If you want a clean database, remove `./db-data` before starting again.
- For local development outside Docker, point `DATABASE_PROFILE=development` to `DATABASE_DEVELOPMENT_URL`.
- For production or remote database access, switch to `DATABASE_PROFILE=production` and configure `DATABASE_PRODUCTION_*`.
