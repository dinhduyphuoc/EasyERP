import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PoolConfig } from "pg";
import { getDatabaseSslCaPath } from "./database-env";

const DEFAULT_SSL_CA_PATHS = ["global-bundle.pem", "backend/global-bundle.pem"];

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

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

const isLocalConnectionString = (connectionString?: string) => {
  if (!connectionString) {
    return false;
  }

  try {
    const url = new URL(connectionString);
    return LOCALHOST_HOSTNAMES.has(url.hostname.trim().toLowerCase());
  } catch {
    return false;
  }
};

const resolveExistingPath = (path?: string) => {
  const candidates = path ? [path] : DEFAULT_SSL_CA_PATHS;

  return candidates.map((candidate) => resolve(process.cwd(), candidate)).find(existsSync);
};

export const createPostgresSslConfig = (connectionString?: string): PoolConfig["ssl"] => {
  const sslMode = parseSslMode(connectionString);

  if (sslMode === "disable") {
    return false;
  }

  if (isLocalConnectionString(connectionString)) {
    return false;
  }

  const caPath = resolveExistingPath(getSslCaPath(connectionString));

  if (!caPath) {
    return { rejectUnauthorized: false };
  }

  return {
    rejectUnauthorized: true,
    ca: readFileSync(caPath).toString(),
  };
};
