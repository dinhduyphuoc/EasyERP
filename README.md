# EasyERP

## Docker

Use:

- `.env.dev` with `compose.yaml + compose.dev.yaml`
- `.env.prod` with `compose.yaml + compose.prod.yaml`

Both development and production now run with:

- local PostgreSQL in Docker with a named volume
- Redis in Docker
- backend Node service
- frontend static app or Vite dev server depending on the profile

### Development

Runs:
- `postgres`
- `redis`
- `backend` with hot reload via `tsx watch`
- `frontend` with Vite hot reload

```bash
docker compose --env-file .env.dev -f compose.yaml -f compose.dev.yaml up --build
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
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml pull
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml up -d
```

First bootstrap only:

```bash
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml -f compose.prod.bootstrap.yaml up -d
```

URLs:
- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3001`

### Notes

- Dev can auto-run `prisma db push` if you set `AUTO_DB_PUSH=true`.
- Prod does not run `db push`.
- Prod should keep `RUN_DB_MIGRATIONS=false` and `RUN_DB_SEED=false` during normal runtime.
- Use `compose.prod.bootstrap.yaml` only for the first bootstrap or controlled schema rollout.
- Backend cache uses Redis automatically when `REDIS_URL` is set, and falls back to in-memory cache if Redis is unavailable.
- If you want a clean local database, remove the `postgres_data` volume.
- For local runs outside Docker, point `DATABASE_URL` to your local PostgreSQL instance.

### Environment checklist

Before running the stack, review these values in `.env.dev` or `.env.prod`:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URL`, `SHADOW_DATABASE_URL`
- `CORS_ORIGIN` and `PROD_CORS_ORIGIN`
- `EASYERP_BACKEND_IMAGE`, `EASYERP_FRONTEND_IMAGE`
- `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_S3_BUCKET` if S3 upload is used
- `VIETQR_CLIENT_ID`, `VIETQR_API_KEY` if VietQR is used
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`

### Minimum values to fill

For development, these are usually enough:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `VITE_API_URL`

For production, review all of the above and make sure you also change:

- `EASYERP_BACKEND_IMAGE` to the Docker registry tag you deploy
- `EASYERP_FRONTEND_IMAGE` to the Docker registry tag you deploy
- `POSTGRES_PASSWORD`
- `CORS_ORIGIN` and `PROD_CORS_ORIGIN` to the public frontend URL
- `SUPER_ADMIN_PASSWORD`

Only fill these when the feature is enabled:

- `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_S3_BUCKET` for S3 upload
- `VIETQR_CLIENT_ID`, `VIETQR_API_KEY` for VietQR

### Publish images

Build and push production images to Docker Hub:

```powershell
.\scripts\publish-images.ps1 -Registry yourdockerhub -Tag 2026-05-05 -ApiUrl https://api.example.com -Push
```

Then update `.env.prod`:

```env
EASYERP_BACKEND_IMAGE=yourdockerhub/easyerp-backend:2026-05-05
EASYERP_FRONTEND_IMAGE=yourdockerhub/easyerp-frontend:2026-05-05
```

And deploy:

```bash
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml pull
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml up -d
```

For first bootstrap only:

```bash
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml -f compose.prod.bootstrap.yaml up -d
```

Note:
- `VITE_API_URL` is baked into the frontend image at build time.
- If your public backend URL changes, rebuild and push the frontend image again.
