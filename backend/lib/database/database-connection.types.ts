import type { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";

export type DatabaseConnectionName = "local-pg" | "aws-pg";

export type PrismaPgOptions = NonNullable<ConstructorParameters<typeof PrismaPg>[1]>;

export type DatabaseConnectionConfig = {
  poolConfig: PoolConfig;
  prismaOptions?: PrismaPgOptions;
};

export interface DatabaseConnectionStrategy {
  readonly name: DatabaseConnectionName;
  createConfig(): DatabaseConnectionConfig;
}
