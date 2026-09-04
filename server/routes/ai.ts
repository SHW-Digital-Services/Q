import express from 'express';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { redactPii } from '../../src/services/pii.js';
import { asyncHandler, getAuthenticatedUser, sendOpaqueError } from '../middleware.js';
import { crisisDirectory, globalFallback } from '../../src/data/crisisHelplines.js';
import { hasCrisisIntent } from '../../src/services/crisisDetection.js';

export const aiRouter = express.Router();

const DEFAULT_FREE_MODEL = 'gpt-5-nano';
const DEFAULT_PAID_MODEL = 'gpt-5-mini';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_MESSAGE_CHARACTERS = 8_000;
const MAX_OUTPUT_TOKENS = 500;
export function checkCrisisTrigger(message: string, countryCode = 'GB') {
  if (!hasCrisisIntent(message)) return { isCrisis: false as const };
  const normalizedCountry = countryCode.trim().toUpperCase();
  const helplines = crisisDirectory[normalizedCountry] || globalFallback;
  return { isCrisis: true as const, country: helplines.countryCode, message: "It sounds like you're going through a really difficult time. Support is available right now.", action: 'TRIGGER_CRISIS_MODAL' as const, helplines };
}

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

function getProviderError(error: any) {
  const status = typeof error?.status === 'number' ? error.status : 500;
  const code = typeof error?.code === 'string' ? error.code : undefined;
  const type = typeof error?.type === 'string' ? error.type : undefined;
  const message = typeof error?.message === 'string'
    ? error.message
    : 'The AI provider rejected the request.';

  return {
    status,
    detail: [code, type, message].filter(Boolean).join(': ')
  };
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
  if (message.length > MAX_MESSAGE_CHARACTERS) return res.status(413).json({ error: `Hosted AI messages are limited to ${MAX_MESSAGE_CHARACTERS.toLocaleString()} characters.` });

  const requestedCountry = typeof req.body?.countryCode === 'string' ? req.body.countryCode : 'GLOBAL';
  const crisis = checkCrisisTrigger(message, requestedCountry);
  if (crisis.isCrisis) return res.json({ reply: crisis.message, actionItems: [], ...crisis });

  const identity = await getAuthenticatedUser(req);
  if (!identity) return res.status(401).json({ error: 'Sign in to use hosted AI, or select private local AI.' });
  const allowanceResult = await identity.authClient.rpc('consume_hosted_ai_allowance');
  if (allowanceResult.error) {
    console.error('[Q-AI Allowance Error]:', allowanceResult.error.message);
    return res.status(503).json({ error: 'Hosted AI usage controls are not available. Please use private local AI.' });
  }
  const allowance = Array.isArray(allowanceResult.data) ? allowanceResult.data[0] : allowanceResult.data;
  if (!allowance?.allowed) {
    if (allowance?.tier === 'local_only') {
      return res.status(403).json({ error: 'Hosted AI requires an active subscription. Private local AI remains available.', usage: allowance });
    }
    res.setHeader('Retry-After', allowance?.minute_remaining === 0 ? '60' : '3600');
    return res.status(429).json({ error: 'Hosted AI usage limit reached. Private local AI remains available.', usage: allowance });
  }

  const openai = getOpenAIClient();
  if (!openai) return res.status(503).json({ error: 'AI chat model is not configured. Missing OPENAI_API_KEY.' });

  const model = getChatModel(allowance.tier);

  try {
    const result = await openai.responses.create({
      model,
      input: prompt,
      max_output_tokens: MAX_OUTPUT_TOKENS
    });

    const reply = result.output_text?.trim();
    if (!reply) throw new Error('OpenAI returned an empty response.');

    return res.json({ reply, actionItems: [], model, processing: 'hosted', usage: allowance });
  } catch (error) {
    const providerError = getProviderError(error);
    return sendOpaqueError(req, res, providerError.status >= 400 && providerError.status < 500 ? 502 : 500, 'An error occurred while generating the response.', 'Q-AI Chat', {
      status: providerError.status,
      model,
      detail: providerError.detail
    });
  }
}));

aiRouter.post('/query', asyncHandler(async (req, res) => {
  const query = typeof req.body?.query === 'string' ? redactPii(req.body.query).trim() : '';
  if (!query) return res.status(400).json({ error: 'Valid query string required.' });
  if (query.length > MAX_MESSAGE_CHARACTERS) return res.status(413).json({ error: `Hosted AI queries are limited to ${MAX_MESSAGE_CHARACTERS.toLocaleString()} characters.` });
  const identity = await getAuthenticatedUser(req);
  if (!identity) return res.status(401).json({ error: 'Sign in to use hosted AI knowledge search.' });
  const allowanceResult = await identity.authClient.rpc('consume_hosted_ai_allowance');
  if (allowanceResult.error) return res.status(503).json({ error: 'Hosted AI usage controls are not available.' });
  const allowance = Array.isArray(allowanceResult.data) ? allowanceResult.data[0] : allowanceResult.data;
  if (!allowance?.allowed) {
    if (allowance?.tier === 'local_only') {
      return res.status(403).json({ error: 'Hosted AI knowledge search requires an active subscription.', usage: allowance });
    }
    res.setHeader('Retry-After', allowance?.minute_remaining === 0 ? '60' : '3600');
    return res.status(429).json({ error: 'Hosted AI usage limit reached.', usage: allowance });
  }
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
    return sendOpaqueError(req, res, 500, 'An error occurred while processing the request.', 'Q-AI Query', error);
  }
}));
