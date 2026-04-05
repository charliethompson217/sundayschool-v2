import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockUser,
  mockListAllWeekMetas,
  mockListSeasonWeekMetas,
  mockGetWeekMeta,
  mockGetWeekGames,
  mockGetGamesByWeek,
} = vi.hoisted(() => ({
  mockUser: {
    id: 'user-1',
    email: 'admin@test.com',
    username: 'admin',
    firstName: 'Test',
    lastName: 'Admin',
    phone: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isAdmin: true,
    isSystemAdmin: false,
    isActive: true,
    isVerified: true,
    isPlayer: false,
  },
  mockListAllWeekMetas: vi.fn(),
  mockListSeasonWeekMetas: vi.fn(),
  mockGetWeekMeta: vi.fn(),
  mockGetWeekGames: vi.fn(),
  mockGetGamesByWeek: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    SchedulesTable: { name: 'test-schedules' },
    EspnGames: { name: 'test-espn' },
    UsersTable: { name: 'test-users' },
    UserPool: { id: 'test-pool' },
    WebClient: { id: 'test-client' },
  },
}));

vi.mock('../lib/cognito-auth', () => ({
  withAuth: (handler: (event: unknown, user: typeof mockUser) => Promise<unknown>) => (event: unknown) =>
    handler(event, mockUser),
}));

vi.mock('../lib/schedules-dynamo', () => ({
  listAllWeekMetas: mockListAllWeekMetas,
  listSeasonWeekMetas: mockListSeasonWeekMetas,
  getWeekMeta: mockGetWeekMeta,
  getWeekGames: mockGetWeekGames,
}));

vi.mock('../lib/espn-read', () => ({
  getGamesByWeek: mockGetGamesByWeek,
}));

import { handler as listHandler } from '../admin-schedules-list';
import { handler as getHandler } from '../admin-schedules-get';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const publishedMeta = {
  pk: 'SEASON#2024#TYPE#2#WEEK#1',
  sk: 'META' as const,
  gsi1pk: 'SEASON#2024#TYPE#2',
  gsi1sk: 'WEEK#1#META',
  year: '2024',
  season_type: '2',
  week: '1',
  kind: 'regular' as const,
  is_published: true,
  submission_opens_at: '2024-09-04T12:00:00.000Z',
  submission_closes_at: '2024-09-06T17:00:00.000Z',
};

const draftMeta = { ...publishedMeta, week: '2', is_published: false };

const scheduleGame = {
  pk: 'SEASON#2024#TYPE#2#WEEK#1',
  sk: 'GAME#401547417',
  year: '2024',
  season_type: '2',
  week: '1',
  game_id: '401547417',
  include_in_rank: true,
  include_in_file: true,
};

