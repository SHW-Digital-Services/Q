let appPromise: Promise<any> | null = null;

async function getApp() {
  appPromise ??= import('../server.ts').then((module) => module.default);
  return appPromise;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error: any) {
    console.error('[Vercel API bootstrap failed]:', error);
    return res.status(500).json({
      error: 'API bootstrap failed. Check Vercel function logs for the full stack trace.',
      detail: error?.message || 'Unknown server bootstrap error.'
    });
  }
}

