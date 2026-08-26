import { getSupabaseClient } from './supabase';

export interface MemoryBlob {
  id: string;
  user_id: string;
  kind: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getMemoryBlobs(userId: string): Promise<MemoryBlob[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('memory_entries')
    .select('id, user_id, kind, content, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MemoryBlob[];
}

export async function getRecentMemoryBlobs(userId: string, limit = 10): Promise<MemoryBlob[]> {
  const memories = await getMemoryBlobs(userId);
  return memories.slice(0, Math.max(1, Math.min(limit, 20)));
}

export async function getRelevantMemoryBlobs(userId: string, query: string, limit = 6): Promise<MemoryBlob[]> {
  const memories = (await getMemoryBlobs(userId)).slice(0, 100);
  const terms = new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  if (terms.size === 0) return memories.slice(0, limit);
  return memories
    .map((memory, index) => ({ memory, score: [...terms].reduce((total, term) => total + (memory.content.toLowerCase().includes(term) ? 1 : 0), 0) - index / 1000 }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.memory);
}

export async function saveMemoryBlob(userId: string, content: string, kind = 'assistant_memory'): Promise<MemoryBlob | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !content.trim()) return null;

  const { data, error } = await supabase
    .from('memory_entries')
    .insert({ user_id: userId, kind, content: content.trim() })
    .select('id, user_id, kind, content, metadata, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as MemoryBlob;
}

export async function deleteMemoryBlob(userId: string, memoryId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase
    .from('memory_entries')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId);

  if (error) throw error;

  const { error: auditError } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'delete_memory',
    metadata: { memory_id: memoryId }
  });
  if (auditError) console.warn('[Q Memory] Audit log write failed:', auditError.message);
}
