export const continuityKeys = {journal:'q_journal_entries_v1',moods:'q_daily_mood_logs_v1',guides:'q_life_guides_v1',chat:'q_chat_history_v1',programmes:'q_programmes_v1',preferences:'q_display_preferences_v1'} as const;
export type Kind = keyof typeof continuityKeys;
export type Snapshot = Partial<Record<Kind, unknown[]>>;
export function readSnapshot(userId:string,kinds:Kind[]):Snapshot {
  return Object.fromEntries(kinds.map(kind=>[kind,kind==='preferences' ? [{id:'display',theme:localStorage.getItem('theme')==='dark'?'dark':'light',language:localStorage.getItem('q_language')||'en'}] : JSON.parse(localStorage.getItem(`${continuityKeys[kind]}:${userId}`)||'[]')]));
}
export function syncDecision(local:Snapshot,remote:Snapshot|null,baseline:string|null):'push'|'pull'|'same'|'conflict' {
  const l=JSON.stringify(local),r=JSON.stringify(remote);
  if(l===r)return 'same';
  if(!remote)return 'push';
  if(baseline===l)return 'pull';
  if(baseline===r)return 'push';
  if(!baseline && Object.values(local).every(v=>!v?.length))return 'pull';
  return 'conflict';
}
export function downloadSnapshot(payload:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='q-continuity-backup.json';a.click();URL.revokeObjectURL(url);
}
