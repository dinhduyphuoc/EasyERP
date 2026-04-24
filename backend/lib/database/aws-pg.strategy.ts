import AWS from "aws-sdk";
import type { DatabaseConnectionConfig, DatabaseConnectionStrategy } from "./database-connection.types";
import { createPostgresSslConfig } from "./postgres-ssl";

const DEFAULT_AWS_PG_REGION = "ap-southeast-2";
const DEFAULT_AWS_PG_HOST = "symmie.cdugogaq0sy7.ap-southeast-2.rds.amazonaws.com";
const DEFAULT_AWS_PG_PORT = 5432;
const DEFAULT_AWS_PG_DATABASE = "postgres";
const DEFAULT_AWS_PG_USER = "postgres";
const DEFAULT_AWS_PG_SCHEMA = "public";

export class AwsPostgresConnectionStrategy implements DatabaseConnectionStrategy {
  readonly name = "aws-pg" as const;

  createConfig(): DatabaseConnectionConfig {
    const region = process.env.AWS_PG_REGION ?? process.env.AWS_REGION ?? DEFAULT_AWS_PG_REGION;
    const host = process.env.AWS_PG_HOST ?? process.env.RDSHOST ?? DEFAULT_AWS_PG_HOST;
    const port = Number(process.env.AWS_PG_PORT ?? DEFAULT_AWS_PG_PORT);
    const database = process.env.AWS_PG_DATABASE ?? DEFAULT_AWS_PG_DATABASE;
    const user = process.env.AWS_PG_USER ?? DEFAULT_AWS_PG_USER;
    const schema = process.env.AWS_PG_SCHEMA ?? DEFAULT_AWS_PG_SCHEMA;
    const password = process.env.AWS_PG_PASSWORD;

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
