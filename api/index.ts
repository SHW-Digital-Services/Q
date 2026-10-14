import app from '../server/app.js';

export default function handler(req: any, res: any) {
  // Vercel can pass an absolute URL to the Node handler. Express 4's
  // parseurl dependency falls back to deprecated url.parse() for those URLs.
  if (typeof req.url === 'string' && /^https?:\/\//i.test(req.url)) {
    try {
      const requestUrl = new URL(req.url);
      req.url = `${requestUrl.pathname}${requestUrl.search}`;
    } catch {
      // Keep Express's normal handling for malformed or non-HTTP request targets.
    }
  }
  return app(req, res);
}

