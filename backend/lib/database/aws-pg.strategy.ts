import AWS from "aws-sdk";
import type { DatabaseConnectionConfig, DatabaseConnectionStrategy } from "./database-connection.types";
import { createPostgresSslConfig } from "./postgres-ssl";
import { getProductionDatabaseConfig } from "./database-env";

export class AwsPostgresConnectionStrategy implements DatabaseConnectionStrategy {
  readonly name = "aws-pg" as const;

  createConfig(): DatabaseConnectionConfig {
    const {
      region = "ap-southeast-2",
      host,
      port,
      database,
      user,
      schema,
      password,
    } = getProductionDatabaseConfig();

    if (!host) {
      throw new Error(
        "DATABASE_PRODUCTION_HOST, AWS_PG_HOST, or RDSHOST is required for the production database connection",
      );
    }

    AWS.config.update({ region });

    const signer = new AWS.RDS.Signer({
      region,
      hostname: host,
      port,
      username: user,
    });

    return {
      poolConfig: {
        host,
        port,
        database,
        user,
        password: password ?? (() => signer.getAuthToken({})),
        ssl: createPostgresSslConfig(),
      },
      prismaOptions: { schema },
    };
  }
}
