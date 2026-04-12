import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { z } from 'zod';

export function json(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

type PathParamsResult<T extends string> =
  | { ok: true; params: Record<T, string> }
  | { ok: false; response: APIGatewayProxyResultV2 };

export function parsePathParams<T extends string>(event: APIGatewayProxyEventV2, ...keys: T[]): PathParamsResult<T> {
  const raw = event.pathParameters ?? {};
  const params = {} as Record<T, string>;
  for (const key of keys) {
    const val = raw[key];
    if (!val) return { ok: false, response: json(400, { error: 'Missing path parameters' }) };
    params[key] = val;
  }
  return { ok: true, params };
}

type JsonBodyResult = { ok: true; data: unknown } | { ok: false; response: APIGatewayProxyResultV2 };

export function parseJsonBody(event: APIGatewayProxyEventV2): JsonBodyResult {
  try {
    return { ok: true, data: JSON.parse(event.body ?? '{}') };
  } catch {
    return { ok: false, response: json(400, { error: 'Invalid JSON body' }) };
  }
}

type ValidateResult<T> = { ok: true; data: T } | { ok: false; response: APIGatewayProxyResultV2 };

export function validateBody<S extends z.ZodType>(schema: S, body: unknown): ValidateResult<z.output<S>> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data as z.output<S> };
  return { ok: false, response: json(422, { error: 'Validation failed', details: parsed.error.flatten() }) };
}
