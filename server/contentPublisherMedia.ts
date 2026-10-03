import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';

// Only active CRM publishing clients can upload publicly readable news images.
export function createPublisherMediaHandler(getDatabase: () => any) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token || token.length > 256) return res.status(401).json({ error: 'A CRM-authorised content API token is required.' });
    const db = getDatabase();
    if (!db) return res.status(503).json({ error: 'Image storage is unavailable.' });
    const { data: client, error } = await db.from('content_api_clients').select('id,active').eq('token_hash', createHash('sha256').update(token).digest('hex')).eq('active', true).maybeSingle();
    if (error) return res.status(503).json({ error: 'Unable to verify publisher.' });
    if (!client?.active) return res.status(403).json({ error: 'Publisher is not authorised.' });
    const mime = req.get('content-type')?.split(';')[0];
    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 3000000 || !['image/png', 'image/jpeg', 'image/webp'].includes(mime || '')) return res.status(400).json({ error: 'Upload a PNG, JPEG or WebP image up to 3 MB.' });
    const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) return res.status(400).json({ error: 'Image bytes do not match the selected image format.' });
    try {
      const bucket = 'content-media';
      const existing = await db.storage.getBucket(bucket);
      if (existing.error) {
        const created = await db.storage.createBucket(bucket, { public: true, fileSizeLimit: 3000000, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] });
        if (created.error && !(await db.storage.getBucket(bucket)).data) throw created.error;
      } else if (!existing.data?.public) throw new Error('News media bucket must be public.');
      const path = `${client.id}/${createHash('sha256').update(bytes).digest('hex')}.${mime!.split('/')[1]}`;
      const uploaded = await db.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false, cacheControl: '31536000' });
      if (uploaded.error && String(uploaded.error.statusCode) !== '409' && uploaded.error.error !== 'Duplicate') throw uploaded.error;
      const { data } = db.storage.from(bucket).getPublicUrl(path);
      return res.status(201).json({ url: data.publicUrl });
    } catch { return res.status(503).json({ error: 'Unable to store the news image.' }); }
  };
}
