import express from 'express';
import { randomUUID } from 'node:crypto';
import { asyncHandler, sendOpaqueError } from '../middleware.js';
import { getServiceSupabase, requireAdmin } from './admin.js';
import { requireExactObject, isUuid } from '../security.js';

export const helpVideosRouter = express.Router();
export const helpVideosAdminRouter = express.Router();
const columns = 'id,title,steps,video_url,video_path,status,created_at,updated_at';
const extensions: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogg' };

async function playable(db: any, videos: any[]) {
  return Promise.all(videos.map(async (video) => {
    if (!video.video_path) return video;
    const { data, error } = await db.storage.from('help-videos').createSignedUrl(video.video_path, 3600);
    if (error) throw error;
    return { ...video, playback_url: data.signedUrl };
  }));
}

helpVideosRouter.get('/', asyncHandler(async (req, res) => {
  const db = getServiceSupabase();
  if (!db) return res.status(503).json({ error: 'Help Videos are temporarily unavailable.' });
  const { data, error } = await db.from('help_videos').select(columns).eq('status', 'published').order('created_at', { ascending: false });
  if (error) return sendOpaqueError(req, res, 503, 'Help Videos are not configured yet or are temporarily unavailable.', 'Help Videos', error);
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ videos: await playable(db, data ?? []) });
}));

helpVideosAdminRouter.use(asyncHandler(async (req, res, next) => {
  const ctx = await requireAdmin(req, res); if (!ctx) return;
  res.locals.helpVideoAdmin = ctx;
  res.setHeader('Cache-Control', 'no-store');
  next();
}));
helpVideosAdminRouter.get('/', asyncHandler(async (req, res) => {
  const { serviceSupabase: db } = res.locals.helpVideoAdmin;
  const { data, error } = await db.from('help_videos').select(columns).neq('status', 'archived').order('created_at', { ascending: false });
  if (error) return sendOpaqueError(req, res, 503, 'Help Videos are not configured yet or are temporarily unavailable.', 'Admin Help Videos', error);
  return res.json({ videos: await playable(db, data ?? []) });
}));
helpVideosAdminRouter.post('/upload', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['contentType', 'size']) || typeof req.body.contentType !== 'string' || !Object.hasOwn(extensions, req.body.contentType) || !Number.isInteger(req.body.size) || req.body.size < 1 || req.body.size > 104857600) return res.status(400).json({ error: 'Choose an MP4, WebM or Ogg video up to 100 MB.' });
  const { serviceSupabase: db } = res.locals.helpVideoAdmin;
  const path = `videos/${randomUUID()}.${extensions[req.body.contentType]}`;
  const { data, error } = await db.storage.from('help-videos').createSignedUploadUrl(path);
  if (error) return sendOpaqueError(req, res, 503, 'Unable to prepare video upload. Apply the Help Videos migration first.', 'Help Video Upload', error);
  return res.json({ path, token: data.token });
}));
helpVideosAdminRouter.post('/', asyncHandler(async (req, res) => {
  const body = req.body;
  if (!requireExactObject(body, ['title', 'steps', 'videoUrl', 'videoPath', 'status'])) return res.status(400).json({ error: 'Unexpected video fields.' });
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 3 || title.length > 180) return res.status(400).json({ error: 'Title must be between 3 and 180 characters.' });
  if (!Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > 50 || body.steps.some((step: unknown) => typeof step !== 'string' || !step.trim() || step.trim().length > 2000)) return res.status(400).json({ error: 'Add 1–50 non-empty steps, up to 2,000 characters each.' });
  if (!['draft', 'published'].includes(body.status)) return res.status(400).json({ error: 'Choose draft or published.' });
  if (Boolean(body.videoUrl) === Boolean(body.videoPath)) return res.status(400).json({ error: 'Upload a video or supply a hosted HTTPS link.' });
  if (body.videoUrl) {
    if (typeof body.videoUrl !== 'string') return res.status(400).json({ error: 'Use a valid HTTPS video link.' });
    try { const url = new URL(body.videoUrl); if (url.protocol !== 'https:' || url.username || url.password || body.videoUrl.length > 2000) throw new Error(); }
    catch { return res.status(400).json({ error: 'Use a valid HTTPS video link without credentials.' }); }
  }
  const { serviceSupabase: db, identity } = res.locals.helpVideoAdmin;
  if (body.videoPath) {
    if (typeof body.videoPath !== 'string' || !/^videos\/[0-9a-f-]+\.(mp4|webm|ogg)$/.test(body.videoPath)) return res.status(400).json({ error: 'Invalid uploaded video path.' });
    const name = body.videoPath.slice(7);
    const { data, error } = await db.storage.from('help-videos').list('videos', { search: name, limit: 10 });
    if (error || !data?.some((file: any) => file.name === name)) return res.status(400).json({ error: 'Finish uploading the video before saving.' });
  }
  const { data, error } = await db.from('help_videos').insert({ title, steps: body.steps.map((step: string) => step.trim()), video_url: body.videoUrl || null, video_path: body.videoPath || null, status: body.status, created_by: identity.user.id, updated_by: identity.user.id }).select(columns).single();
  if (error) return sendOpaqueError(req, res, 500, 'Unable to save Help Video.', 'Help Video Save', error);
  return res.status(201).json({ video: data });
}));
helpVideosAdminRouter.patch('/:id', asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id) || !requireExactObject(req.body, ['status']) || !['draft', 'published', 'archived'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid video or status.' });
  const { serviceSupabase: db, identity } = res.locals.helpVideoAdmin;
  const { data, error } = await db.from('help_videos').update({ status: req.body.status, updated_by: identity.user.id, updated_at: new Date().toISOString() }).eq('id', req.params.id).select(columns).maybeSingle();
  if (error) return sendOpaqueError(req, res, 500, 'Unable to update Help Video.', 'Help Video Update', error);
  if (!data) return res.status(404).json({ error: 'Help Video not found.' });
  return res.json({ video: data });
}));
