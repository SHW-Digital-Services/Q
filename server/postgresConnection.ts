import fs from 'node:fs';
import type { ClientConfig } from 'pg';

/** Remote database connections always require certificate-verified TLS. */
export function postgresConnectionConfig(env: NodeJS.ProcessEnv = process.env): ClientConfig {
  const rawUrl = env.DATABASE_URL || env.PG_CONNECTION;
  const url = rawUrl ? new URL(rawUrl) : undefined;
  const host = url?.searchParams.get('host') || url?.hostname || env.PGHOST || 'localhost';
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  if (local) return { connectionString: rawUrl };

  if (url?.searchParams.has('sslcert') || url?.searchParams.has('sslkey')) {
    throw new Error('Client certificate URL options are unsupported; use DATABASE_SSL_CA_FILE for the database CA certificate.');
  }
  const caFile = env.DATABASE_SSL_CA_FILE || url?.searchParams.get('sslrootcert');
  // pg URL SSL options override the explicit ssl object, so remove them first.
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'uselibpqcompat']) url?.searchParams.delete(key);
  return {
    connectionString: url?.toString(),
    ssl: { rejectUnauthorized: true, ...(caFile ? { ca: fs.readFileSync(caFile, 'utf8') } : {}) },
  };
}
