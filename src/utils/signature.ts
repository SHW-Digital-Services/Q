import crypto from 'crypto';

export function verifySignature(secret: string, body: string, signatureHeader: string) {
  // Accept either raw hex HMAC or a header prefixed form (e.g., sha256=...)
  let received = signatureHeader;
  if (received.startsWith('sha256=')) received = received.slice(7);

  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');

  try {
    const sigBuf = Buffer.from(received, 'utf8');
    const hmacBuf = Buffer.from(hmac, 'utf8');
    if (sigBuf.length !== hmacBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, hmacBuf);
  } catch (e) {
    return false;
  }
}
