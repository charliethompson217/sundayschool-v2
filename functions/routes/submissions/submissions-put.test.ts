import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser, mockGetWeekMeta, mockPutPicks, mockBuildRegularSeasonPicksItem, mockBuildPlayoffPicksItem } =
  vi.hoisted(() => ({
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
    mockGetWeekMeta: vi.fn(),
    mockPutPicks: vi.fn(),
    mockBuildRegularSeasonPicksItem: vi.fn(),
    mockBuildPlayoffPicksItem: vi.fn(),
  }));

vi.mock('sst', () => ({
  Resource: {
    PicksTable: { name: 'test-picks' },
    SchedulesTable: { name: 'test-schedules' },
    UsersTable: { name: 'test-users' },
    UserPool: { id: 'test-pool' },
    WebClient: { id: 'test-client' },
  },
}));

vi.mock('../../utils/auth/cognito-auth', () => ({
  withAuth: (inner: (event: unknown, user: typeof mockUser) => Promise<unknown>) => (event: unknown) =>
    inner(event, mockUser),
}));

vi.mock('../../db/schedules/schedules', () => ({
  getWeekMeta: mockGetWeekMeta,
}));

vi.mock('../../db/picks/picks', () => ({
  putPicks: mockPutPicks,
  buildRegularSeasonPicksItem: mockBuildRegularSeasonPicksItem,
  buildPlayoffPicksItem: mockBuildPlayoffPicksItem,
}));

import { handler } from './submissions-put';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const OPEN_META = {
  pk: 'SEASON#2024#TYPE#2#WEEK#1',
  sk: 'META' as const,
  gsi1pk: 'SEASON#2024#TYPE#2',
  gsi1sk: 'WEEK#1#META',
  year: '2024',
  season_type: '2',
  week: '1',
  kind: 'regular' as const,
  is_published: true,
  submission_opens_at: '2020-01-01T00:00:00.000Z',
  // Far future — window is still open
  submission_closes_at: '2099-12-31T23:59:59.000Z',
};

const CLOSED_META = {
  ...OPEN_META,
  // Past date — window is closed
  submission_closes_at: '2020-01-01T00:00:00.000Z',
};

const NO_DEADLINE_META = {
  ...OPEN_META,
  submission_closes_at: null,
};

const VALID_REGULAR_PICKS = {
  rankedPicks: [{ matchup: ['KC', 'BAL'] as [string, string], winner: 'KC' }],
  filedPicks: [],
};

const VALID_PLAYOFF_PICKS = {
  straightBets: [{ gameId: 'g1', side: 'home' as const, amount: 10 }],
  parlayBet: null,
};

const REGULAR_PICKS_ITEM = {
  pk: 'USER#user-1',
  sk: 'SEASON#2024#TYPE#2#WEEK#1',
  userId: 'user-1',
  kind: 'regular' as const,
  picks: VALID_REGULAR_PICKS,
  submitted_at: '2024-01-01T12:00:00.000Z',
};

