import express from 'express';
import { asyncHandler } from '../middleware.js';
import { getServiceSupabase } from './admin.js';

export const lifeGuidesRouter = express.Router();

lifeGuidesRouter.get('/', asyncHandler(async (_req, res) => {
  const db = getServiceSupabase();
  if (!db) return res.json([]);
  const { data, error } = await db
    .from('life_guides')
    .select('id,title,category,summary,steps,key_contacts_or_links,updated_at,published_at')
    .eq('status', 'published')
    .order('title', { ascending: true })
    .limit(250);
  if (error) {
    const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
    if (error.code === '42P01' || error.code === 'PGRST205' || message.includes('life_guides')) return res.json([]);
    return res.status(503).json({ error: 'Life Guides are temporarily unavailable.' });
  }
  return res.json((data ?? []).map((guide: any) => ({
    id: guide.id,
    title: guide.title,
    category: guide.category,
    summary: guide.summary,
    steps: (guide.steps ?? []).map((step: any) => ({ id: step.id, text: step.text, completed: false })),
    keyContactsOrLinks: guide.key_contacts_or_links ?? undefined,
    savedOffline: false,
    updatedAt: guide.updated_at
  })));
}));
