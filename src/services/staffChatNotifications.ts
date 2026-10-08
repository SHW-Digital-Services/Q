export const systemNotificationsSupported = () => typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window;
const preferenceKey = (userId: string) => `q-team-chat-system:${userId}`;

export function systemNotificationsEnabled(userId: string) {
  try { return systemNotificationsSupported() && Notification.permission === 'granted' && localStorage.getItem(preferenceKey(userId)) === 'on'; } catch { return false; }
}

export async function enableSystemNotifications(userId: string) {
  if (!systemNotificationsSupported()) throw Error('System notifications need a supported browser and HTTPS.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw Error(permission === 'denied' ? 'Notifications are blocked. Allow notifications for Q in your browser site settings, then try again.' : 'Notification permission was not granted. You can try again when ready.');
  localStorage.setItem(preferenceKey(userId), 'on');
}

export function disableSystemNotifications(userId: string) {
  localStorage.setItem(preferenceKey(userId), 'off');
}

export async function notifyStaffChat(userId: string, messageId: number, recipient: string, privateMessage: boolean, onOpen: () => void) {
  const show = () => {
    if (!systemNotificationsEnabled(userId)) return;
    const marker = `q-team-chat-alert:${userId}`;
    try {
      // Messages arrive in ID order; suppress the same message across multiple tabs.
      if (Number(localStorage.getItem(marker) || 0) >= messageId) return;
      const notification = new Notification('Q Team chat', {
        body: privateMessage ? 'You have a new private message. Open Team chat to read it.' : 'There is a new message for everyone. Open Team chat to read it.',
        tag: `q-team-chat:${userId}:${recipient || 'everyone'}`,
      });
      localStorage.setItem(marker, String(messageId));
      notification.onclick = () => { window.focus(); onOpen(); notification.close(); };
    } catch {
      // Keep in-app toast delivery working if native notifications are unavailable.
    }
  };
  if (navigator.locks) await navigator.locks.request(`q-team-chat-alert:${userId}`, show);
  else show();
}
