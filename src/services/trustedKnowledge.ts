export interface TrustedKnowledgeItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  category: 'healthcare' | 'legal';
}

export interface TrustedKnowledgeResult {
  items: TrustedKnowledgeItem[];
}

/**
 * Legal and healthcare prompts must pass through this repository before an
 * assistant request is made. A failed lookup is intentionally an error so the
 * caller can avoid sending the prompt to a generic model without vetted context.
 */
export async function fetchTrustedKnowledge(query: string): Promise<TrustedKnowledgeResult> {
  const response = await fetch(`/api/trusted-knowledge/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Trusted Knowledge Repository unavailable.');

  const result = (await response.json()) as TrustedKnowledgeResult;
  if (!result.items?.length) throw new Error('No vetted guidance was found for this request.');
  return result;
}

export async function queryVettedKnowledge(query: string): Promise<TrustedKnowledgeResult> {
  const supabase = getSupabaseClient();
  const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const accessToken = sessionData.session?.access_token;
  const response = await fetch('/api/trusted-knowledge/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) throw new Error('Vetted Knowledge Repository unavailable.');
  const result = (await response.json()) as TrustedKnowledgeResult;
  if (!result.items?.length) throw new Error('No vetted context matched this request.');
  return result;
}
import { getSupabaseClient } from './supabase';
