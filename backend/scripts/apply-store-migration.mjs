import 'dotenv/config'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const migrationPath = path.resolve(
  __dirname,
  '../prisma/migrations/20260426_store_management/migration.sql',
)
const defaultSslCaPaths = [
  path.resolve(__dirname, '../global-bundle.pem'),
  path.resolve(__dirname, '../../backend/global-bundle.pem'),
]

const databaseUrl =
  process.env.DATABASE_DEVELOPMENT_URL ??
  process.env.LOCAL_DATABASE_URL ??
  process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_DEVELOPMENT_URL, LOCAL_DATABASE_URL, or DATABASE_URL is not configured')
}

const getSslConfig = () => {
  const configuredPath =
    process.env.DATABASE_PRODUCTION_SSL_CA_PATH ??
    process.env.AWS_PG_SSL_CA_PATH ??
    process.env.PGSSLROOTCERT
  const candidatePaths = configuredPath
    ? [path.resolve(process.cwd(), configuredPath)]
    : defaultSslCaPaths
  const caPath = candidatePaths.find((candidate) => fsSync.existsSync(candidate))

  if (!caPath) {
    return { rejectUnauthorized: false }
  }

  return {
    rejectUnauthorized: true,
    ca: fsSync.readFileSync(caPath, 'utf8'),
  }
}

const sql = await fs.readFile(migrationPath, 'utf8')
const parsedUrl = new URL(databaseUrl)
const client = new Client({
  host: parsedUrl.hostname,
  port: Number(parsedUrl.port || 5432),
  database: parsedUrl.pathname.replace(/^\//, ''),
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  ssl: getSslConfig(),
})

try {
  await client.connect()
  await client.query('BEGIN')
  await client.query(sql)
  await client.query('COMMIT')
  console.log('Store management migration applied successfully.')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  await client.end()
}
