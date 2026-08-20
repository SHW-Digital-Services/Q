import express from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { redactPii } from '../../src/services/pii.js';
import { asyncHandler } from '../middleware.js';

export const aiRouter = express.Router();

const DEFAULT_FREE_MODEL = 'gpt-5-nano';
const DEFAULT_PAID_MODEL = 'gpt-5-mini';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (err) {
    console.warn('[AI] OpenAI init warning:', err);
    return null;
  }
}

function getAiSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (err) {
    console.warn('[AI] Supabase client init warning:', err);
    return null;
  }
}

aiRouter.use((req, _res, next) => {
  if (typeof req.body?.message === 'string') req.body.message = redactPii(req.body.message);
  next();
});

aiRouter.get('/health', (_req, res) => {
  res.json({ status: 'operational', aiEnabled: !!getOpenAIClient(), knowledgeBaseEnabled: !!getAiSupabaseClient() });
});

function getChatModel(tier: unknown) {
  if (tier === 'paid') {
    return process.env.AI_PAID_MODEL || DEFAULT_PAID_MODEL;
  }
  return process.env.AI_FREE_MODEL || DEFAULT_FREE_MODEL;
}

function buildChatPrompt(body: any) {
  const message = typeof body?.message === 'string' ? redactPii(body.message).trim() : '';
  const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];
  const userProfile = body?.userProfile && typeof body.userProfile === 'object' ? body.userProfile : {};
  const trustedItems = Array.isArray(body?.trustedKnowledge?.items) ? body.trustedKnowledge.items : [];

  const historyText = history
    .map((item: any) => {
      const sender = item?.sender === 'user' ? 'User' : 'Q';
      const text = typeof item?.text === 'string' ? redactPii(item.text).slice(0, 1200) : '';
      return text ? `${sender}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const profileText = [
    userProfile.pronouns ? `Pronouns: ${userProfile.pronouns}` : '',
    userProfile.locationRegion ? `Region: ${userProfile.locationRegion}` : '',
    userProfile.lifeStage ? `Life stage: ${userProfile.lifeStage}` : ''
  ].filter(Boolean).join('\n');

  const trustedText = trustedItems
    .map((item: any) => {
      const title = typeof item?.title === 'string' ? item.title : 'Vetted context';
      const summary = typeof item?.summary === 'string' ? item.summary : '';
      const source = typeof item?.source === 'string' ? item.source : 'Q vetted library';
      return summary ? `- ${title}: ${summary} (Source: ${source})` : '';
    })
    .filter(Boolean)
    .join('\n');

  return {
    message,
    prompt: [
      'You are Q Intelligence, a private, affirming AI life companion for LGBTQ+ users.',
      'Be warm, practical, concise, and safety-aware. Do not claim to be a doctor, lawyer, therapist, or emergency service.',
      'For legal, medical, safeguarding, or crisis topics, give general guidance, encourage verified local professional support, and avoid definitive diagnosis or legal conclusions.',
      'Use the vetted context when supplied. If the context is insufficient, say that clearly.',
      '',
      profileText ? `User profile context:\n${profileText}` : '',
      historyText ? `Recent conversation:\n${historyText}` : '',
      trustedText ? `Vetted context:\n${trustedText}` : '',
      `User message:\n${message}`,
      '',
      'Return a direct answer. Include short action steps only when useful.'
    ].filter(Boolean).join('\n')
  };
}

// POST /api/q-ai/chat
aiRouter.post('/chat', asyncHandler(async (req, res) => {
  const { message, prompt } = buildChatPrompt(req.body);
  if (!message) return res.status(400).json({ error: 'Valid message required.' });

  const openai = getOpenAIClient();
  if (!openai) return res.status(503).json({ error: 'AI chat model is not configured. Missing OPENAI_API_KEY.' });

  const model = getChatModel(req.body?.tier);

  try {
    const result = await openai.responses.create({
      model,
      input: prompt,
      max_output_tokens: 700
    });

    const reply = result.output_text?.trim();
    if (!reply) throw new Error('OpenAI returned an empty response.');

    return res.json({ reply, actionItems: [], model });
  } catch (error) {
    console.error('[Q-AI Chat Error]:', error);
    return res.status(500).json({ error: 'An error occurred while generating the response.' });
  }
}));

aiRouter.post('/query', asyncHandler(async (req, res) => {
  const query = typeof req.body?.query === 'string' ? redactPii(req.body.query).trim() : '';
  if (!query) return res.status(400).json({ error: 'Valid query string required.' });
  const openai = getOpenAIClient();
  const supabase = getAiSupabaseClient();
  if (!openai || !supabase) return res.status(503).json({ error: 'AI infrastructure not initialized.' });

  try {
    const result = await openai.embeddings.create({
      model: process.env.AI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
      input: query,
      dimensions: 768
    });
    const embedding = result.data?.[0]?.embedding;
    if (!embedding) throw new Error('Embedding was empty');

    const { data, error } = await supabase.rpc('match_vetted_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.65,
      match_count: 5
    });
    if (error) throw error;

    return res.json({ items: (data ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      summary: item.content,
      source: item.source,
      category: item.category
    })) });
  } catch (error) {
    console.error('[Q-AI Query Error]:', error);
    return res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
}));