const PLAYOFF_PICKS_ITEM = {
  pk: 'USER#user-1',
  sk: 'SEASON#2024#TYPE#2#WEEK#1',
  userId: 'user-1',
  kind: 'playoff' as const,
  picks: VALID_PLAYOFF_PICKS,
  submitted_at: '2024-01-01T12:00:00.000Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(params: Record<string, string>, body: unknown): APIGatewayProxyEventV2 {
  return {
    pathParameters: params,
    body: JSON.stringify(body),
    headers: { authorization: 'Bearer mock-token' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'PUT', path: '/submissions/2024/2/1' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(params: Record<string, string>, body: unknown) {
  return await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>)(
    makeEvent(params, body),
  );
}

function body(res: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(res.body as string) as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('submissions-put handler', () => {
  beforeEach(() => {
    mockGetWeekMeta.mockResolvedValue(OPEN_META);
    mockPutPicks.mockResolvedValue(undefined);
    mockBuildRegularSeasonPicksItem.mockReturnValue(REGULAR_PICKS_ITEM);
    mockBuildPlayoffPicksItem.mockReturnValue(PLAYOFF_PICKS_ITEM);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Path parameter validation ─────────────────────────────────────────────

  it('returns 400 when path parameters are missing', async () => {
    const res = await invoke({}, { kind: 'regular', picks: VALID_REGULAR_PICKS });
    expect(res.statusCode).toBe(400);
    expect(body(res).error).toMatch(/[Mm]issing/);
  });

  it('returns 400 when year is missing', async () => {
    const res = await invoke({ seasonType: '2', week: '1' }, { kind: 'regular', picks: VALID_REGULAR_PICKS });
    expect(res.statusCode).toBe(400);
  });

  // ── Week meta / deadline checks ───────────────────────────────────────────

  it('returns 404 when the week meta does not exist', async () => {
    mockGetWeekMeta.mockResolvedValue(null);
    const res = await invoke(
      { year: '2024', seasonType: '2', week: '1' },
      { kind: 'regular', picks: VALID_REGULAR_PICKS },
    );
    expect(res.statusCode).toBe(404);
    expect(body(res).error).toMatch(/[Nn]ot found/);
  });

  it('returns 409 when the submission window has closed', async () => {
    mockGetWeekMeta.mockResolvedValue(CLOSED_META);
    const res = await invoke(
      { year: '2024', seasonType: '2', week: '1' },
      { kind: 'regular', picks: VALID_REGULAR_PICKS },
    );
    expect(res.statusCode).toBe(409);
    expect(body(res).error).toMatch(/[Cc]losed/);
    expect(body(res).closes_at).toBe(CLOSED_META.submission_closes_at);
  });

  it('allows submission when submission_closes_at is null (no deadline)', async () => {
    mockGetWeekMeta.mockResolvedValue(NO_DEADLINE_META);
    const res = await invoke(
      { year: '2024', seasonType: '2', week: '1' },
      { kind: 'regular', picks: VALID_REGULAR_PICKS },
    );
    expect(res.statusCode).toBe(200);
  });

  it('allows submission when submission_closes_at is in the future', async () => {
    const res = await invoke(
      { year: '2024', seasonType: '2', week: '1' },
      { kind: 'regular', picks: VALID_REGULAR_PICKS },
    );
    expect(res.statusCode).toBe(200);
  });

  it('looks up the week meta with the correct table name and path params', async () => {
    await invoke({ year: '2024', seasonType: '2', week: '1' }, { kind: 'regular', picks: VALID_REGULAR_PICKS });
    expect(mockGetWeekMeta).toHaveBeenCalledWith('test-schedules', '2024', '2', '1');
  });

  // ── Body validation ───────────────────────────────────────────────────────

  it('returns 400 for invalid JSON body', async () => {
    const event = {
      pathParameters: { year: '2024', seasonType: '2', week: '1' },
      body: 'not-json',
      headers: { authorization: 'Bearer mock-token' },
      isBase64Encoded: false,
      requestContext: { http: { method: 'PUT', path: '/submissions/2024/2/1' } },
    } as unknown as APIGatewayProxyEventV2;
    const res = await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>)(event);
    expect(res.statusCode).toBe(400);
    expect(body(res).error).toMatch(/[Ii]nvalid JSON/);
  });

  it('returns 400 when body is missing "kind"', async () => {
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' }, { picks: VALID_REGULAR_PICKS });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when body is missing "picks"', async () => {
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' }, { kind: 'regular' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when kind is not "regular" or "playoff"', async () => {
    const res = await invoke({ year: '2024', seasonType: '2', week: '1' }, { kind: 'unknown', picks: {} });
    expect(res.statusCode).toBe(400);
    expect(body(res).error).toMatch(/"regular" or "playoff"/);
  });

  // ── Regular season picks ──────────────────────────────────────────────────

  it('returns 200 and the picks item for valid regular season picks', async () => {
    const res = await invoke(
      { year: '2024', seasonType: '2', week: '1' },
      { kind: 'regular', picks: VALID_REGULAR_PICKS },
    );
    expect(res.statusCode).toBe(200);
    expect(body(res).picks).toMatchObject({ kind: 'regular' });
  });

  it('returns 422 for invalid regular season picks', async () => {
    const res = await invoke(
      { year: '2024', seasonType: '2', week: '1' },
      { kind: 'regular', picks: { rankedPicks: [], filedPicks: [] } },
    );
    expect(res.statusCode).toBe(422);
    expect(body(res).error).toMatch(/[Ii]nvalid/);
  });

  it('calls putPicks with the correct table and item for regular picks', async () => {
    await invoke({ year: '2024', seasonType: '2', week: '1' }, { kind: 'regular', picks: VALID_REGULAR_PICKS });
    expect(mockPutPicks).toHaveBeenCalledWith('test-picks', REGULAR_PICKS_ITEM);
  });

  // ── Playoff picks ─────────────────────────────────────────────────────────

  it('returns 200 and the picks item for valid playoff picks', async () => {
    const res = await invoke(
      { year: '2024', seasonType: '3', week: '1' },
      { kind: 'playoff', picks: VALID_PLAYOFF_PICKS },
    );
    expect(res.statusCode).toBe(200);
    expect(body(res).picks).toMatchObject({ kind: 'playoff' });
  });

  it('returns 422 for invalid playoff picks', async () => {
    const res = await invoke(
      { year: '2024', seasonType: '3', week: '1' },
      { kind: 'playoff', picks: { straightBets: 'not-an-array', parlayBet: null } },
    );
    expect(res.statusCode).toBe(422);
    expect(body(res).error).toMatch(/[Ii]nvalid/);
  });

  it('calls putPicks with the correct table and item for playoff picks', async () => {
    await invoke({ year: '2024', seasonType: '3', week: '1' }, { kind: 'playoff', picks: VALID_PLAYOFF_PICKS });
    expect(mockPutPicks).toHaveBeenCalledWith('test-picks', PLAYOFF_PICKS_ITEM);
  });
});
