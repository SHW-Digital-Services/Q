import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import { postgresConnectionConfig } from '../server/postgresConnection';

for (const flag of ['sslmode=disable', 'sslmode=no-verify', 'ssl=no-verify', 'sslmode=require']) {
  const config = postgresConnectionConfig({ DATABASE_URL: `postgresql://demo:demo@db.example.com/postgres?${flag}` });
  const client = new Client(config);
  assert.equal((client as any).connectionParameters.ssl.rejectUnauthorized, true);
}
assert.equal(postgresConnectionConfig({ PGHOST: 'db.example.com', PGSSLMODE: 'disable' }).ssl &&
  (postgresConnectionConfig({ PGHOST: 'db.example.com', PGSSLMODE: 'disable' }).ssl as any).rejectUnauthorized, true);
assert.equal(postgresConnectionConfig({ DATABASE_URL: 'postgresql://demo@localhost/postgres' }).ssl, undefined);
assert.equal((postgresConnectionConfig({ PG_CONNECTION: 'postgresql://demo@db.example.com/postgres' }).ssl as any).rejectUnauthorized, true);
assert.throws(() => postgresConnectionConfig({ DATABASE_URL: 'postgresql://demo@db.example.com/postgres?sslkey=key.pem' }));

const caPath = path.join(os.tmpdir(), `q-ca-test-${process.pid}.crt`);
try {
  // Only test CA loading here; a real handshake must validate the actual certificate.
  fs.writeFileSync(caPath, 'test CA content');
  const config = postgresConnectionConfig({ PGHOST: 'db.example.com', DATABASE_SSL_CA_FILE: caPath });
  assert.equal((config.ssl as any).ca, 'test CA content');
  const url = new URL('postgresql://demo@db.example.com/postgres?sslmode=require');
  url.searchParams.set('sslrootcert', caPath);
  const client = new Client(postgresConnectionConfig({ DATABASE_URL: url.toString() }));
  assert.equal((client as any).connectionParameters.ssl.ca, 'test CA content');
  assert.equal((client as any).connectionParameters.ssl.rejectUnauthorized, true);
} finally {
  fs.unlinkSync(caPath);
}
assert.throws(() => postgresConnectionConfig({ PGHOST: 'db.example.com', DATABASE_SSL_CA_FILE: caPath }));
console.log('PostgreSQL TLS configuration checks passed.');
