import "dotenv/config";
import { Client } from "pg";
import { getDevelopmentDatabaseUrl } from "../lib/database/database-env";
import { createPostgresSslConfig } from "../lib/database/postgres-ssl";

const main = async () => {
  const databaseUrl = getDevelopmentDatabaseUrl();

  if (!databaseUrl) {
    console.error("Database connection failed.");
    console.error("Missing DATABASE_DEVELOPMENT_URL, LOCAL_DATABASE_URL, or DATABASE_URL in backend/.env.");
    process.exit(1);
  }

  const parsedUrl = new URL(databaseUrl);
  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || 5432);
  const database = parsedUrl.pathname.replace(/^\//, "");
  const user = decodeURIComponent(parsedUrl.username);
  const password = decodeURIComponent(parsedUrl.password);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: createPostgresSslConfig(databaseUrl),
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
  } finally {
    await client.end().catch(() => undefined);
  }
};

void main();
