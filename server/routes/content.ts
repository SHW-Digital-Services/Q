import express from 'express';
import { createHash } from 'node:crypto';
import { asyncHandler, sendOpaqueError } from '../middleware.js';
import { getServiceSupabase } from './admin.js';

export const contentRouter = express.Router();

const PUBLIC_COLUMNS = 'id,slug,title,summary,body,content_type,tags,hero_image_url,published_at,updated_at';

function toInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function hashContentApiToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function isMissingContentSchema(error: any) {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes('content_api_clients') || message.includes('content_posts');
}

function sendContentSchemaMissing(res: express.Response) {
  return res.status(503).json({
    error: 'Content publishing is not configured yet. Ask an admin to apply the content publishing Supabase migration.',
    code: 'CONTENT_PUBLISHING_NOT_CONFIGURED'
  });
}

function getPublisherToken(req: express.Request) {
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const header = req.header('x-q-content-api-key');
  return (bearer || header || '').trim();
}

function contentField(value: unknown, maximumLength: number, required = false): string | null | undefined {
  if (value === undefined || value === null) return required ? null : undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.length > maximumLength) return null;
  return trimmed || undefined;
}

function buildPublisherPost(body: any, clientId: string) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body must be a JSON object.' };
  const allowed = ['title', 'slug', 'summary', 'body', 'contentType', 'tags', 'heroImageUrl', 'publish'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return { error: 'Unexpected request fields.' };

  const title = contentField(body.title, 180, true);
  if (title === null || title.length < 3) return { error: 'Title must be between 3 and 180 characters.' };
  const summary = contentField(body.summary, 500, true);
  if (summary === null || summary.length < 10) return { error: 'Summary must be between 10 and 500 characters.' };
  const postBody = contentField(body.body, 20000, true);
  if (postBody === null || postBody.length < 20) return { error: 'Body must be between 20 and 20,000 characters.' };
  const slug = body.slug === undefined ? cleanSlug(title) : cleanSlug(String(body.slug));
  if (slug.length < 3) return { error: 'Slug must contain at least 3 URL-safe characters.' };
  const contentType = body.contentType === undefined ? 'update' : String(body.contentType);
  if (!['news', 'update'].includes(contentType)) return { error: 'Content type must be news or update.' };
  const heroImageUrl = contentField(body.heroImageUrl, 1000, false);
  if (heroImageUrl === null) return { error: 'Hero image URL is too long.' };
  if (heroImageUrl && !/^https?:\/\/|^\//i.test(heroImageUrl)) return { error: 'Hero image URL must be HTTPS or site-relative.' };
  if (body.tags !== undefined && !Array.isArray(body.tags)) return { error: 'Tags must be an array.' };
  const tagValues: string[] = Array.isArray(body.tags)
    ? body.tags.map((tag: unknown) => typeof tag === 'string' ? tag.trim().toLowerCase() : '').filter((tag: string) => Boolean(tag))
    : [];
  const tags = [...new Set<string>(tagValues)].slice(0, 12);
  if (tags.some((tag) => tag.length > 40)) return { error: 'Tags must be 40 characters or fewer.' };
  const status = body.publish === false ? 'draft' : 'published';

  return {
    payload: {
      title,
      slug,
      summary,
      body: postBody,
      content_type: contentType,
      tags,
      hero_image_url: heroImageUrl || null,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      source_api_client_id: clientId
    }
  };
}

contentRouter.get('/', asyncHandler(async (req, res) => {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return res.status(503).json({ error: 'Content is temporarily unavailable.' });

  const limit = toInteger(req.query.limit, 20, 1, 50);
  const type = String(req.query.type ?? '').trim();
  const search = String(req.query.q ?? '').trim();

  let query = serviceSupabase
    .from('content_posts')
    .select(PUBLIC_COLUMNS)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit);

  if (type && ['news', 'update'].includes(type)) query = query.eq('content_type', type);
  const searchQuery = search.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().split(/\s+/).filter(Boolean).join(' & ');
  if (searchQuery) query = query.textSearch('search_text', searchQuery);

  const { data, error } = await query;
  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to load published content.', 'Content List', error);
  }
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  return res.json({ posts: data ?? [] });
}));

contentRouter.post('/publish', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return res.status(503).json({ error: 'Content publishing is temporarily unavailable.' });

  const token = getPublisherToken(req);
  if (!token) return res.status(401).json({ error: 'A CRM-authorised content API token is required.' });

  const { data: client, error: clientError } = await serviceSupabase
    .from('content_api_clients')
    .select('id,name,active')
    .eq('token_hash', hashContentApiToken(token))
    .eq('active', true)
    .maybeSingle();

  if (clientError) {
    if (isMissingContentSchema(clientError)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to verify content API authorisation.', 'Content API Authorisation', clientError);
  }
  if (!client) return res.status(403).json({ error: 'This content API token is not authorised in the CRM.' });

  const parsed = buildPublisherPost(req.body, client.id);
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });

  const { data, error } = await serviceSupabase
    .from('content_posts')
    .insert(parsed.payload)
    .select(PUBLIC_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A post with that slug already exists.' });
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to publish content.', 'Content API Publish', error);
  }

  await serviceSupabase.from('content_api_clients').update({ last_used_at: new Date().toISOString() }).eq('id', client.id);
  return res.status(201).json({ post: data });
}));

contentRouter.get('/:slug', asyncHandler(async (req, res) => {
  const serviceSupabase = getServiceSupabase();
  if (!serviceSupabase) return res.status(503).json({ error: 'Content is temporarily unavailable.' });

  const slug = cleanSlug(String(req.params.slug ?? ''));
  if (!slug) return res.status(400).json({ error: 'Invalid content slug.' });

  const { data, error } = await serviceSupabase
    .from('content_posts')
    .select(PUBLIC_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    if (isMissingContentSchema(error)) return sendContentSchemaMissing(res);
    return sendOpaqueError(req, res, 500, 'Unable to load published content.', 'Content Detail', error);
  }
  if (!data) return res.status(404).json({ error: 'Content not found.' });
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  return res.json({ post: data });
}));
