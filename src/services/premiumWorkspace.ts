export type Goal = { id: string; title: string; reason: string; days: number[]; checks: string[]; archived: boolean };
export type Rehearsal = { id: string; first: string; second: string; takeaway: string };
export type WeeklyReview = { id: string; answers: Record<string, string> };
export type PremiumWorkspace = { goals: Goal[]; rehearsals: Rehearsal[]; reviews: WeeklyReview[]; draft: { title: string; reason: string; days: number[] } };
export const workspaceKey = (userId: string) => `q_premium_workspace_v1:${userId}`;
export const emptyWorkspace = (): PremiumWorkspace => ({ goals: [], rehearsals: [], reviews: [], draft: { title: '', reason: '', days: [1, 3, 5] } });
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function weekDates(date = new Date()): string[] {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => { const day = new Date(monday); day.setDate(day.getDate() + i); return localDate(day); });
}
export function validWorkspace(value: unknown): value is PremiumWorkspace {
  if (!value || typeof value !== 'object') return false;
  const v = value as PremiumWorkspace;
  const text = (s: unknown, max = 3000) => typeof s === 'string' && s.length <= max;
  const days = (d: unknown) => Array.isArray(d) && d.length <= 7 && new Set(d).size === d.length && d.every(n => Number.isInteger(n) && n >= 0 && n < 7);
  const date = (s: unknown) => text(s, 10) && /^\d{4}-\d{2}-\d{2}$/.test(s as string) && localDate(new Date(`${s}T12:00:00`)) === s;
  const list = (a: unknown) => Array.isArray(a) && a.length <= 1000 && new Set(a.map(x => x?.id)).size === a.length;
  return !!v.draft && text(v.draft.title, 120) && text(v.draft.reason, 500) && days(v.draft.days)
    && list(v.goals) && v.goals.every(g => g && text(g.id, 100) && text(g.title, 120) && text(g.reason, 500) && days(g.days) && typeof g.archived === 'boolean' && Array.isArray(g.checks) && g.checks.length <= 10000 && new Set(g.checks).size === g.checks.length && g.checks.every(date))
    && list(v.rehearsals) && v.rehearsals.every(r => r && ['boundary', 'privacy', 'support', 'repair'].includes(r.id) && text(r.first) && text(r.second) && text(r.takeaway))
    && list(v.reviews) && v.reviews.every(r => r && date(r.id) && r.answers && typeof r.answers === 'object' && !Array.isArray(r.answers) && Object.entries(r.answers).every(([k, s]) => ['worked', 'difficult', 'learned', 'next', 'support'].includes(k) && text(s)));
}
export function readWorkspace(userId: string): PremiumWorkspace {
  const raw = localStorage.getItem(workspaceKey(userId));
  if (!raw) return emptyWorkspace();
  const parsed = JSON.parse(raw);
  if (!validWorkspace(parsed)) throw new Error('Your saved workspace could not be read. Export a backup before changing it.');
  return parsed;
}
export function writeWorkspace(userId: string, value: PremiumWorkspace) {
  if (!userId || !validWorkspace(value)) throw new Error('This workspace could not be saved.');
  localStorage.setItem(workspaceKey(userId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('q-local-change', { detail: { key: workspaceKey(userId) } }));
}
