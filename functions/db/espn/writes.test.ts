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
    UpdateCommand: makeCmd(),
    PutCommand: makeCmd(),
    GetCommand: makeCmd(),
    QueryCommand: makeCmd(),
    ScanCommand: makeCmd(),
    DeleteCommand: makeCmd(),
  };
});

import {
  buildGameSk,
  buildGameLookupGsiPk,
  computeContentHash,
  deriveIsInternational,
  writeScheduleUpsert,
  writeGameFinal,
} from './writes';

import type { ScheduleUpsertGame, GameFinalGame } from '@/types/espn';

describe('buildGameSk', () => {
  it('formats correctly', () => {
    expect(buildGameSk('2024-09-06T00:20Z', '401547417')).toBe('GAME#2024-09-06T00:20Z#401547417');
  });
});

describe('buildGameLookupGsiPk', () => {
  it('formats correctly', () => {
    expect(buildGameLookupGsiPk('401547417')).toBe('GAME#401547417');
  });
});

describe('computeContentHash', () => {
  it('produces consistent hash for same input', () => {
    const fields = { a: 1, b: 'two', c: true };
    expect(computeContentHash(fields)).toBe(computeContentHash(fields));
  });

  it('is order-independent', () => {
    const a = computeContentHash({ x: 1, y: 2 });
    const b = computeContentHash({ y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('changes when values differ', () => {
    const a = computeContentHash({ score: 27 });
    const b = computeContentHash({ score: 20 });
    expect(a).not.toBe(b);
  });

  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = computeContentHash({ k: 'v' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('deriveIsInternational', () => {
  it('returns false for USA', () => {
    expect(deriveIsInternational('USA')).toBe(false);
  });

  it('returns true for non-USA countries', () => {
    expect(deriveIsInternational('United Kingdom')).toBe(true);
    expect(deriveIsInternational('Germany')).toBe(true);
    expect(deriveIsInternational('Brazil')).toBe(true);
  });

  it('returns false for null', () => {
    expect(deriveIsInternational(null)).toBe(false);
  });
});

// ── writeScheduleUpsert ───────────────────────────────────────────────────────

const validScheduleGame: ScheduleUpsertGame = {
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
  competition_type: 'Standard',
  competition_type_slug: 'standard',
  neutral_site: false,
  venue_id: '3622',
  venue_full_name: 'GEHA Field at Arrowhead Stadium',
  venue_city: 'Kansas City',
  venue_state: 'Missouri',
  venue_country: 'USA',
};

describe('writeScheduleUpsert', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('sends a single UpdateCommand', async () => {
    await writeScheduleUpsert('test-espn-games', validScheduleGame, '2024-09-05T20:00:00Z');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('uses the correct pk and sk as the DynamoDB Key', async () => {
    await writeScheduleUpsert('test-espn-games', validScheduleGame, '2024-09-05T20:00:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const key = cmd.input.Key as Record<string, string>;
    expect(key.pk).toBe('SEASON#2024#TYPE#2#WEEK#1');
    expect(key.sk).toBe('GAME#2024-09-06T00:20Z#401547417');
  });

  it('targets the correct table', async () => {
    await writeScheduleUpsert('test-espn-games', validScheduleGame, '2024-09-05T20:00:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.TableName).toBe('test-espn-games');
  });

  it('sets is_international = false for a USA venue', async () => {
    await writeScheduleUpsert('test-espn-games', validScheduleGame, '2024-09-05T20:00:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const names = cmd.input.ExpressionAttributeNames as Record<string, string>;
    const values = cmd.input.ExpressionAttributeValues as Record<string, unknown>;
    const ref = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'is_international')?.[0];
    expect(ref).toBeDefined();
    expect(values[ref!.replace('#f', ':v')]).toBe(false);
  });

  it('sets is_international = true for a non-USA venue', async () => {
    await writeScheduleUpsert(
      'test-espn-games',
      { ...validScheduleGame, venue_country: 'United Kingdom' },
      '2024-10-13T13:00:00Z',
    );
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const names = cmd.input.ExpressionAttributeNames as Record<string, string>;
    const values = cmd.input.ExpressionAttributeValues as Record<string, unknown>;
    const ref = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'is_international')?.[0];
    expect(values[ref!.replace('#f', ':v')]).toBe(true);
  });

  it('sets source_event_type to schedule_upsert', async () => {
    await writeScheduleUpsert('test-espn-games', validScheduleGame, '2024-09-05T20:00:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const names = cmd.input.ExpressionAttributeNames as Record<string, string>;
    const values = cmd.input.ExpressionAttributeValues as Record<string, unknown>;
    const ref = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'source_event_type')?.[0];
    expect(values[ref!.replace('#f', ':v')]).toBe('schedule_upsert');
  });

  it('includes a schedule_hash in the update', async () => {
    await writeScheduleUpsert('test-espn-games', validScheduleGame, '2024-09-05T20:00:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const names = cmd.input.ExpressionAttributeNames as Record<string, string>;
    const values = cmd.input.ExpressionAttributeValues as Record<string, unknown>;
    const ref = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'schedule_hash')?.[0];
    expect(ref).toBeDefined();
    expect(typeof values[ref!.replace('#f', ':v')]).toBe('string');
  });
});

// ── writeGameFinal ────────────────────────────────────────────────────────────

const validFinalGame: GameFinalGame = {
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
  home_score: 27,
  away_score: 20,
  status: 'STATUS_FINAL',
  completed: true,
  winner: 'home',
};

describe('writeGameFinal', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('sends a single UpdateCommand', async () => {
    await writeGameFinal('test-espn-games', validFinalGame, '2024-09-06T03:30:00Z');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('uses the correct pk and sk as the DynamoDB Key', async () => {
    await writeGameFinal('test-espn-games', validFinalGame, '2024-09-06T03:30:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const key = cmd.input.Key as Record<string, string>;
    expect(key.pk).toBe('SEASON#2024#TYPE#2#WEEK#1');
    expect(key.sk).toBe('GAME#2024-09-06T00:20Z#401547417');
  });

  it('targets the correct table', async () => {
    await writeGameFinal('test-espn-games', validFinalGame, '2024-09-06T03:30:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.TableName).toBe('test-espn-games');
  });

  it('sets source_event_type to game_final', async () => {
    await writeGameFinal('test-espn-games', validFinalGame, '2024-09-06T03:30:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const names = cmd.input.ExpressionAttributeNames as Record<string, string>;
    const values = cmd.input.ExpressionAttributeValues as Record<string, unknown>;
    const ref = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'source_event_type')?.[0];
    expect(values[ref!.replace('#f', ':v')]).toBe('game_final');
  });

  it('includes score and result fields in the update', async () => {
    await writeGameFinal('test-espn-games', validFinalGame, '2024-09-06T03:30:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const names = cmd.input.ExpressionAttributeNames as Record<string, string>;
    const values = cmd.input.ExpressionAttributeValues as Record<string, unknown>;

    const homeScoreRef = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'home_score')?.[0];
    const awayScoreRef = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'away_score')?.[0];
    const completedRef = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'completed')?.[0];
    const winnerRef = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'winner')?.[0];

    expect(values[homeScoreRef!.replace('#f', ':v')]).toBe(27);
    expect(values[awayScoreRef!.replace('#f', ':v')]).toBe(20);
    expect(values[completedRef!.replace('#f', ':v')]).toBe(true);
    expect(values[winnerRef!.replace('#f', ':v')]).toBe('home');
  });

  it('includes a final_hash in the update', async () => {
    await writeGameFinal('test-espn-games', validFinalGame, '2024-09-06T03:30:00Z');
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const names = cmd.input.ExpressionAttributeNames as Record<string, string>;
    const values = cmd.input.ExpressionAttributeValues as Record<string, unknown>;
    const ref = (Object.entries(names) as [string, string][]).find(([, v]) => v === 'final_hash')?.[0];
    expect(ref).toBeDefined();
    expect(typeof values[ref!.replace('#f', ':v')]).toBe('string');
  });
});
