import type { DatabaseConnectionConfig, DatabaseConnectionStrategy } from "./database-connection.types";
import { createPostgresSslConfig } from "./postgres-ssl";

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
    const connectionString = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("LOCAL_DATABASE_URL or DATABASE_URL is required for local-pg connection");
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
