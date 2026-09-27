import { JournalEntry } from '../types';
import { getSupabaseClient } from './supabase';

export interface CloudJournalRow {
  id: string;
  title: string;
  content: string;
  mood_rating: number | null;
  mood_tags: string[];
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export function mapCloudJournalEntry(row: CloudJournalRow): JournalEntry {
  const created = new Date(row.created_at);
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`,
    time: created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    moodRating: row.mood_rating ?? 0,
    moodTags: row.mood_tags ?? [],
    isPrivate: row.is_private,
    synced: true,
    updatedAt: row.updated_at,
  };
}

export async function getCloudJournalEntries(userId: string, signal?: AbortSignal): Promise<JournalEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Account storage is unavailable.');

  const entries: JournalEntry[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from('journal_entries')
      .select('id, title, content, mood_rating, mood_tags, is_private, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as CloudJournalRow[];
    entries.push(...rows.map(mapCloudJournalEntry));
    if (rows.length < pageSize) return entries;
  }
}

export async function deleteCloudJournalEntry(userId: string, entryId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Account storage is unavailable.');
  const { data, error } = await supabase.from('journal_entries').delete()
    .eq('user_id', userId).eq('id', entryId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('The account entry could not be deleted. Refresh and try again.');
}

export function mergeJournalEntries(local: JournalEntry[], cloud: JournalEntry[]): JournalEntry[] {
  const entries = new Map(cloud.map(entry => [entry.id, entry]));
  for (const entry of local) {
    const existing = entries.get(entry.id);
    if (!existing || Date.parse(entry.updatedAt) > Date.parse(existing.updatedAt)) entries.set(entry.id, entry);
  }
  return [...entries.values()].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}
