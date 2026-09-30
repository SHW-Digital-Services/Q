import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { HELP_VIDEO_MAX_BYTES, helpVideoFile } from '../src/shared/helpVideoUpload';
import { HELP_VIDEO_STORAGE_BYTES, compressionArguments } from '../src/shared/videoCompression';
import { uploadHelpVideo } from '../src/services/helpVideoUpload';

assert.equal(helpVideoFile({ name: 'tutorial.mp4', type: 'video/mp4', size: HELP_VIDEO_MAX_BYTES }).error, '');
assert.match(helpVideoFile({ name: 'tutorial.mp4', type: 'video/mp4', size: HELP_VIDEO_MAX_BYTES + 1 }).error, /500 MB/);
assert.match(helpVideoFile({ name: 'tutorial.mov', type: 'video/quicktime', size: 100 }).error, /format/);
assert.match(helpVideoFile({ name: 'empty.mp4', type: 'video/mp4', size: 0 }).error, /empty/);
assert.equal(helpVideoFile({ name: 'tutorial.MP4', type: '', size: 200 * 1024 * 1024 }).contentType, 'video/mp4');
assert.equal(helpVideoFile({ name: 'tutorial.webm', type: 'application/octet-stream', size: 100 }).error, '');

assert.throws(() => compressionArguments(0), /duration/);
assert.throws(() => compressionArguments(100000), /too long/);
assert(compressionArguments(300).includes('libx264'));
const db = new PGlite();
await db.exec("create schema storage; create table storage.buckets (id text primary key, public boolean, file_size_limit bigint, allowed_mime_types text[]); insert into storage.buckets values ('help-videos',false,104857600,array['video/mp4']),('images',true,1048576,array['image/png']);");
await db.exec(await readFile('supabase/migrations/20260930031043_help_video_upload_50mb_limit.sql', 'utf8'));
const { rows } = await db.query<any>("select * from storage.buckets where id = 'help-videos'");
assert.equal(Number(rows[0].file_size_limit), HELP_VIDEO_STORAGE_BYTES); assert.equal(rows[0].public, false); assert.deepEqual(rows[0].allowed_mime_types, ['video/mp4']);
assert.equal(Number((await db.query<any>("select file_size_limit from storage.buckets where id = 'images'")).rows[0].file_size_limit), 1048576);
await db.close();

let offset = 0; let rejectLarge = false; let patchCount = 0;
const size = 8 * 1024 * 1024;
const server = http.createServer(async (req, res) => {
  assert.equal(req.headers['x-signature'], 'fixture-signed-admin-token');
  res.setHeader('Tus-Resumable', '1.0.0');
  if (rejectLarge) { req.resume(); res.writeHead(413); res.end(); return; }
  if (req.method === 'HEAD') { res.setHeader('Upload-Offset', String(offset)); res.setHeader('Upload-Length', String(size)); res.writeHead(200); res.end(); return; }
  if (req.method === 'POST') {
    assert.equal(Number(req.headers['upload-length']), size);
    assert(String(req.headers['upload-metadata']).includes('bucketName'));
  } else { patchCount++; assert.equal(Number(req.headers['upload-offset']), offset); }
  let bytes = 0; for await (const chunk of req) bytes += chunk.length;
  assert(bytes <= 6 * 1024 * 1024);
  offset += bytes;
  res.setHeader('Upload-Offset', String(offset));
  if (req.method === 'POST') res.setHeader('Location', '/upload/fixture');
  res.writeHead(req.method === 'POST' ? 201 : 204); res.end();
});
server.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address() as { port: number };
const config = { url: `http://127.0.0.1:${address.port}`, key: 'fixture-public-key', isConfigured: true };
try {
  const progress: number[] = [];
  await uploadHelpVideo(Buffer.alloc(size) as unknown as File, 'videos/fixture.mp4', 'fixture-signed-admin-token', 'video/mp4', value => progress.push(value), config);
  assert.equal(offset, size); assert(patchCount >= 1); assert(progress.includes(100));
  rejectLarge = true;
  await assert.rejects(uploadHelpVideo(Buffer.alloc(10) as unknown as File, 'videos/rejected.mp4', 'fixture-signed-admin-token', 'video/mp4', () => {}, config), error => error instanceof Error && error.message.includes('too large') && !error.message.includes('fixture-signed-admin-token'));
  console.log('PASS: 500 MB boundary, immediate format/size validation, isolated bucket migration, signed chunked upload, progress and safe storage-size errors. No hosted files were uploaded.');
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
