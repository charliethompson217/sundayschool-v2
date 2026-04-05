import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockUser, mockListAllWeekMetas, mockListSeasonWeekMetas } = vi.hoisted(() => ({
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
  listAllWeekMetas: mockListAllWeekMetas,
  listSeasonWeekMetas: mockListSeasonWeekMetas,
}));

import { handler } from './schedules-list';

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(qs: Record<string, string> = {}): APIGatewayProxyEventV2 {
  return {
    queryStringParameters: qs,
    pathParameters: {},
    headers: { authorization: 'Bearer mock-token' },
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET', path: '/schedules' } },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(event: APIGatewayProxyEventV2) {
  return (await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>)(
    event,
  )) as APIGatewayProxyStructuredResultV2;
}

function body(res: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(res.body as string) as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('schedules-list handler', () => {
  beforeEach(() => {
    mockListAllWeekMetas.mockResolvedValue([publishedMeta, draftMeta]);
    mockListSeasonWeekMetas.mockResolvedValue([publishedMeta]);
  });

  afterEach(() => {
    mockUser.isAdmin = true;
    vi.clearAllMocks();
  });

  it('returns 200 with all weeks for an admin user (no filter)', async () => {
    const res = await invoke(makeEvent());
    expect(res.statusCode).toBe(200);
    expect((body(res).weeks as unknown[]).length).toBe(2);
    expect(body(res).count).toBe(2);
    expect(mockListAllWeekMetas).toHaveBeenCalledOnce();
  });

  it('uses GSI1 query when year and seasonType are both provided', async () => {
    const res = await invoke(makeEvent({ year: '2024', seasonType: '2' }));
    expect(res.statusCode).toBe(200);
    expect(mockListSeasonWeekMetas).toHaveBeenCalledWith('test-schedules', '2024', '2');
    expect(mockListAllWeekMetas).not.toHaveBeenCalled();
  });

  it('falls back to scan + filter when only year is provided', async () => {
    const res = await invoke(makeEvent({ year: '2024' }));
    expect(res.statusCode).toBe(200);
    expect(mockListAllWeekMetas).toHaveBeenCalledOnce();
    expect(mockListSeasonWeekMetas).not.toHaveBeenCalled();
  });

  it('returns only published weeks for non-admin users', async () => {
    mockUser.isAdmin = false;
    const res = await invoke(makeEvent());
    expect(res.statusCode).toBe(200);
    const weeks = body(res).weeks as (typeof publishedMeta)[];
    expect(weeks.every((w) => w.is_published)).toBe(true);
    expect(weeks.length).toBe(1);
  });

  it('returns all weeks (including drafts) for admin users', async () => {
    const res = await invoke(makeEvent());
    const weeks = body(res).weeks as (typeof publishedMeta)[];
    expect(weeks.some((w) => !w.is_published)).toBe(true);
  });
});
