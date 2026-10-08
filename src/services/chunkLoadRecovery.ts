// A tab can outlive the deployment whose hashed route chunks it references.
// Allow one refresh per minute, including across bundles, to avoid reload loops
// when the failure is caused by an outage or a blocked request instead.
export function installChunkLoadRecovery(target: Window, now = Date.now) {
  const key = 'q-chunk-recovery-at';
  target.addEventListener('vite:preloadError', (event) => {
    if (!target.navigator.onLine) return;
    try {
      const previous = Number(target.sessionStorage.getItem(key));
      const timestamp = now();
      if (previous && timestamp - previous < 60_000) return;
      target.sessionStorage.setItem(key, String(timestamp));
    } catch {
      // Without a persistent guard, a reload could repeat indefinitely.
      return;
    }
    event.preventDefault();
    target.location.reload();
  });
}
