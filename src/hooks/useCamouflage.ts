import { useCallback, useEffect, useState } from 'react';
const KEY = 'q_camouflage_active';
const DEFAULT_TITLE = 'Q - LGBTQ+ Wellbeing & Support';
const MASKED_TITLE = 'QuickNotes - Drafts & Lists';
const MASKED_ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#64748b"/><path d="M7 7h10M7 11h10M7 15h7" stroke="white" stroke-width="2"/></svg>')}`;

function setIdentity(masked: boolean) {
  document.title = masked ? MASKED_TITLE : DEFAULT_TITLE;
  let icon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon); }
  if (!icon.dataset.qOriginalHref) icon.dataset.qOriginalHref = icon.getAttribute('href') || '/logo.png';
  icon.href = masked ? MASKED_ICON : icon.dataset.qOriginalHref;
}

export function useCamouflage() {
  const [isMasked, setIsMasked] = useState(() => { try { return localStorage.getItem(KEY) === 'true'; } catch { return false; } });
  const enableCamouflage = useCallback(() => { localStorage.setItem(KEY, 'true'); setIsMasked(true); }, []);
  const disableCamouflage = useCallback(() => { localStorage.removeItem(KEY); setIsMasked(false); }, []);
  useEffect(() => {
    setIdentity(isMasked);
    window.dispatchEvent(new CustomEvent('q:camouflage', { detail: { active: isMasked } }));
    if (isMasked) document.querySelectorAll('audio, video').forEach(media => { (media as HTMLMediaElement).pause(); (media as HTMLMediaElement).muted = true; });
    if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(registration => registration.active?.postMessage({ type: 'Q_CAMOUFLAGE_CHANGED', active: isMasked }))).catch(() => undefined);
  }, [isMasked]);
  return { isMasked, enableCamouflage, disableCamouflage };
}
