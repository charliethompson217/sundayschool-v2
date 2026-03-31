import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyHmacSignature } from '../lib/auth';

const SECRET = 'test-webhook-secret';

function sign(body: string, secret = SECRET, timestamp?: string): { timestamp: string; signature: string } {
  const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return { timestamp: ts, signature: sig };
}

describe('verifyHmacSignature', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-09-06T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a valid signature with current timestamp', () => {
    const body = '{"type":"schedule_upsert"}';
    const { timestamp, signature } = sign(body);
    expect(verifyHmacSignature(body, timestamp, signature, SECRET)).toBe(true);
  });

  it('rejects a wrong signature', () => {
    const body = '{"type":"schedule_upsert"}';
    const { timestamp } = sign(body);
    expect(verifyHmacSignature(body, timestamp, 'deadbeef'.repeat(8), SECRET)).toBe(false);
  });

  it('rejects a stale timestamp (older than 5 minutes)', () => {
    const body = '{"type":"schedule_upsert"}';
    const staleTs = String(Math.floor(Date.now() / 1000) - 400);
    const sig = createHmac('sha256', SECRET).update(`${staleTs}.${body}`).digest('hex');
    expect(verifyHmacSignature(body, staleTs, sig, SECRET)).toBe(false);
  });

  it('accepts a timestamp within the 5-minute window', () => {
    const body = '{"type":"schedule_upsert"}';
    const recentTs = String(Math.floor(Date.now() / 1000) - 200);
    const sig = createHmac('sha256', SECRET).update(`${recentTs}.${body}`).digest('hex');
    expect(verifyHmacSignature(body, recentTs, sig, SECRET)).toBe(true);
  });

  it('rejects missing timestamp', () => {
    expect(verifyHmacSignature('body', '', 'sig', SECRET)).toBe(false);
  });

  it('rejects missing signature', () => {
    expect(verifyHmacSignature('body', '12345', '', SECRET)).toBe(false);
  });

  it('rejects missing secret', () => {
    const body = '{"data":1}';
    const { timestamp, signature } = sign(body);
    expect(verifyHmacSignature(body, timestamp, signature, '')).toBe(false);
  });

  it('rejects non-numeric timestamp', () => {
    expect(verifyHmacSignature('body', 'not-a-number', 'sig', SECRET)).toBe(false);
  });

  it('rejects signature with wrong length', () => {
    const body = '{"type":"schedule_upsert"}';
    const { timestamp } = sign(body);
    expect(verifyHmacSignature(body, timestamp, 'short', SECRET)).toBe(false);
  });
});
