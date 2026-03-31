import { describe, expect, it } from 'vitest';

import {
  buildGameLookupGsiPk,
  buildGameSk,
  buildWeekPk,
  computeContentHash,
  deriveIsInternational,
} from '../lib/dynamo';

// ── Key builders ─────────────────────────────────────────────────────────────

describe('buildWeekPk', () => {
  it('formats correctly', () => {
    expect(buildWeekPk('2024', '2', '1')).toBe('SEASON#2024#TYPE#2#WEEK#1');
  });

  it('handles postseason type and week', () => {
    expect(buildWeekPk('2024', '3', '4')).toBe('SEASON#2024#TYPE#3#WEEK#4');
  });
});

describe('buildGameSk', () => {
  it('formats correctly', () => {
    expect(buildGameSk('2024-09-06T00:20Z', '401547417')).toBe('GAME#2024-09-06T00:20Z#401547417');
  });
});

describe('buildGameLookupGsiPk', () => {
  it('formats correctly', () => {
    expect(buildGameLookupGsiPk('401547417')).toBe('GAME#401547417');
  });
});

// ── Content hash ─────────────────────────────────────────────────────────────

describe('computeContentHash', () => {
  it('produces consistent hash for same input', () => {
    const fields = { a: 1, b: 'two', c: true };
    expect(computeContentHash(fields)).toBe(computeContentHash(fields));
  });

  it('is order-independent', () => {
    const a = computeContentHash({ x: 1, y: 2 });
    const b = computeContentHash({ y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('changes when values differ', () => {
    const a = computeContentHash({ score: 27 });
    const b = computeContentHash({ score: 20 });
    expect(a).not.toBe(b);
  });

  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = computeContentHash({ k: 'v' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ── is_international ─────────────────────────────────────────────────────────

describe('deriveIsInternational', () => {
  it('returns false for USA', () => {
    expect(deriveIsInternational('USA')).toBe(false);
  });

  it('returns true for non-USA countries', () => {
    expect(deriveIsInternational('United Kingdom')).toBe(true);
    expect(deriveIsInternational('Germany')).toBe(true);
    expect(deriveIsInternational('Brazil')).toBe(true);
  });

  it('returns false for null', () => {
    expect(deriveIsInternational(null)).toBe(false);
  });
});