const espnGame = {
  pk: 'SEASON#2024#TYPE#2#WEEK#1',
  sk: 'GAME#2024-09-06T00:20Z#401547417',
  game_id: '401547417',
  competition_id: '401547417',
  year: '2024',
  season_type: '2',
  week: '1',
  week_text: 'Week 1',
  start_time: '2024-09-06T00:20Z',
  home_team_id: '12',
  away_team_id: '1',
  home: 'KC',
  away: 'BAL',
  entity_type: 'espn_game',
  source_event_type: 'schedule_upsert' as const,
  espn_updated_at: '2024-09-06T00:00:00Z',
  ingested_at: '2024-09-06T00:00:01Z',
  gsi1pk: 'GAME#401547417',
  gsi1sk: 'GAME#401547417',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeListEvent(qs: Record<string, string> = {}): APIGatewayProxyEventV2 {
  return {
    queryStringParameters: qs,
    pathParameters: {},
    headers: { authorization: 'Bearer mock-token' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/schedules' } },
  } as unknown as APIGatewayProxyEventV2;
}

function makeGetEvent(params: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    pathParameters: params,
    queryStringParameters: {},
    headers: { authorization: 'Bearer mock-token' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/schedules/year/type/week' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(
  handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>,
  event: APIGatewayProxyEventV2,
) {
  return (await handler(event)) as APIGatewayProxyStructuredResultV2;
}

function body(res: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(res.body as string) as Record<string, unknown>;
}

// ── GET /schedules ────────────────────────────────────────────────────────────

describe('admin-schedules-list handler', () => {
  beforeEach(() => {
    mockListAllWeekMetas.mockResolvedValue([publishedMeta, draftMeta]);
    mockListSeasonWeekMetas.mockResolvedValue([publishedMeta]);
  });

  afterEach(() => {
    mockUser.isAdmin = true;
    vi.clearAllMocks();
  });

  it('returns 200 with all weeks for an admin user (no filter)', async () => {
    const res = await invoke(listHandler, makeListEvent());
    expect(res.statusCode).toBe(200);
    expect((body(res).weeks as unknown[]).length).toBe(2);
    expect(body(res).count).toBe(2);
    expect(mockListAllWeekMetas).toHaveBeenCalledOnce();
  });

  it('uses GSI1 query when year and seasonType are both provided', async () => {
    const res = await invoke(listHandler, makeListEvent({ year: '2024', seasonType: '2' }));
    expect(res.statusCode).toBe(200);
    expect(mockListSeasonWeekMetas).toHaveBeenCalledWith('test-schedules', '2024', '2');
    expect(mockListAllWeekMetas).not.toHaveBeenCalled();
  });

  it('falls back to scan + filter when only year is provided', async () => {
    const res = await invoke(listHandler, makeListEvent({ year: '2024' }));
    expect(res.statusCode).toBe(200);
    expect(mockListAllWeekMetas).toHaveBeenCalledOnce();
    expect(mockListSeasonWeekMetas).not.toHaveBeenCalled();
  });

  it('returns only published weeks for non-admin users', async () => {
    mockUser.isAdmin = false;
    const res = await invoke(listHandler, makeListEvent());
    expect(res.statusCode).toBe(200);
    const weeks = body(res).weeks as (typeof publishedMeta)[];
    expect(weeks.every((w) => w.is_published)).toBe(true);
    expect(weeks.length).toBe(1);
  });

  it('returns all weeks (including drafts) for admin users', async () => {
    const res = await invoke(listHandler, makeListEvent());
    const weeks = body(res).weeks as (typeof publishedMeta)[];
    expect(weeks.some((w) => !w.is_published)).toBe(true);
  });
});

// ── GET /schedules/{year}/{seasonType}/{week} ─────────────────────────────────

describe('admin-schedules-get handler', () => {
  beforeEach(() => {
    mockGetWeekMeta.mockResolvedValue(publishedMeta);
    mockGetWeekGames.mockResolvedValue([scheduleGame]);
    mockGetGamesByWeek.mockResolvedValue([espnGame]);
  });

  afterEach(() => {
    mockUser.isAdmin = true;
    vi.clearAllMocks();
  });

  it('returns 400 when path parameters are missing', async () => {
    const res = await invoke(getHandler, makeGetEvent({}));
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the week META does not exist', async () => {
    mockGetWeekMeta.mockResolvedValue(null);
    const res = await invoke(getHandler, makeGetEvent({ year: '2024', seasonType: '2', week: '99' }));
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for non-admin users trying to view an unpublished week', async () => {
    mockUser.isAdmin = false;
    mockGetWeekMeta.mockResolvedValue({ ...publishedMeta, is_published: false });

    const res = await invoke(getHandler, makeGetEvent({ year: '2024', seasonType: '2', week: '1' }));
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with meta and enriched games for an admin', async () => {
    const res = await invoke(getHandler, makeGetEvent({ year: '2024', seasonType: '2', week: '1' }));
    expect(res.statusCode).toBe(200);
    const b = body(res);
    expect(b.meta).toMatchObject({ week: '1', kind: 'regular' });
    const games = b.games as Array<Record<string, unknown>>;
    expect(games).toHaveLength(1);
    expect(games[0]?.espn).toMatchObject({ game_id: '401547417', home: 'KC', away: 'BAL' });
  });

  it('sets espn = null for games with no matching ESPN record', async () => {
    mockGetGamesByWeek.mockResolvedValue([]); // no ESPN data

    const res = await invoke(getHandler, makeGetEvent({ year: '2024', seasonType: '2', week: '1' }));
    expect(res.statusCode).toBe(200);
    const games = body(res).games as Array<Record<string, unknown>>;
    expect(games[0]?.espn).toBeNull();
  });

  it('allows non-admin users to view published weeks', async () => {
    mockUser.isAdmin = false;

    const res = await invoke(getHandler, makeGetEvent({ year: '2024', seasonType: '2', week: '1' }));
    expect(res.statusCode).toBe(200);
  });

  it('queries both tables in parallel', async () => {
    await invoke(getHandler, makeGetEvent({ year: '2024', seasonType: '2', week: '1' }));

    expect(mockGetWeekGames).toHaveBeenCalledWith('test-schedules', '2024', '2', '1');
    expect(mockGetGamesByWeek).toHaveBeenCalledWith('test-espn', '2024', '2', '1');
  });
});
