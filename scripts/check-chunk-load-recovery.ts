import assert from 'node:assert/strict';
import { installChunkLoadRecovery } from '../src/services/chunkLoadRecovery';

let timestamp = 100_000;
let reloads = 0;
const storage = new Map<string, string>();
const target = Object.assign(new EventTarget(), {
  navigator: { onLine: true },
  sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
  location: { reload: () => { reloads += 1; } },
});
installChunkLoadRecovery(target as unknown as Window, () => timestamp);
const fail = () => {
  const event = new Event('vite:preloadError', { cancelable: true });
  target.dispatchEvent(event);
  return event;
};
assert.equal(fail().defaultPrevented, true);
assert.equal(reloads, 1);
assert.equal(fail().defaultPrevented, false);
assert.equal(reloads, 1);
timestamp += 60_000;
target.navigator.onLine = false;
assert.equal(fail().defaultPrevented, false);
assert.equal(reloads, 1);
target.navigator.onLine = true;
assert.equal(fail().defaultPrevented, true);
assert.equal(reloads, 2);
timestamp += 60_000;
target.sessionStorage.setItem = () => { throw new Error('Storage blocked'); };
assert.equal(fail().defaultPrevented, false);
assert.equal(reloads, 2);
console.log('Chunk recovery checks passed: refresh, loop guard, offline, blocked storage.');
