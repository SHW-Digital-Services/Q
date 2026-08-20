import app, { startServer } from './server/app';

const isMainModule = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.cjs') || process.argv[1].endsWith('server.js'))
);

if (isMainModule && process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('[Server] Failed to start:', error);
    process.exitCode = 1;
  });
}

export { app, startServer };
export default app;
