import { describe, expect, it } from 'vitest';

import { json } from './http';

describe('json', () => {
  it('returns the correct statusCode', () => {
    const res = json(200, { ok: true }) as { statusCode: number };
    expect(res.statusCode).toBe(200);
  });

  it('sets Content-Type header to application/json', () => {
    const res = json(200, {}) as { headers: Record<string, string>; statusCode: number; body: string };
    expect(res.headers?.['Content-Type']).toBe('application/json');
  });

  it('serializes the body to a JSON string', () => {
    const res = json(404, { error: 'Not found' }) as { body: string };
    expect(JSON.parse(res.body)).toEqual({ error: 'Not found' });
  });

  it('works with 4xx status codes', () => {
    const res = json(400, { error: 'Bad request' }) as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('Bad request');
  });

  it('works with 5xx status codes', () => {
    const res = json(500, { error: 'Internal server error' }) as { statusCode: number };
    expect(res.statusCode).toBe(500);
  });

  it('serializes nested objects correctly', () => {
    const res = json(200, { data: { count: 3, items: ['a', 'b', 'c'] } }) as { body: string };
    expect(JSON.parse(res.body)).toEqual({ data: { count: 3, items: ['a', 'b', 'c'] } });
  });
});
