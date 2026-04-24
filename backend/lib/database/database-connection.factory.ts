import { PrismaPg } from "@prisma/adapter-pg";
import type { DatabaseConnectionName } from "./database-connection.types";
import { DatabaseConnectionRegistry } from "./database-connection.registry";
import { AwsPostgresConnectionStrategy } from "./aws-pg.strategy";
import { LocalPostgresConnectionStrategy } from "./local-pg.strategy";

const DEFAULT_CONNECTION_NAME: DatabaseConnectionName = "local-pg";

const databaseConnectionRegistry = new DatabaseConnectionRegistry()
  .register(new LocalPostgresConnectionStrategy())
  .register(new AwsPostgresConnectionStrategy());

const isDatabaseConnectionName = (value: string): value is DatabaseConnectionName => {
  return databaseConnectionRegistry.names().includes(value as DatabaseConnectionName);
};

export const getDatabaseConnectionName = (): DatabaseConnectionName => {
  const configuredName = process.env.DB_CONNECTION ?? DEFAULT_CONNECTION_NAME;

  if (!isDatabaseConnectionName(configuredName)) {
    throw new Error(
      `Unsupported DB_CONNECTION "${configuredName}". Supported values: ${databaseConnectionRegistry.names().join(", ")}`,
    );
  }

  return configuredName;
};

export const createPrismaPgAdapter = () => {
  const strategy = databaseConnectionRegistry.get(getDatabaseConnectionName());
  const config = strategy.createConfig();

  return new PrismaPg(config.poolConfig, config.prismaOptions);
};
