import crypto from 'crypto';

// Verify Vercel webhook using HMAC-SHA1 over raw request body.
// Accepts header forms like "sha1=<hex>" or raw hex.
export function verifyVercelSignature(secret: string, rawBody: Buffer, signatureHeader: string) {
  let received = signatureHeader;
  if (received.startsWith('sha1=')) received = received.slice(5);

  const hmac = crypto.createHmac('sha1', secret).update(rawBody).digest('hex');

  try {
    const sigBuf = Buffer.from(received, 'utf8');
    const hmacBuf = Buffer.from(hmac, 'utf8');
    if (sigBuf.length !== hmacBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, hmacBuf);
  } catch (e) {
    return false;
  }
}

// Generic HMAC-SHA256 verify kept for other webhook providers if needed
export function verifySignature(secret: string, body: string, signatureHeader: string) {
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    const sigBuf = Buffer.from(signatureHeader, 'utf8');
    const hmacBuf = Buffer.from(hmac, 'utf8');
    if (sigBuf.length !== hmacBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, hmacBuf);
  } catch (e) {
    return false;
  }
}
