import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const makeCmd = () =>
    class {
      readonly input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    };
  return {
    DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
    QueryCommand: makeCmd(),
    ScanCommand: makeCmd(),
  };
});

import { getGameById, getGamesByWeek, getGamesBySeason, getGamesByYear } from './reads';

const TABLE = 'test-espn-games';

const mockGame = {
  pk: 'SEASON#2024#TYPE#2#WEEK#1',
  sk: 'GAME#401547417',
  game_id: '401547417',
  competition_id: 'c1',
  year: '2024',
  season_type: '2',
  week: '1',
  week_text: 'Week 1',
  start_time: '2024-09-06T00:20Z',
  home_team_id: '1',
  away_team_id: '2',
  home: 'KC',
  away: 'BAL',
  entity_type: 'game',
  source_event_type: 'schedule_upsert' as const,
  espn_updated_at: '2024-09-01T00:00:00Z',
  ingested_at: '2024-09-01T00:00:00Z',
};

// ── getGameById ───────────────────────────────────────────────────────────────

describe('getGameById', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns the game when found via GSI', async () => {
    mockSend.mockResolvedValueOnce({ Items: [mockGame] });
    const result = await getGameById(TABLE, '401547417');
    expect(result).toEqual(mockGame);
  });

  it('returns null when no item is found', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getGameById(TABLE, 'unknown');
    expect(result).toBeNull();
  });

  it('returns null when Items is undefined', async () => {
    mockSend.mockResolvedValueOnce({ Items: undefined });
    const result = await getGameById(TABLE, 'unknown');
    expect(result).toBeNull();
  });

  it('queries GSI1 with gsi1pk = GAME#<gameId>', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getGameById(TABLE, '401547417');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.IndexName).toBe('gsi1');
    const values = cmd.input.ExpressionAttributeValues as Record<string, string>;
    expect(Object.values(values)).toContain('GAME#401547417');
  });

  it('limits to 1 result', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getGameById(TABLE, '401547417');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.Limit).toBe(1);
  });
});

// ── getGamesByWeek ────────────────────────────────────────────────────────────

describe('getGamesByWeek', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns all games for the week', async () => {
    mockSend.mockResolvedValueOnce({ Items: [mockGame] });
    const result = await getGamesByWeek(TABLE, '2024', '2', '1');
    expect(result).toEqual([mockGame]);
  });

  it('returns an empty array when Items is undefined', async () => {
    mockSend.mockResolvedValueOnce({ Items: undefined });
    const result = await getGamesByWeek(TABLE, '2024', '2', '99');
    expect(result).toEqual([]);
  });

  it('queries by the correct week pk', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getGamesByWeek(TABLE, '2024', '2', '1');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const values = cmd.input.ExpressionAttributeValues as Record<string, string>;
    expect(Object.values(values)).toContain('SEASON#2024#TYPE#2#WEEK#1');
  });
});

// ── getGamesBySeason ──────────────────────────────────────────────────────────

describe('getGamesBySeason', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns all games for a season in a single page', async () => {
    mockSend.mockResolvedValueOnce({ Items: [mockGame], LastEvaluatedKey: undefined });
    const result = await getGamesBySeason(TABLE, '2024', '2');
    expect(result).toEqual([mockGame]);
  });

  it('paginates through multiple scan pages', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [mockGame], LastEvaluatedKey: { pk: 'x' } })
      .mockResolvedValueOnce({ Items: [{ ...mockGame, game_id: '401547418' }], LastEvaluatedKey: undefined });
    const result = await getGamesBySeason(TABLE, '2024', '2');
    expect(result).toHaveLength(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('includes year and season_type in the filter', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await getGamesBySeason(TABLE, '2024', '2');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const values = cmd.input.ExpressionAttributeValues as Record<string, string>;
    expect(Object.values(values)).toContain('2024');
    expect(Object.values(values)).toContain('2');
  });

  it('passes ExclusiveStartKey on subsequent pages', async () => {
    const startKey = { pk: 'page-1' };
    mockSend
      .mockResolvedValueOnce({ Items: [mockGame], LastEvaluatedKey: startKey })
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await getGamesBySeason(TABLE, '2024', '2');
    const secondCall = mockSend.mock.calls[1][0] as { input: Record<string, unknown> };
    expect(secondCall.input.ExclusiveStartKey).toEqual(startKey);
  });
});

// ── getGamesByYear ────────────────────────────────────────────────────────────

describe('getGamesByYear', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns all games for a year in a single page', async () => {
    mockSend.mockResolvedValueOnce({ Items: [mockGame], LastEvaluatedKey: undefined });
    const result = await getGamesByYear(TABLE, '2024');
    expect(result).toEqual([mockGame]);
  });

  it('paginates through multiple scan pages', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [mockGame], LastEvaluatedKey: { pk: 'x' } })
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    const result = await getGamesByYear(TABLE, '2024');
    expect(result).toHaveLength(1);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('includes year in the filter expression', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await getGamesByYear(TABLE, '2025');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const values = cmd.input.ExpressionAttributeValues as Record<string, string>;
    expect(Object.values(values)).toContain('2025');
  });

  it('returns an empty array when there are no games', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    const result = await getGamesByYear(TABLE, '2020');
    expect(result).toEqual([]);
  });
});
