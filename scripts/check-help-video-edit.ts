import assert from 'node:assert/strict';
import express from 'express';
import { helpVideosAdminRouter } from '../server/routes/helpVideos';

const id = '00000000-0000-4000-8000-000000000001';
let role = 'partner_admin';
let row: any = { id, title: 'Original tutorial', steps: ['Original step'], video_url: 'https://example.com/old.mp4', video_path: null, status: 'draft', created_by: id };
let updates = 0;
const uploadedPath = `videos/${id}.mp4`;
const mock = express(); mock.use(express.json());
mock.get('/auth/v1/user', (_req, res) => res.json({ id, aud: 'authenticated', role: 'authenticated' }));
mock.get('/rest/v1/profiles', (_req, res) => res.json([{ role, staff_permissions: [] }]));
mock.post('/rest/v1/security_events', (_req, res) => res.status(201).json({}));
mock.post('/storage/v1/object/list/help-videos', (_req, res) => res.json([{ name: `${id}.mp4` }]));
mock.patch('/rest/v1/help_videos', (req, res) => {
  if (req.query.id !== `eq.${id}`) { res.json(null); return; }
  updates++;
  assert.equal(req.query.id, `eq.${id}`);
  assert.equal(req.body.created_by, undefined);
  row = { ...row, ...req.body };
  res.json(row);
});
const upstream = mock.listen(0, '127.0.0.1');
await new Promise<void>(resolve => upstream.once('listening', resolve));
process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${(upstream.address() as { port: number }).port}`;
process.env.VITE_SUPABASE_ANON_KEY = 'fixture-anon'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service';
const app = express(); app.use(express.json()); app.use('/videos', helpVideosAdminRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/videos/${id}`;
const body = { title: 'Edited tutorial', steps: [' Updated first step ', 'New second step'], videoUrl: 'https://example.com/new.mp4', videoPath: null, status: 'published' };
const request = (value: unknown = body, auth = true) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer fixture-session' } : {}) }, body: JSON.stringify(value) });
try {
  assert.equal((await request(body, false)).status, 401);
  role = 'staff'; assert.equal((await request()).status, 403); role = 'partner_admin';
  assert.equal((await request({ ...body, title: 'x' })).status, 400);
  assert.equal((await request({ ...body, steps: [''] })).status, 400);
  assert.equal((await request({ ...body, videoUrl: 'http://example.com/video.mp4' })).status, 400);
  assert.equal((await request({ ...body, created_by: 'other' })).status, 400);
  assert.equal(updates, 0);
  const response = await request(); assert.equal(response.status, 200);
  const result = (await response.json()).video;
  assert.equal(result.id, id); assert.equal(result.title, body.title);
  assert.deepEqual(result.steps, ['Updated first step', 'New second step']);
  assert.equal(result.video_url, body.videoUrl); assert.equal(result.status, 'published');
  assert.equal(result.created_by, id); assert.equal(result.updated_by, id); assert.equal(updates, 1);
  const uploaded = await request({ ...body, videoUrl: null, videoPath: uploadedPath }); assert.equal(uploaded.status, 200);
  assert.equal((await uploaded.json()).video.video_path, uploadedPath);
  const retained = await request({ ...body, title: 'Edited uploaded tutorial', videoUrl: null, videoPath: uploadedPath }); assert.equal(retained.status, 200);
  assert.equal((await retained.json()).video.video_path, uploadedPath);
  assert.equal((await request({ ...body, videoUrl: null, videoPath: `videos/00000000-0000-4000-8000-000000000099.mp4` })).status, 400);
  const missing = await fetch(url.replace(id, '00000000-0000-4000-8000-000000000099'), { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-session' }, body: JSON.stringify(body) });
  assert.equal(missing.status, 404);
  console.log('PASS: protected admin editing updates the existing tutorial, preserves ownership, trims steps, changes source/visibility, and rejects invalid inputs. No hosted records changed.');
} finally {
  await Promise.all([new Promise<void>(resolve => server.close(() => resolve())), new Promise<void>(resolve => upstream.close(() => resolve()))]);
}
