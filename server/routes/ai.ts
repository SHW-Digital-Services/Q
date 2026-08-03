import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { redactPii } from '../../src/services/pii';

export const aiRouter = express.Router();
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const supabase = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  : null;

aiRouter.use((req, _res, next) => {
  if (typeof req.body?.message === 'string') req.body.message = redactPii(req.body.message);
  next();
});

aiRouter.get('/health', (_req, res) => {
  res.json({ status: 'operational', aiEnabled: !!gemini, knowledgeBaseEnabled: !!supabase });
});

aiRouter.post('/query', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? redactPii(req.body.query).trim() : '';
  if (!query) return res.status(400).json({ error: 'Valid query string required.' });
  if (!gemini || !supabase) return res.status(503).json({ error: 'AI infrastructure not initialized.' });

  try {
    const result = await gemini.models.embedContent({
      model: 'gemini-embedding-001',
      contents: query,
      config: { outputDimensionality: 768 }
    });
    const embedding = result.embeddings?.[0]?.values;
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
});
