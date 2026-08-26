const NEUTRAL_REDIRECT_URL = 'https://www.google.co.uk';
const CHANNEL_NAME = 'q_stealth_channel';
const STORAGE_SIGNAL = 'q_stealth_exit_signal';
let exiting = false;

function clearSensitiveSessionData() {
  try {
    sessionStorage.clear();
    ['q_active_chat_session', 'q_temp_journal'].forEach((key) => localStorage.removeItem(key));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key === 'supabase.auth.token' || /^sb-.*-auth-token$/.test(key))) localStorage.removeItem(key);
    }
  } catch (error) { console.warn('[Q Stealth] Could not clear all session data:', error); }
}

function executeRedirect() {
  if (exiting || typeof window === 'undefined') return;
  exiting = true;
  clearSensitiveSessionData();
  window.location.replace(NEUTRAL_REDIRECT_URL);
}

const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
if (channel) channel.onmessage = (event) => { if (event.data === 'TRIGGER_STEALTH_EXIT') executeRedirect(); };
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => { if (event.key === STORAGE_SIGNAL) executeRedirect(); });

export function triggerQuickExit() {
  try { channel?.postMessage('TRIGGER_STEALTH_EXIT'); localStorage.setItem(STORAGE_SIGNAL, String(Date.now())); } catch { /* redirect still works */ }
  executeRedirect();
}
