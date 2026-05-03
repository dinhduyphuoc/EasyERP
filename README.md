# EasyERP

## Docker

Copy `.env.docker.example` to `.env` if you want to override the default Docker values.

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
