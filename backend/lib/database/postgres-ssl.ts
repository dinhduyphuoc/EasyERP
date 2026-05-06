import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PoolConfig } from "pg";
import { getDatabaseSslCaPath } from "./database-env";

const DEFAULT_SSL_CA_PATHS = ["global-bundle.pem", "backend/global-bundle.pem"];

const getSslCaPath = (connectionString?: string) => {
  return getDatabaseSslCaPath(connectionString);
};

const parseSslMode = (connectionString?: string) => {
  if (!connectionString) {
    return undefined;
  }

  try {
    const url = new URL(connectionString);
    return url.searchParams.get("sslmode")?.trim().toLowerCase() ?? undefined;
  } catch {
    return undefined;
  }
};

const resolveExistingPath = (path?: string) => {
  const candidates = path ? [path] : DEFAULT_SSL_CA_PATHS;

  return candidates.map((candidate) => resolve(process.cwd(), candidate)).find(existsSync);
};

export const createPostgresSslConfig = (connectionString?: string): PoolConfig["ssl"] => {
  const sslMode = parseSslMode(connectionString);
  const explicitCaPath = getSslCaPath(connectionString);

  if (sslMode === "disable") {
    return false;
  }

  // Default to non-SSL unless the connection string or env explicitly opts in.
  // This keeps local Docker hosts like `db` working without pretending they support TLS.
  if (!sslMode && !explicitCaPath) {
    return false;
  }

  const caPath = resolveExistingPath(explicitCaPath);

  if (!caPath) {
    return { rejectUnauthorized: false };
  }

  return {
    rejectUnauthorized: true,
    ca: readFileSync(caPath).toString(),
  };
};
