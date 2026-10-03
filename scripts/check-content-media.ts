import assert from 'node:assert/strict';
import { createPublisherMediaHandler } from '../server/contentPublisherMedia.js';
let authorised = true, uploads = 0;
const db = {
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: authorised ? { id: 'client-1', active: true } : null }) }) }) }) }),
  storage: {
    getBucket: async () => ({ data: { public: true } }),
    from: () => ({ upload: async (_path: string, bytes: Buffer) => { assert.ok(Buffer.isBuffer(bytes)); uploads++; return {}; }, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/content-media/${path}` } }) })
  }
};
const handler = createPublisherMediaHandler(() => db);
async function request(bytes: Buffer, token = 'qcp_test') {
  let status = 200, data: any;
  const req = { headers: { authorization: token ? `Bearer ${token}` : '' }, body: bytes, get: () => 'image/png' } as any;
  const res = { setHeader: () => {}, status: (value: number) => { status = value; return res; }, json: (value: any) => { data = value; return res; } } as any;
  await handler(req, res);
  return { status, data };
}
const png = Buffer.from('89504e470d0a1a0a', 'hex');
assert.equal((await request(png, '')).status, 401);
authorised = false; assert.equal((await request(png)).status, 403); assert.equal(uploads, 0);
authorised = true; assert.equal((await request(Buffer.from('invalid'))).status, 400);
const result = await request(png); assert.equal(result.status, 201); assert.match(result.data.url, /client-1/); assert.equal(uploads, 1);
console.log('Publisher image authorisation, image validation and upload checks passed.');
