import "dotenv/config";
import { Client } from "pg";
import { getProductionDatabaseConfig } from "../lib/database/database-env";
import { createPostgresSslConfig } from "../lib/database/postgres-ssl";

const main = async () => {
  const { host, port, database, user, password } = getProductionDatabaseConfig();

  if (!host || !password) {
    console.error("Database connection failed.");
    console.error(
      "Missing DATABASE_PRODUCTION_HOST/DATABASE_PRODUCTION_PASSWORD or legacy AWS_PG_HOST/AWS_PG_PASSWORD in backend/.env.",
    );
    process.exit(1);
  }

  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: createPostgresSslConfig(),
  });

  console.log(`Testing PostgreSQL connection to ${host}:${port}/${database} as ${user}...`);

  try {
    await client.connect();
    const result = await client.query("SELECT current_database() AS database, version()");

    console.log("Database connection succeeded.");
    console.log(`Connected database: ${result.rows[0].database}`);
    console.log(`PostgreSQL version: ${result.rows[0].version}`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    console.error("Database connection failed.");
    console.error(`Code: ${err.code ?? "UNKNOWN"}`);
    console.error(`Message: ${err.message}`);

    if (err.code === "ETIMEDOUT") {
      console.error("The RDS endpoint is reachable by DNS, but the network path to port 5432 is blocked or private.");
    }
  } finally {
    await client.end().catch(() => undefined);
  }
};

void main();
