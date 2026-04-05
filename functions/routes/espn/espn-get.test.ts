import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockGetGameById, mockGetGamesByWeek, mockGetGamesBySeason, mockGetGamesByYear } = vi.hoisted(() => ({
  mockGetGameById: vi.fn(),
  mockGetGamesByWeek: vi.fn(),
  mockGetGamesBySeason: vi.fn(),
  mockGetGamesByYear: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    EspnGames: { name: 'test-espn-games' },
  },
}));

vi.mock('../../db/espn/reads', () => ({
  getGameById: mockGetGameById,
  getGamesByWeek: mockGetGamesByWeek,
  getGamesBySeason: mockGetGamesBySeason,
  getGamesByYear: mockGetGamesByYear,
}));

import { getHandler, listHandler } from './espn-get';

const mockGame = { game_id: '401547417', year: '2024', season_type: '2', week: '1' };

function makeGetEvent(gameId?: string): APIGatewayProxyEventV2 {
  return {
    pathParameters: gameId ? { gameId } : {},
    queryStringParameters: {},
    headers: {},
    body: null,
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET' } },
  } as unknown as APIGatewayProxyEventV2;
}

function makeListEvent(qs: Record<string, string> = {}): APIGatewayProxyEventV2 {
  return {
    pathParameters: {},
    queryStringParameters: qs,
    headers: {},
    body: null,
    isBase64Encoded: false,
    requestContext: { http: { method: 'GET' } },
  } as unknown as APIGatewayProxyEventV2;
}

function parseBody(res: APIGatewayProxyStructuredResultV2) {
  return JSON.parse(res.body as string) as Record<string, unknown>;
}

// ── getHandler ────────────────────────────────────────────────────────────────

describe('getHandler', () => {
  beforeEach(() => {
    mockGetGameById.mockReset();
  });

  it('returns 400 when gameId path parameter is missing', async () => {
    const res = (await getHandler(makeGetEvent())) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the game is not found', async () => {
    mockGetGameById.mockResolvedValueOnce(null);
    const res = (await getHandler(makeGetEvent('401547417'))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with the game when found', async () => {
    mockGetGameById.mockResolvedValueOnce(mockGame);
    const res = (await getHandler(makeGetEvent('401547417'))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(200);
    expect(parseBody(res).game).toEqual(mockGame);
  });

  it('calls getGameById with the correct table name and gameId', async () => {
    mockGetGameById.mockResolvedValueOnce(mockGame);
    await getHandler(makeGetEvent('401547417'));
    expect(mockGetGameById).toHaveBeenCalledWith('test-espn-games', '401547417');
  });
});

// ── listHandler ───────────────────────────────────────────────────────────────

describe('listHandler', () => {
  beforeEach(() => {
    mockGetGamesByWeek.mockReset();
    mockGetGamesBySeason.mockReset();
    mockGetGamesByYear.mockReset();
  });

  it('returns 400 when year query param is missing', async () => {
    const res = (await listHandler(makeListEvent())) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(400);
  });

  it('calls getGamesByWeek when year + seasonType + week are all provided', async () => {
    mockGetGamesByWeek.mockResolvedValueOnce([mockGame]);
    const res = (await listHandler(
      makeListEvent({ year: '2024', seasonType: '2', week: '1' }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(200);
    expect(mockGetGamesByWeek).toHaveBeenCalledWith('test-espn-games', '2024', '2', '1');
    expect(parseBody(res).count).toBe(1);
  });

  it('calls getGamesBySeason when year + seasonType are provided without week', async () => {
    mockGetGamesBySeason.mockResolvedValueOnce([mockGame, mockGame]);
    const res = (await listHandler(
      makeListEvent({ year: '2024', seasonType: '2' }),
    )) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(200);
    expect(mockGetGamesBySeason).toHaveBeenCalledWith('test-espn-games', '2024', '2');
    expect(parseBody(res).count).toBe(2);
  });

  it('calls getGamesByYear when only year is provided', async () => {
    mockGetGamesByYear.mockResolvedValueOnce([]);
    const res = (await listHandler(makeListEvent({ year: '2024' }))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(200);
    expect(mockGetGamesByYear).toHaveBeenCalledWith('test-espn-games', '2024');
    expect(parseBody(res).count).toBe(0);
  });

  it('returns the games array and count in the response body', async () => {
    mockGetGamesByYear.mockResolvedValueOnce([mockGame]);
    const res = (await listHandler(makeListEvent({ year: '2024' }))) as APIGatewayProxyStructuredResultV2;
    expect(parseBody(res).games).toEqual([mockGame]);
    expect(parseBody(res).count).toBe(1);
  });
});
