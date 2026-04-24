import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PoolConfig } from "pg";

const DEFAULT_SSL_CA_PATHS = ["global-bundle.pem", "backend/global-bundle.pem"];

const getSslCaPath = (connectionString?: string) => {
  const configuredPath = process.env.AWS_PG_SSL_CA_PATH ?? process.env.PGSSLROOTCERT;

  if (configuredPath) {
    return configuredPath;
  }

  if (connectionString) {
    try {
      const url = new URL(connectionString);
      return url.searchParams.get("sslrootcert") ?? undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
};

const resolveExistingPath = (path?: string) => {
  const candidates = path ? [path] : DEFAULT_SSL_CA_PATHS;

  return candidates.map((candidate) => resolve(process.cwd(), candidate)).find(existsSync);
};

export const createPostgresSslConfig = (connectionString?: string): PoolConfig["ssl"] => {
  const caPath = resolveExistingPath(getSslCaPath(connectionString));

  if (!caPath) {
    return { rejectUnauthorized: false };
  }

  return {
    rejectUnauthorized: true,
    ca: readFileSync(caPath).toString(),
  };
};
