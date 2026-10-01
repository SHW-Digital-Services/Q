import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { CRM_DRAFT_PREFIX, useCrmDraftUser } from '../contexts/CrmDraftContext';

function compatible(value: unknown, initial: unknown): boolean {
  if (initial === null) return value === null || typeof value === 'string' || typeof value === 'object';
  if (Array.isArray(initial)) return Array.isArray(value) && (initial.length === 0 || value.every(item => compatible(item, initial[0])));
  if (typeof initial === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.entries(initial).every(([key, field]) => compatible((value as Record<string, unknown>)[key], field));
  }
  return typeof value === typeof initial;
}

export function readCrmDraft<T>(key: string, initial: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return initial;
    const value = JSON.parse(raw);
    return compatible(value, initial) ? value as T : initial;
  } catch { return initial; }
}

// Write in the event handler, before React renders, so an immediate refresh
// cannot outrun an effect or a debounce. Ref updates also preserve batched edits.
export function useCrmDraftState<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const userId = useCrmDraftUser();
  const key = `${CRM_DRAFT_PREFIX}${userId}:${name}`;
  const [stored, setStored] = useState(() => ({ key, value: userId ? readCrmDraft(key, initial) : initial }));
  let current = stored;
  if (stored.key !== key) {
    current = { key, value: userId ? readCrmDraft(key, initial) : initial };
    setStored(current);
  }
  const latest = useRef(current);
  if (latest.current.key !== key) latest.current = current;
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const previous = latest.current.key === key ? latest.current.value : readCrmDraft(key, initial);
    const value = typeof action === 'function' ? (action as (previous: T) => T)(previous) : action;
    if (userId) {
      try {
        if (JSON.stringify(value) === JSON.stringify(initial)) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, JSON.stringify(value));
      } catch { window.dispatchEvent(new Event('q-crm-draft-error')); }
    }
    if (latest.current.key === key) {
      latest.current = { key, value };
      setStored({ key, value });
    }
  }, [key, userId]);
  return [current.value, setValue];
}
