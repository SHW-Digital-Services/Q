import { useState } from 'react';

type ChatApi = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global { interface Window { BrevoConversationsID?: string; BrevoConversations?: ChatApi; } }

export function SupportChatLauncher() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  function openChat() {
    setError(false);
    if (document.querySelector('script[data-q-support-chat]')) {
      window.BrevoConversations?.('openChat', true);
      return;
    }
    setLoading(true);
    window.BrevoConversationsID = '6aa6faad3340f3504a081ea7';
    const queue: ChatApi = (...args) => { (queue.q ||= []).push(args); };
    window.BrevoConversations ||= queue;
    window.BrevoConversations('openChat', true);
    const script = document.createElement('script');
    script.src = 'https://conversations-widget.brevo.com/brevo-conversations.js';
    script.async = true; script.dataset.qSupportChat = 'true';
    script.onload = () => setLoading(false);
    script.onerror = () => { script.remove(); setLoading(false); setError(true); };
    document.head.appendChild(script);
  }
  return <div className="fixed bottom-4 right-4 z-40 max-w-xs rounded-2xl border border-white/15 bg-slate-950 p-3 text-xs text-white shadow-lg">
    <button type="button" disabled={loading} onClick={openChat} className="min-h-11 rounded-xl px-3 font-semibold text-purple-200 disabled:opacity-50">{loading ? 'Loading support chat…' : 'Chat with support'}</button>
    {error && <p role="alert" className="p-2">Chat is unavailable. Email <a className="underline" href="mailto:office@q-ai.online">office@q-ai.online</a>.</p>}
  </div>;
}
