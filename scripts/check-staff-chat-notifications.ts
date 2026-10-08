import assert from 'node:assert/strict';
import { enableSystemNotifications, disableSystemNotifications, notifyStaffChat, systemNotificationsEnabled } from '../src/services/staffChatNotifications';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { value: { isSecureContext: true, Notification: true, focus() {} }, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) }, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { locks: { request: async (_name: string, callback: () => void) => callback() } }, configurable: true });
let permission: NotificationPermission = 'default'; let prompts = 0; let clicks = 0;
const alerts: TestNotification[] = [];
class TestNotification {
  static get permission() { return permission; }
  static async requestPermission() { prompts++; return permission; }
  onclick: (() => void) | null = null;
  closed = false;
  constructor(public title: string, public options: NotificationOptions) { alerts.push(this); }
  close() { this.closed = true; }
}
Object.defineProperty(globalThis, 'Notification', { value: TestNotification, configurable: true });
const open = () => { clicks++; };
await notifyStaffChat('staff', 1, 'recipient', true, open);
assert.equal(prompts, 0); assert.equal(alerts.length, 0);
permission = 'denied';
await assert.rejects(enableSystemNotifications('staff'), /blocked/);
assert.equal(systemNotificationsEnabled('staff'), false);
permission = 'granted';
await enableSystemNotifications('staff');
assert.equal(systemNotificationsEnabled('staff'), true);
assert.equal(systemNotificationsEnabled('other-account'), false);
await notifyStaffChat('staff', 2, 'recipient', true, open);
await notifyStaffChat('staff', 2, 'recipient', true, open);
assert.equal(alerts.length, 1);
assert.equal(alerts[0].title, 'Q Team chat');
assert.match(alerts[0].options.body || '', /new private message/);
alerts[0].onclick!(); assert.equal(clicks, 1); assert.equal(alerts[0].closed, true);
disableSystemNotifications('staff');
await notifyStaffChat('staff', 3, '', false, open); assert.equal(alerts.length, 1);
console.log('PASS: explicit permission, blocked permission handling, account-scoped opt-in, generic private alerts, duplicate suppression, click-through and disable.');
