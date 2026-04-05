import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockVerify, mockGetUserByEmail, mockCreateUser } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockGetUserByEmail: vi.fn(),
  mockCreateUser: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    UsersTable: { name: 'test-users' },
    UserPool: { id: 'test-pool' },
    WebClient: { id: 'test-client' },
  },
}));

vi.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: vi.fn().mockReturnValue({ verify: mockVerify }),
  },
}));

vi.mock('../../db/users/users', () => ({
  getUserByEmail: mockGetUserByEmail,
  createUser: mockCreateUser,
}));

import { extractBearerToken, withAuth } from './cognito-auth';

const mockUser = {
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
};

function makeEvent(authHeader?: string): APIGatewayProxyEventV2 {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    pathParameters: {},
    queryStringParameters: {},
    body: null,
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/me' } },
  } as unknown as APIGatewayProxyEventV2;
}

// ── extractBearerToken ────────────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('returns the token for a valid Bearer header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('returns null when the header is undefined', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null when the scheme is not Bearer', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('returns null when the header has more than two space-separated parts', () => {
    expect(extractBearerToken('Bearer abc extra')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractBearerToken('')).toBeNull();
  });
});

// ── withAuth ──────────────────────────────────────────────────────────────────

describe('withAuth', () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockGetUserByEmail.mockReset();
    mockCreateUser.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}' }));
    const res = (await handler(makeEvent())) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when the JWT verification fails', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Token expired'));
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}' }));
    const res = (await handler(makeEvent('Bearer bad-token'))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(401);
  });

  it('calls the inner handler with the resolved user', async () => {
    mockVerify.mockResolvedValueOnce({ email: 'user@test.com' });
    mockGetUserByEmail.mockResolvedValueOnce(mockUser);
    const inner = vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' });
    const handler = withAuth(inner);
    await handler(makeEvent('Bearer valid-token'));
    expect(inner).toHaveBeenCalledWith(expect.anything(), mockUser);
  });

  it('returns 403 when the user account is inactive', async () => {
    mockVerify.mockResolvedValueOnce({ email: 'user@test.com' });
    mockGetUserByEmail.mockResolvedValueOnce({ ...mockUser, isActive: false });
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}' }));
    const res = (await handler(makeEvent('Bearer valid-token'))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(403);
  });

  it('creates a user via safety-net when no DB record exists', async () => {
    mockVerify.mockResolvedValueOnce({ email: 'new@test.com', given_name: 'New', family_name: 'User' });
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ ...mockUser, email: 'new@test.com' });
    const inner = vi.fn().mockResolvedValue({ statusCode: 200, body: '{}' });
    const handler = withAuth(inner);
    await handler(makeEvent('Bearer valid-token'));
    expect(mockCreateUser).toHaveBeenCalledOnce();
    expect(inner).toHaveBeenCalledOnce();
  });

  it('falls back to email prefix as username during safety-net creation', async () => {
    mockVerify.mockResolvedValueOnce({ email: 'new@example.com' });
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockResolvedValueOnce({ ...mockUser, email: 'new@example.com' });
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}' }));
    await handler(makeEvent('Bearer valid-token'));
    expect(mockCreateUser).toHaveBeenCalledWith('test-users', expect.objectContaining({ username: 'new' }));
  });

  it('returns 403 when safety-net user creation fails', async () => {
    mockVerify.mockResolvedValueOnce({ email: 'new@test.com' });
    mockGetUserByEmail.mockResolvedValueOnce(null);
    mockCreateUser.mockRejectedValueOnce(new Error('DB failure'));
    const handler = withAuth(async () => ({ statusCode: 200, body: '{}' }));
    const res = (await handler(makeEvent('Bearer valid-token'))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(403);
  });
});
