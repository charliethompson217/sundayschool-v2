import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser, mockBuildMetaItem, mockBuildGameItem, mockInsertWeek } = vi.hoisted(() => ({
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
  mockBuildMetaItem: vi.fn(),
  mockBuildGameItem: vi.fn(),
  mockInsertWeek: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    SchedulesTable: { name: 'test-schedules' },
    UsersTable: { name: 'test-users' },
    UserPool: { id: 'test-pool' },
    WebClient: { id: 'test-client' },
  },
}));

vi.mock('../../utils/auth/cognito-auth', () => ({
  withAuth: (handler: (event: unknown, user: typeof mockUser) => Promise<unknown>) => (event: unknown) =>
    handler(event, mockUser),
}));

vi.mock('../../db/schedules/schedules', () => ({
  buildMetaItem: mockBuildMetaItem,
  buildGameItem: mockBuildGameItem,
  insertWeek: mockInsertWeek,
}));

import { handler } from './schedules-insert';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const regularBody = {
  meta: {
    is_published: false,
    submission_opens_at: '2024-09-04T12:00:00.000Z',
    submission_closes_at: '2024-09-06T17:00:00.000Z',
  },
  games: [{ game_id: '401547417', include_in_rank: true, include_in_file: true }],
};

const playoffBody = {
  meta: {
    is_published: false,
    submission_opens_at: null,
    submission_closes_at: null,
    round_name: 'Wild Card',
    allow_straight_bets: true,
    allow_parlay: false,
    parlay_leg_count: 2,
  },
  games: [{ game_id: '401547417', is_wagerable: true }],
};

const builtMeta = {
  pk: 'SEASON#2024#TYPE#2#WEEK#1',
  sk: 'META' as const,
  gsi1pk: 'SEASON#2024#TYPE#2',
  gsi1sk: 'WEEK#1#META',
  year: '2024',
  season_type: '2',
  week: '1',
  kind: 'regular' as const,
  is_published: false,
  submission_opens_at: '2024-09-04T12:00:00.000Z',
  submission_closes_at: '2024-09-06T17:00:00.000Z',
};

const builtGame = {
  pk: 'SEASON#2024#TYPE#2#WEEK#1',
  sk: 'GAME#401547417',
  year: '2024',
  season_type: '2',
  week: '1',
  game_id: '401547417',
  include_in_rank: true,
  include_in_file: true,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(params: Record<string, string>, body: unknown): APIGatewayProxyEventV2 {
  return {
    pathParameters: params,
    queryStringParameters: {},
    body: JSON.stringify(body),
    headers: { authorization: 'Bearer mock-token', 'content-type': 'application/json' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'POST', path: '/admin/schedules' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(event: APIGatewayProxyEventV2) {
  return (await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>)(
    event,
  )) as APIGatewayProxyStructuredResultV2;
}

function parseBody(res: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(res.body as string) as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('schedules-insert handler', () => {
  beforeEach(() => {
    mockBuildMetaItem.mockReturnValue(builtMeta);
    mockBuildGameItem.mockReturnValue(builtGame);
    mockInsertWeek.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockUser.isAdmin = true;
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin users', async () => {
    mockUser.isAdmin = false;
    const res = await invoke(makeEvent({ year: '2024', seasonType: '2', week: '1' }, regularBody));
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when path parameters are missing', async () => {
    const res = await invoke(makeEvent({}, regularBody));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on invalid JSON body', async () => {
    const event = {
      pathParameters: { year: '2024', seasonType: '2', week: '1' },
      body: '{ bad json',
      headers: { authorization: 'Bearer mock-token' },
      isBase64Encoded: false,
      requestContext: { http: { method: 'POST' } },
    } as unknown as APIGatewayProxyEventV2;
    const res = await invoke(event);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when the request body fails Zod validation', async () => {
    const res = await invoke(
      makeEvent({ year: '2024', seasonType: '2', week: '1' }, { meta: { is_published: 'yes' }, games: [] }),
    );
    expect(res.statusCode).toBe(400);
    expect(parseBody(res).error).toBe('Validation failed');
  });

  it('returns 409 when the week already exists', async () => {
    mockInsertWeek.mockRejectedValueOnce(new Error('WEEK_EXISTS'));
    const res = await invoke(makeEvent({ year: '2024', seasonType: '2', week: '1' }, regularBody));
    expect(res.statusCode).toBe(409);
    expect(parseBody(res).error).toContain('already exists');
  });

  it('returns 201 on successful regular season insert', async () => {
    const res = await invoke(makeEvent({ year: '2024', seasonType: '2', week: '1' }, regularBody));
    expect(res.statusCode).toBe(201);
    expect(parseBody(res).meta).toMatchObject({ kind: 'regular', week: '1' });
  });

  it('calls buildMetaItem with correct args for regular season', async () => {
    await invoke(makeEvent({ year: '2024', seasonType: '2', week: '1' }, regularBody));
    expect(mockBuildMetaItem).toHaveBeenCalledWith('2024', '2', '1', regularBody.meta);
  });

  it('returns 201 on successful playoff insert', async () => {
    mockBuildMetaItem.mockReturnValue({ ...builtMeta, kind: 'playoff' as const });
    const res = await invoke(makeEvent({ year: '2024', seasonType: '3', week: '1' }, playoffBody));
    expect(res.statusCode).toBe(201);
    expect(mockInsertWeek).toHaveBeenCalledOnce();
  });

  it('returns 400 when a playoff body is sent with seasonType 2', async () => {
    const res = await invoke(makeEvent({ year: '2024', seasonType: '2', week: '1' }, playoffBody));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when a regular body is sent with seasonType 3', async () => {
    const res = await invoke(makeEvent({ year: '2024', seasonType: '3', week: '1' }, regularBody));
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 on unexpected DynamoDB error', async () => {
    mockInsertWeek.mockRejectedValueOnce(new Error('DynamoDB boom'));
    const res = await invoke(makeEvent({ year: '2024', seasonType: '2', week: '1' }, regularBody));
    expect(res.statusCode).toBe(500);
  });
});
