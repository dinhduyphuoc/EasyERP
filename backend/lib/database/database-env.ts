export type DatabaseProfile = "development" | "production";

const DEFAULT_DATABASE_PROFILE: DatabaseProfile = "development";

const toOptionalTrimmedString = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const getDatabaseProfile = (): DatabaseProfile => {
  const configuredProfile = toOptionalTrimmedString(process.env.DATABASE_PROFILE);

  if (configuredProfile === "development" || configuredProfile === "production") {
    return configuredProfile;
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

export const getDatabaseSslCaPath = (connectionString?: string) => {
  const explicitPath =
    toOptionalTrimmedString(process.env.DATABASE_SSL_CA_PATH) ??
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
