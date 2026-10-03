import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import express from 'express';
import { createPublisherStatusHandler } from '../server/contentPublisherStatus.js';
let state: 'active' | 'revoked' | 'error' | 'unavailable' = 'active';
const filters: [string, unknown][] = [];
const database = { from(table: string) {
  assert.equal(table, 'content_api_clients');
  return { select(columns: string) {
    assert.equal(columns, 'id,name,active');
    const query = { eq(column: string, value: unknown) { filters.push([column, value]); return query; }, async maybeSingle() { return { data: state === 'active' ? { id: 'client-id', name: 'Social Manager', active: true } : null, error: state === 'error' ? { message: 'PRIVATE_ERROR' } : null }; } };
    return query;
  } };
} };
const app = express();
app.get('/status', createPublisherStatusHandler(() => state === 'unavailable' ? null : database));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const url = `http://127.0.0.1:${(server.address() as any).port}/status`;
try {
  assert.equal((await fetch(url)).status, 401);
  const response = await fetch(url, { headers: { Authorization: 'Bearer test-content-token' } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); assert.equal(body.authorised, true); assert.equal(body.publicPath, '/news');
  assert.equal(JSON.stringify(body).includes('test-content-token'), false);
  assert.ok(filters.some(([key, value]) => key === 'token_hash' && value === createHash('sha256').update('test-content-token').digest('hex')));
  assert.ok(filters.some(([key, value]) => key === 'active' && value === true));
  assert.equal((await fetch(url, { headers: { Authorization: 'bEaReR    test-content-token' } })).status, 200);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer ' + ' '.repeat(8000) } })).status, 401);
  state = 'revoked'; assert.equal((await fetch(url, { headers: { 'x-q-content-api-key': 'revoked-token' } })).status, 403);
  state = 'error'; const failed = await fetch(url, { headers: { Authorization: 'Bearer test-content-token' } }); assert.equal(failed.status, 503); assert.equal((await failed.text()).includes('PRIVATE_ERROR'), false);
  state = 'unavailable'; assert.equal((await fetch(url, { headers: { Authorization: 'Bearer test-content-token' } })).status, 503);
  console.log('PASS: read-only publisher verification, missing/revoked credentials, hashed lookup, no token/error leakage, unavailable database');
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
