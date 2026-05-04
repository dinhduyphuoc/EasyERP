export type DatabaseProfile = "development" | "production";

const DEFAULT_DATABASE_PROFILE: DatabaseProfile = "development";

const LEGACY_CONNECTION_TO_PROFILE: Record<string, DatabaseProfile> = {
  "local-pg": "development",
  "aws-pg": "production",
};

const toOptionalTrimmedString = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const getDatabaseProfile = (): DatabaseProfile => {
  const configuredProfile = toOptionalTrimmedString(process.env.DATABASE_PROFILE);

  if (configuredProfile === "development" || configuredProfile === "production") {
    return configuredProfile;
  }

  const legacyConnectionName = toOptionalTrimmedString(process.env.DB_CONNECTION);

  if (legacyConnectionName && legacyConnectionName in LEGACY_CONNECTION_TO_PROFILE) {
    return LEGACY_CONNECTION_TO_PROFILE[legacyConnectionName];
  }

  return DEFAULT_DATABASE_PROFILE;
};

export const getDevelopmentDatabaseUrl = () =>
  toOptionalTrimmedString(process.env.DATABASE_DEVELOPMENT_URL) ??
  toOptionalTrimmedString(process.env.LOCAL_DATABASE_URL) ??
  toOptionalTrimmedString(process.env.DATABASE_URL);

export const getDevelopmentShadowDatabaseUrl = () =>
  toOptionalTrimmedString(process.env.DATABASE_DEVELOPMENT_SHADOW_URL) ??
  toOptionalTrimmedString(process.env.SHADOW_DATABASE_URL);

export const getProductionDatabaseConfig = () => ({
  region:
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_REGION) ??
    toOptionalTrimmedString(process.env.AWS_PG_REGION) ??
    toOptionalTrimmedString(process.env.AWS_REGION),
  host:
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_HOST) ??
    toOptionalTrimmedString(process.env.AWS_PG_HOST) ??
    toOptionalTrimmedString(process.env.RDSHOST),
  port: Number(
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_PORT) ??
    toOptionalTrimmedString(process.env.AWS_PG_PORT) ??
    5432,
  ),
  database:
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_NAME) ??
    toOptionalTrimmedString(process.env.AWS_PG_DATABASE) ??
    "postgres",
  user:
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_USER) ??
    toOptionalTrimmedString(process.env.AWS_PG_USER) ??
    "postgres",
  schema:
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_SCHEMA) ??
    toOptionalTrimmedString(process.env.AWS_PG_SCHEMA) ??
    "public",
  password:
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_PASSWORD) ??
    toOptionalTrimmedString(process.env.AWS_PG_PASSWORD),
});

export const getDatabaseSslCaPath = (connectionString?: string) => {
  const explicitPath =
    toOptionalTrimmedString(process.env.DATABASE_PRODUCTION_SSL_CA_PATH) ??
    toOptionalTrimmedString(process.env.AWS_PG_SSL_CA_PATH) ??
    toOptionalTrimmedString(process.env.PGSSLROOTCERT);

  if (explicitPath) {
    return explicitPath;
  }

  if (!connectionString) {
    return undefined;
  }

  try {
    const url = new URL(connectionString);
    return url.searchParams.get("sslrootcert") ?? undefined;
  } catch {
    return undefined;
  }
};
