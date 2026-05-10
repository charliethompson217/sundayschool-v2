import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser, mockGetUserSeasonPicks } = vi.hoisted(() => ({
  mockUser: {
    id: 'user-1',
    email: 'player@test.com',
    username: 'player',
    firstName: 'Test',
    lastName: 'Player',
    phone: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isAdmin: false,
    isSystemAdmin: false,
    isActive: true,
    isVerified: true,
    isPlayer: true,
  },
  mockGetUserSeasonPicks: vi.fn(),
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
  withAuth: (inner: (event: unknown, user: typeof mockUser) => Promise<unknown>) => (event: unknown) =>
    inner(event, mockUser),
}));

vi.mock('../../db/picks/picks', () => ({
  getUserSeasonPicks: mockGetUserSeasonPicks,
}));

import { handler } from './submissions-list';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makePicksRecord = (week: string) => ({
  pk: `USER#user-1`,
  sk: `SEASON#2024#TYPE#2#WEEK#${week}`,
  gsi1pk: `SEASON#2024#TYPE#2#WEEK#${week}`,
  gsi1sk: 'USER#user-1',
  userId: 'user-1',
  year: '2024',
  season_type: '2',
  week,
  kind: 'regular' as const,
  picks: {
    rankedPicks: [{ gameId: 'KC-BAL', winner: 'KC' }],
    filedPicks: [],
  },
  submitted_at: `2024-09-0${week}T16:00:00.000Z`,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(params: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    pathParameters: params,
    headers: { authorization: 'Bearer mock-token' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/submissions/2024/2' } },
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

describe('submissions-list handler', () => {
  beforeEach(() => {
    mockGetUserSeasonPicks.mockResolvedValue([makePicksRecord('1'), makePicksRecord('2')]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when path parameters are missing', async () => {
    const res = await invoke({});
    expect(res.statusCode).toBe(400);
    expect(body(res).error).toMatch(/[Mm]issing/);
  });

  it('returns 400 when year is missing', async () => {
    const res = await invoke({ seasonType: '2' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when seasonType is missing', async () => {
    const res = await invoke({ year: '2024' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with submissions keyed by integer week', async () => {
    const res = await invoke({ year: '2024', seasonType: '2' });
    expect(res.statusCode).toBe(200);
    const submissions = body(res).submissions as Record<string, unknown>;
    expect(submissions[1]).toBeDefined();
    expect(submissions[2]).toBeDefined();
  });

  it('keys submissions by parsed integer week number', async () => {
    const res = await invoke({ year: '2024', seasonType: '2' });
    const submissions = body(res).submissions as Record<string, unknown>;
    // Keys should be integers (JSON keys are strings but parsed from parseInt)
    expect(Object.keys(submissions)).toContain('1');
    expect(Object.keys(submissions)).toContain('2');
  });

  it('returns an empty submissions object when no picks exist', async () => {
    mockGetUserSeasonPicks.mockResolvedValue([]);
    const res = await invoke({ year: '2024', seasonType: '2' });
    expect(res.statusCode).toBe(200);
    expect(body(res).submissions).toEqual({});
  });

  it('calls getUserSeasonPicks with the correct table name and path params', async () => {
    await invoke({ year: '2024', seasonType: '2' });
    expect(mockGetUserSeasonPicks).toHaveBeenCalledWith('test-picks', 'user-1', '2024', '2');
  });

  it('uses the authenticated user id for the lookup', async () => {
    await invoke({ year: '2025', seasonType: '3' });
    const [, userId] = mockGetUserSeasonPicks.mock.calls[0] as [string, string];
    expect(userId).toBe('user-1');
  });

  it('stores the full picks payload as the value for each week', async () => {
    const res = await invoke({ year: '2024', seasonType: '2' });
    const submissions = body(res).submissions as Record<number, unknown>;
    const week1 = submissions[1] as Record<string, unknown>;
    expect(week1).toHaveProperty('rankedPicks');
    expect(week1).toHaveProperty('filedPicks');
  });
});
