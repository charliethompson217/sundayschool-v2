import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    id: 'u1',
    email: 'user@test.com',
    username: 'user',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isAdmin: false,
    isSystemAdmin: false,
    isActive: true,
    isVerified: true,
    isPlayer: true,
  },
}));

vi.mock('sst', () => ({
  Resource: {
    UsersTable: { name: 'test-users' },
    UserPool: { id: 'test-pool' },
    WebClient: { id: 'test-client' },
  },
}));

vi.mock('../../utils/auth/cognito-auth', () => ({
  withAuth: (inner: (event: unknown, user: typeof mockUser) => Promise<unknown>) => (event: unknown) =>
    inner(event, mockUser),
}));

import { handler } from './user-me';

function makeEvent(): APIGatewayProxyEventV2 {
  return {
    headers: { authorization: 'Bearer mock-token' },
    pathParameters: {},
    queryStringParameters: {},
    body: null,
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/me' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke() {
  return await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>)(makeEvent());
}

describe('user-me handler', () => {
  it('returns 200 with the authenticated user', async () => {
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.user).toMatchObject({ id: 'u1', email: 'user@test.com' });
  });

  it('includes all user fields in the response', async () => {
    const res = await invoke();
    const body = JSON.parse(res.body as string);
    expect(body.user.isAdmin).toBe(false);
    expect(body.user.isActive).toBe(true);
    expect(body.user.isVerified).toBe(true);
    expect(body.user.isPlayer).toBe(true);
    expect(body.user.phone).toBeNull();
  });

  it('sets Content-Type to application/json', async () => {
    const res = await invoke();
    expect((res.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});
