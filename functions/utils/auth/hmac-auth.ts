import { createHmac, timingSafeEqual } from 'node:crypto';

const REPLAY_WINDOW_SECS = 300; // 5 minutes

/**
 * Verify an HMAC-SHA256 signature from the ESPN webhook producer.
 *
 * The signed message is: `${timestamp}.${rawBody}`
 *
 * Returns true only when:
 *  1. All inputs are present
 *  2. The timestamp is within the replay window
 *  3. The signature matches (constant-time comparison)
 */
export function verifyHmacSignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  if (!timestamp || !signature || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const nowSecs = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSecs - ts) > REPLAY_WINDOW_SECS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  if (signature.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
