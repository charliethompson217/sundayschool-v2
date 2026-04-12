import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser, mockGetUserWeekPicks } = vi.hoisted(() => ({
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
  mockGetUserWeekPicks: vi.fn(),
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
  getUserWeekPicks: mockGetUserWeekPicks,
}));

import { handler } from './submissions-get';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PICKS_RECORD = {
  pk: 'USER#user-1',
  sk: 'SEASON#2024#TYPE#2#WEEK#1',
  gsi1pk: 'SEASON#2024#TYPE#2#WEEK#1',
  gsi1sk: 'USER#user-1',
  userId: 'user-1',
  year: '2024',
  season_type: '2',
  week: '1',
  kind: 'regular' as const,
  picks: {
    rankedPicks: [{ matchup: ['KC', 'BAL'] as [string, string], winner: 'KC' }],
    filedPicks: [],
  },
  submitted_at: '2024-09-06T16:00:00.000Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(params: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    pathParameters: params,
    headers: { authorization: 'Bearer mock-token' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/submissions/2024/2/1' } },
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

describe('submissions-get handler', () => {
  beforeEach(() => {
    mockGetUserWeekPicks.mockResolvedValue(PICKS_RECORD);
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

  it('returns 200 with the picks record when found', async () => {
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(res.statusCode).toBe(200);
    expect(body(res).picks).toMatchObject({ kind: 'regular', userId: 'user-1' });
  });

  it('returns 200 with null picks when no submission exists for the week', async () => {
    mockGetUserWeekPicks.mockResolvedValue(null);
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(res.statusCode).toBe(200);
    expect(body(res).picks).toBeNull();
  });

  it('calls getUserWeekPicks with the correct table name and path params', async () => {
    await invoke({ year: '2024', seasonType: '2', week: '1' });
    expect(mockGetUserWeekPicks).toHaveBeenCalledWith('test-picks', 'user-1', '2024', '2', '1');
  });

  it('uses the authenticated user id for the lookup', async () => {
    await invoke({ year: '2024', seasonType: '3', week: '2' });
    const [, userId] = mockGetUserWeekPicks.mock.calls[0] as [string, string];
    expect(userId).toBe('user-1');
  });

  it('passes through playoff week picks correctly', async () => {
    const playoffRecord = {
      ...PICKS_RECORD,
      season_type: '3',
      week: '2',
      kind: 'playoff' as const,
      picks: { straightBets: [], parlayBet: null },
    };
    mockGetUserWeekPicks.mockResolvedValue(playoffRecord);
    const res = await invoke({ year: '2024', seasonType: '3', week: '2' });
    expect(res.statusCode).toBe(200);
    expect(body(res).picks).toMatchObject({ kind: 'playoff' });
  });
});
