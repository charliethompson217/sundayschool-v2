import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser, mockGetAllUsersWeekPicks } = vi.hoisted(() => ({
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
  mockGetAllUsersWeekPicks: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    PicksTable: { name: 'test-picks' },
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

vi.mock('../../db/picks/picks', () => ({
  getAllUsersWeekPicks: mockGetAllUsersWeekPicks,
}));

import { handler } from './submissions-get';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makePicksRecord = (userId: string) => ({
  pk: `USER#${userId}`,
  sk: 'SEASON#2024#TYPE#2#WEEK#1',
  gsi1pk: 'SEASON#2024#TYPE#2#WEEK#1',
  gsi1sk: `USER#${userId}`,
  userId,
  year: '2024',
  season_type: '2',
  week: '1',
  kind: 'regular' as const,
  picks: {
    rankedPicks: [{ matchup: ['KC', 'BAL'] as [string, string], winner: 'KC' }],
    filedPicks: [],
  },
  submitted_at: '2024-09-06T16:00:00.000Z',
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(params: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    pathParameters: params,
    headers: { authorization: 'Bearer mock-token' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/admin/submissions/2024/2/1' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(params: Record<string, string>) {
  return await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>)(
    makeEvent(params),
  );
}

function body(res: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(res.body as string) as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('admin/submissions-get handler', () => {
  beforeEach(() => {
    mockGetAllUsersWeekPicks.mockResolvedValue([makePicksRecord('user-1'), makePicksRecord('user-2')]);
  });

  afterEach(() => {
    mockUser.isAdmin = true;
    vi.clearAllMocks();
  });

  // ── Auth / admin guard ────────────────────────────────────────────────────

  it('returns 403 for non-admin users', async () => {
    mockUser.isAdmin = false;
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(res.statusCode).toBe(403);
    expect(mockGetAllUsersWeekPicks).not.toHaveBeenCalled();
  });

  it('returns 403 before checking path params for non-admin users', async () => {
    mockUser.isAdmin = false;
    const res = await invoke({});
    expect(res.statusCode).toBe(403);
  });

  // ── Path parameter validation ─────────────────────────────────────────────

  it('returns 400 when path parameters are missing', async () => {
    const res = await invoke({});
    expect(res.statusCode).toBe(400);
    expect(body(res).error).toMatch(/[Mm]issing/);
  });

  it('returns 400 when year is missing', async () => {
    const res = await invoke({ seasonType: '2', week: '1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when seasonType is missing', async () => {
    const res = await invoke({ year: '2024', week: '1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when week is missing', async () => {
    const res = await invoke({ year: '2024', seasonType: '2' });
    expect(res.statusCode).toBe(400);
  });

  // ── Successful retrieval ──────────────────────────────────────────────────

  it('returns 200 with submissions keyed by userId', async () => {
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(res.statusCode).toBe(200);
    const submissions = body(res).submissions as Record<string, unknown>;
    expect(submissions['user-1']).toBeDefined();
    expect(submissions['user-2']).toBeDefined();
  });

  it('returns an empty submissions object when no picks have been submitted', async () => {
    mockGetAllUsersWeekPicks.mockResolvedValue([]);
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(res.statusCode).toBe(200);
    expect(body(res).submissions).toEqual({});
  });

  it('calls getAllUsersWeekPicks with the correct table name and path params', async () => {
    await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(mockGetAllUsersWeekPicks).toHaveBeenCalledWith('test-picks', '2024', '2', '1');
  });

  it('includes full pick records as values in the submissions map', async () => {
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' });
    const submissions = body(res).submissions as Record<string, Record<string, unknown>>;
    expect(submissions['user-1']).toMatchObject({ userId: 'user-1', kind: 'regular' });
  });

  it('handles a single user submission correctly', async () => {
    mockGetAllUsersWeekPicks.mockResolvedValue([makePicksRecord('user-only')]);
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(res.statusCode).toBe(200);
    const submissions = body(res).submissions as Record<string, unknown>;
    expect(Object.keys(submissions)).toHaveLength(1);
    expect(submissions['user-only']).toBeDefined();
  });
});
