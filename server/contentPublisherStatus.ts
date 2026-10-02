import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';

// Read-only verification: never creates a draft or changes publication state.
export function createPublisherStatusHandler(getDatabase: () => any) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = (req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] || req.header('x-q-content-api-key') || '').trim();
    if (!token) return res.status(401).json({ error: 'A CRM-authorised content API token is required.' });
    try {
      const database = getDatabase();
      if (!database) return res.status(503).json({ error: 'Content publishing is temporarily unavailable.' });
      const { data: client, error } = await database.from('content_api_clients')
        .select('id,name,active').eq('token_hash', createHash('sha256').update(token, 'utf8').digest('hex'))
        .eq('active', true).maybeSingle();
      if (error) return res.status(503).json({ error: 'Unable to verify content API authorisation.' });
      if (!client?.active) return res.status(403).json({ error: 'This content API token is not authorised in the CRM.' });
      return res.json({ authorised: true, client: { id: client.id, name: client.name }, publishingPath: '/api/content/publish', publicPath: '/news' });
    } catch { return res.status(503).json({ error: 'Unable to verify content API authorisation.' }); }
  };
}
