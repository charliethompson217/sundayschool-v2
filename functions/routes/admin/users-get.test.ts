import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser, mockGetAllUsers } = vi.hoisted(() => ({
  mockUser: {
    id: 'admin-1',
    email: 'admin@test.com',
    username: 'admin',
    firstName: 'Admin',
    lastName: 'Test',
    phone: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isAdmin: true,
    isSystemAdmin: false,
    isActive: true,
    isVerified: true,
    isPlayer: false,
  },
  mockGetAllUsers: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    UsersTable: { name: 'test-users' },
    UserPool: { id: 'test-pool' },
    WebClient: { id: 'test-client' },
  },
}));

vi.mock('../../utils/auth/cognito-auth', () => ({
  withAdmin: (inner: (event: unknown, user: typeof mockUser) => Promise<unknown>) => (event: unknown) =>
    mockUser.isAdmin
      ? inner(event, mockUser)
      : Promise.resolve({
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Forbidden' }),
        }),
}));

vi.mock('../../db/users/users', () => ({
  getAllUsers: mockGetAllUsers,
}));

import { handler } from './users-get';

function makeEvent(): APIGatewayProxyEventV2 {
  return {
    headers: { authorization: 'Bearer mock-token' },
    pathParameters: {},
    queryStringParameters: {},
    body: null,
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/admin/users' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke() {
  return await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>)(makeEvent());
}

describe('users-get handler', () => {
  afterEach(() => {
    mockUser.isAdmin = true;
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin users', async () => {
    mockUser.isAdmin = false;
    const res = await invoke();
    expect(res.statusCode).toBe(403);
    expect(mockGetAllUsers).not.toHaveBeenCalled();
  });

  it('returns 200 with all users for an admin', async () => {
    const users = [
      { id: 'u1', email: 'a@b.com' },
      { id: 'u2', email: 'b@c.com' },
    ];
    mockGetAllUsers.mockResolvedValueOnce(users);
    const res = await invoke();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(body.users).toHaveLength(2);
  });

  it('calls getAllUsers with the correct table name', async () => {
    mockGetAllUsers.mockResolvedValueOnce([]);
    await invoke();
    expect(mockGetAllUsers).toHaveBeenCalledWith('test-users');
  });

  it('returns an empty users array when the table is empty', async () => {
    mockGetAllUsers.mockResolvedValueOnce([]);
    const res = await invoke();
    const body = JSON.parse(res.body as string);
    expect(body.users).toEqual([]);
  });
});
