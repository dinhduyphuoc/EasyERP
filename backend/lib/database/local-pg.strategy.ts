import type { DatabaseConnectionConfig, DatabaseConnectionStrategy } from "./database-connection.types";
import { createPostgresSslConfig } from "./postgres-ssl";
import { getDevelopmentDatabaseUrl } from "./database-env";

const getSchemaFromUrl = (connectionString: string) => {
  try {
    const url = new URL(connectionString);
    return url.searchParams.get("schema") ?? undefined;
  } catch {
    return undefined;
  }
};

export class LocalPostgresConnectionStrategy implements DatabaseConnectionStrategy {
  readonly name = "local-pg" as const;

  createConfig(): DatabaseConnectionConfig {
    const connectionString = getDevelopmentDatabaseUrl();

    if (!connectionString) {
      throw new Error(
        "DATABASE_DEVELOPMENT_URL, LOCAL_DATABASE_URL, or DATABASE_URL is required for the development database connection",
      );
    }

    return {
      poolConfig: {
        connectionString,
        ssl: createPostgresSslConfig(connectionString),
      },
      prismaOptions: {
        schema: getSchemaFromUrl(connectionString),
      },
    };
  }
}
