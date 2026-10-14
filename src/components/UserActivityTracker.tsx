import { useEffect } from 'react';
import { getSupabaseClient } from '../services/supabase';

type ActivityAction = 'ui.click' | 'ui.page_view' | 'ui.submit' | 'ui.change';
type ActivityEvent = { action: ActivityAction; page: string; target: string; element: string };
const sessionKey = 'q.audit.visitor.v1';

function visitorId() {
  try {
    let value = sessionStorage.getItem(sessionKey);
    if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(sessionKey, value); }
    return value;
  } catch { return crypto.randomUUID(); }
}

function currentPage() {
  return window.location.pathname.split('/').map((segment) => {
    let decoded = segment;
    try { decoded = decodeURIComponent(segment); } catch { /* Keep malformed path segments opaque. */ }
    return decoded.length > 50 || /@|^[0-9a-f-]{32,}$/i.test(decoded) || /^\d+$/.test(decoded) ? ':item' : decoded;
  }).join('/').slice(0, 200);
}

function describe(element: Element) {
  const tag = element.tagName.toLowerCase();
  const type = element instanceof HTMLInputElement ? element.type : '';
  const labelled = element.getAttribute('data-audit-label');
  const safeLabel = labelled?.trim().replace(/[\r\n<>]/g, '').slice(0, 100);
  return { target: safeLabel || (type ? `${tag}[${type}]` : tag), element: tag.slice(0, 40) };
}

export default function UserActivityTracker() {
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let active = true;
    let currentVisitorId = visitorId();
    let events: ActivityEvent[] = [];
    let previousPage = currentPage();
    let flushing = false;

    const enqueue = (action: ActivityAction, target = '', element = 'document') => {
      events.push({ action, page: currentPage(), target: target.slice(0, 100), element: element.slice(0, 40) });
      if (events.length >= 20) void flush();
    };

    const flush = async () => {
      if (!active || flushing || !events.length) return;
      flushing = true;
      const batch = events.splice(0, 25);
      try {
        const { data } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
        const response = await fetch('/api/activity/events', { method: 'POST', headers, body: JSON.stringify({ visitorId: currentVisitorId, events: batch }), keepalive: true });
        if (!response.ok && active) events = [...batch, ...events].slice(-100);
      } catch {
        if (active) events = [...batch, ...events].slice(-100);
      } finally { flushing = false; }
    };

    const onClick = (event: MouseEvent) => {
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const control = origin.closest('button,a,[role="button"],[role="link"],input[type="button"],input[type="submit"],summary');
      if (control && !control.closest('[data-audit-ignore]')) {
        const details = describe(control);
        enqueue('ui.click', details.target, details.element);
        window.setTimeout(checkPage, 0);
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && !form.closest('[data-audit-ignore]')) {
        const details = describe(form);
        enqueue('ui.submit', details.target, 'form');
      }
    };
    const onChange = (event: Event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
      if (field instanceof HTMLInputElement && !['checkbox', 'radio', 'range'].includes(field.type)) return;
      if (field.closest('[data-audit-ignore]')) return;
      const details = describe(field);
      enqueue('ui.change', details.target, details.element);
    };
    const checkPage = () => {
      const page = currentPage();
      if (page !== previousPage) { previousPage = page; enqueue('ui.page_view', page, 'document'); }
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') void flush(); };

    enqueue('ui.page_view', currentPage(), 'document');
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('change', onChange, true);
    window.addEventListener('popstate', checkPage);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => { checkPage(); void flush(); }, 15000);
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { currentVisitorId = visitorId(); });

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('change', onChange, true);
      window.removeEventListener('popstate', checkPage);
      document.removeEventListener('visibilitychange', onVisibility);
      authListener.subscription.unsubscribe();
    };
  }, []);
  return null;
}
