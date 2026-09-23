import express from 'express';
import { asyncHandler, getAuthenticatedUser } from '../middleware.js';
import { boundedString, requireExactObject } from '../security.js';
import { getServiceSupabase } from './admin.js';

export const peerKnowledgeRouter = express.Router();

function isMissingPeerKnowledgeSchema(error: any) {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes('peer_knowledge_posts');
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(tag => typeof tag === 'string' ? tag.trim().slice(0, 40) : '').filter(Boolean))].slice(0, 8);
}

peerKnowledgeRouter.get('/', asyncHandler(async (_req, res) => {
  const db = getServiceSupabase();
  if (!db) return res.json([]);
  const { data, error } = await db
    .from('peer_knowledge_posts')
    .select('id,title,author_alias,tags,category,content,advice_key_takeaways,upvotes,published_at')
    .eq('status', 'approved')
    .order('published_at', { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingPeerKnowledgeSchema(error)) return res.json([]);
    return res.status(503).json({ error: 'Peer Knowledge is temporarily unavailable.' });
  }
  return res.json((data ?? []).map((post: any) => ({
    id: post.id,
    title: post.title,
    authorAlias: post.author_alias,
    tags: post.tags ?? [],
    category: post.category,
    content: post.content,
    adviceKeyTakeaways: post.advice_key_takeaways ?? [],
    upvotes: post.upvotes ?? 0,
    savedOffline: false
  })));
}));

peerKnowledgeRouter.post('/', asyncHandler(async (req, res) => {
  if (!requireExactObject(req.body, ['title', 'authorAlias', 'tags', 'category', 'content', 'adviceKeyTakeaways', 'website'])) return res.status(400).json({ error: 'Unexpected request fields.' });
  if (req.body?.website) return res.status(202).json({ success: true });
  const title = boundedString(req.body?.title, 140, true);
  const authorAlias = boundedString(req.body?.authorAlias, 120, false) || 'Community Peer';
  const category = boundedString(req.body?.category, 80, true);
  const content = boundedString(req.body?.content, 5000, true);
  const adviceKeyTakeaways = Array.isArray(req.body?.adviceKeyTakeaways)
    ? req.body.adviceKeyTakeaways.map((item: unknown) => typeof item === 'string' ? item.trim().slice(0, 240) : '').filter(Boolean).slice(0, 5)
    : [];
  if (!title || title.length < 4) return res.status(400).json({ error: 'Title must be at least 4 characters.' });
  if (!category) return res.status(400).json({ error: 'Category is required.' });
  if (!content || content.length < 20) return res.status(400).json({ error: 'Reflection must be at least 20 characters.' });
  const db = getServiceSupabase();
  if (!db) return res.status(503).json({ error: 'Peer Knowledge submissions are temporarily unavailable.' });
  const identity = await getAuthenticatedUser(req).catch(() => null);
  const { data, error } = await db
    .from('peer_knowledge_posts')
    .insert({
      user_id: identity?.user?.id ?? null,
      title,
      author_alias: authorAlias,
      tags: cleanTags(req.body?.tags),
      category,
      content,
      advice_key_takeaways: adviceKeyTakeaways.length ? adviceKeyTakeaways : ['Submitted for staff moderation'],
      status: 'pending'
    })
    .select('id,status,created_at')
    .single();
  if (error) {
    if (isMissingPeerKnowledgeSchema(error)) return res.status(503).json({ error: 'Peer Knowledge moderation is not configured yet.' });
    return res.status(500).json({ error: 'Unable to submit this reflection for moderation.' });
  }
  return res.status(201).json({ success: true, submission: data });
}));
