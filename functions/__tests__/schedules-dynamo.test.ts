import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { MockConditionalCheckFailedException, mockSend } = vi.hoisted(() => {
  class MockConditionalCheckFailedException extends Error {
    constructor() {
      super('ConditionalCheckFailed');
      this.name = 'ConditionalCheckFailedException';
    }
  }
  return {
    MockConditionalCheckFailedException,
    mockSend: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {},
  ConditionalCheckFailedException: MockConditionalCheckFailedException,
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
    PutCommand: makeCmd(),
    GetCommand: makeCmd(),
    QueryCommand: makeCmd(),
    ScanCommand: makeCmd(),
    DeleteCommand: makeCmd(),
    UpdateCommand: makeCmd(),
  };
});

import {
  buildGameItem,
  buildMetaItem,
  buildScheduleGameSk,
  buildScheduleGsi1pk,
  buildScheduleGsi1sk,
  getWeekGames,
  getWeekMeta,
  insertWeek,
  updateWeek,
  upsertScheduleFromEspn,
} from '../lib/schedules-dynamo';

const TABLE = 'test-schedules';

// ── Key builders ──────────────────────────────────────────────────────────────

describe('buildScheduleGameSk', () => {
  it('formats correctly', () => {
    expect(buildScheduleGameSk('401547417')).toBe('GAME#401547417');
  });
});

describe('buildScheduleGsi1pk', () => {
  it('formats a regular season key', () => {
    expect(buildScheduleGsi1pk('2024', '2')).toBe('SEASON#2024#TYPE#2');
  });

  it('formats a playoffs key', () => {
    expect(buildScheduleGsi1pk('2024', '3')).toBe('SEASON#2024#TYPE#3');
  });
});

describe('buildScheduleGsi1sk', () => {
  it('formats correctly', () => {
    expect(buildScheduleGsi1sk('1')).toBe('WEEK#1#META');
  });

  it('formats a double-digit week', () => {
    expect(buildScheduleGsi1sk('18')).toBe('WEEK#18#META');
  });
});

// ── buildMetaItem ─────────────────────────────────────────────────────────────

describe('buildMetaItem — regular season', () => {
  const input = {
    is_published: false,
    submission_opens_at: '2024-09-04T12:00:00.000Z',
    submission_closes_at: '2024-09-06T17:00:00.000Z',
    notes: 'Week 1',
  };

  it('sets the correct pk and sk', () => {
    const item = buildMetaItem('2024', '2', '1', input);
    expect(item.pk).toBe('SEASON#2024#TYPE#2#WEEK#1');
    expect(item.sk).toBe('META');
  });

  it('sets gsi1pk and gsi1sk for season-level querying', () => {
    const item = buildMetaItem('2024', '2', '7', input);
    expect(item.gsi1pk).toBe('SEASON#2024#TYPE#2');
    expect(item.gsi1sk).toBe('WEEK#7#META');
  });

  it('sets kind = regular for seasonType 2', () => {
    const item = buildMetaItem('2024', '2', '1', input);
    expect(item.kind).toBe('regular');
  });

  it('sets kind = regular for non-playoff season types', () => {
    const item = buildMetaItem('2024', '1', '1', input); // preseason
    expect(item.kind).toBe('regular');
  });

  it('copies all base meta fields', () => {
    const item = buildMetaItem('2024', '2', '1', input);
    expect(item.year).toBe('2024');
    expect(item.season_type).toBe('2');
    expect(item.week).toBe('1');
    expect(item.is_published).toBe(false);
    expect(item.submission_opens_at).toBe('2024-09-04T12:00:00.000Z');
    expect(item.submission_closes_at).toBe('2024-09-06T17:00:00.000Z');
    expect(item.notes).toBe('Week 1');
  });

  it('does not include playoff-only fields', () => {
    const item = buildMetaItem('2024', '2', '1', input);
    expect(item.round_name).toBeUndefined();
    expect(item.allow_straight_bets).toBeUndefined();
    expect(item.allow_parlay).toBeUndefined();
    expect(item.parlay_leg_count).toBeUndefined();
  });
});

describe('buildMetaItem — playoffs', () => {
  const playoffInput = {
    is_published: true,
    submission_opens_at: null,
    submission_closes_at: null,
    round_name: 'Wild Card',
    allow_straight_bets: true,
    allow_parlay: false,
    parlay_leg_count: 2,
  };

  it('sets kind = playoff for seasonType 3', () => {
    const item = buildMetaItem('2024', '3', '1', playoffInput);
    expect(item.kind).toBe('playoff');
  });

  it('includes all playoff-specific fields', () => {
    const item = buildMetaItem('2024', '3', '1', playoffInput);
    expect(item.round_name).toBe('Wild Card');
    expect(item.allow_straight_bets).toBe(true);
    expect(item.allow_parlay).toBe(false);
    expect(item.parlay_leg_count).toBe(2);
  });

  it('sets the correct GSI keys', () => {
    const item = buildMetaItem('2024', '3', '2', playoffInput);
    expect(item.gsi1pk).toBe('SEASON#2024#TYPE#3');
    expect(item.gsi1sk).toBe('WEEK#2#META');
  });
});

// ── buildGameItem ─────────────────────────────────────────────────────────────

describe('buildGameItem — regular season', () => {
  const input = {
    game_id: '401547417',
    include_in_rank: true,
    include_in_file: false,
    description: 'Sunday Night Football',
    special_tag: 'SNF',
  };

  it('sets the correct pk, sk, and identifiers', () => {
    const item = buildGameItem('2024', '2', '1', input);
    expect(item.pk).toBe('SEASON#2024#TYPE#2#WEEK#1');
    expect(item.sk).toBe('GAME#401547417');
    expect(item.game_id).toBe('401547417');
    expect(item.year).toBe('2024');
    expect(item.season_type).toBe('2');
    expect(item.week).toBe('1');
  });

  it('copies all regular-season fields', () => {
    const item = buildGameItem('2024', '2', '1', input);
    expect(item.include_in_rank).toBe(true);
    expect(item.include_in_file).toBe(false);
    expect(item.description).toBe('Sunday Night Football');
    expect(item.special_tag).toBe('SNF');
  });

  it('does not include playoff-only fields', () => {
    const item = buildGameItem('2024', '2', '1', input);
    expect(item.is_wagerable).toBeUndefined();
  });
});

describe('buildGameItem — playoffs', () => {
  const input = { game_id: '401547418', is_wagerable: true };

  it('sets is_wagerable', () => {
    const item = buildGameItem('2024', '3', '1', input);
    expect(item.is_wagerable).toBe(true);
  });

  it('does not include regular-season fields', () => {
    const item = buildGameItem('2024', '3', '1', input);
    expect(item.include_in_rank).toBeUndefined();
    expect(item.include_in_file).toBeUndefined();
    expect(item.description).toBeUndefined();
    expect(item.special_tag).toBeUndefined();
  });
});

// ── insertWeek ────────────────────────────────────────────────────────────────

describe('insertWeek', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  const meta = buildMetaItem('2024', '2', '1', {
    is_published: false,
    submission_opens_at: null,
    submission_closes_at: null,
  });
  const game = buildGameItem('2024', '2', '1', {
    game_id: '401547417',
    include_in_rank: true,
    include_in_file: true,
  });

  it('writes META with ConditionExpression then games without', async () => {
    await insertWeek(TABLE, meta, [game]);

    expect(mockSend).toHaveBeenCalledTimes(2);

    const metaCmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(metaCmd.input.TableName).toBe(TABLE);
    expect((metaCmd.input.Item as Record<string, unknown>).sk).toBe('META');
    expect(metaCmd.input.ConditionExpression).toBe('attribute_not_exists(pk) AND attribute_not_exists(sk)');

    const gameCmd = mockSend.mock.calls[1][0] as { input: Record<string, unknown> };
    expect(gameCmd.input.TableName).toBe(TABLE);
    expect((gameCmd.input.Item as Record<string, unknown>).game_id).toBe('401547417');
    expect(gameCmd.input.ConditionExpression).toBeUndefined();
  });

  it('writes multiple games in order', async () => {
    const game2 = buildGameItem('2024', '2', '1', {
      game_id: '401547418',
      include_in_rank: true,
      include_in_file: true,
    });
    await insertWeek(TABLE, meta, [game, game2]);

    expect(mockSend).toHaveBeenCalledTimes(3); // META + 2 games
  });

  it('writes no game calls when games array is empty', async () => {
    await insertWeek(TABLE, meta, []);
    expect(mockSend).toHaveBeenCalledTimes(1); // only META
  });

  it('throws WEEK_EXISTS when META conditional check fails', async () => {
    mockSend.mockRejectedValueOnce(new MockConditionalCheckFailedException());

    await expect(insertWeek(TABLE, meta, [])).rejects.toThrow('WEEK_EXISTS');
  });

  it('rethrows non-conditional errors unchanged', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB boom'));

    await expect(insertWeek(TABLE, meta, [])).rejects.toThrow('DynamoDB boom');
  });
});

// ── updateWeek ────────────────────────────────────────────────────────────────

describe('updateWeek', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  const meta = buildMetaItem('2024', '2', '1', {
    is_published: true,
    submission_opens_at: null,
    submission_closes_at: null,
  });
  const newGame = buildGameItem('2024', '2', '1', {
    game_id: 'new-game',
    include_in_rank: true,
    include_in_file: true,
  });

  it('puts META without a ConditionExpression (unconditional replace)', async () => {
    // QUERY for existing games returns empty
    mockSend
      .mockResolvedValueOnce({}) // PUT META
      .mockResolvedValueOnce({ Items: [] }); // QUERY existing games

    await updateWeek(TABLE, meta, []);

    const metaCmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(metaCmd.input.ConditionExpression).toBeUndefined();
    expect((metaCmd.input.Item as Record<string, unknown>).sk).toBe('META');
  });

  it('upserts new games after the query', async () => {
    mockSend
      .mockResolvedValueOnce({}) // PUT META
      .mockResolvedValueOnce({ Items: [] }); // QUERY (no existing games)

    await updateWeek(TABLE, meta, [newGame]);

    // PUT META + QUERY + PUT new game
    expect(mockSend).toHaveBeenCalledTimes(3);
    const gameCmd = mockSend.mock.calls[2][0] as { input: Record<string, unknown> };
    expect((gameCmd.input.Item as Record<string, unknown>).game_id).toBe('new-game');
  });

  it('deletes games removed from the set', async () => {
    const removedGame = { pk: meta.pk, sk: 'GAME#old-game', game_id: 'old-game' };

    mockSend
      .mockResolvedValueOnce({}) // PUT META
      .mockResolvedValueOnce({ Items: [removedGame] }) // QUERY returns old game
      .mockResolvedValueOnce({}) // DELETE old game
      .mockResolvedValueOnce({}); // PUT new game

    await updateWeek(TABLE, meta, [newGame]);

    expect(mockSend).toHaveBeenCalledTimes(4);

    const deleteCmd = mockSend.mock.calls[2][0] as { input: Record<string, unknown> };
    expect((deleteCmd.input.Key as Record<string, string>).sk).toBe('GAME#old-game');

    const putGameCmd = mockSend.mock.calls[3][0] as { input: Record<string, unknown> };
    expect((putGameCmd.input.Item as Record<string, unknown>).game_id).toBe('new-game');
  });

  it('keeps games present in both old and new sets', async () => {
    const keepGame = buildGameItem('2024', '2', '1', {
      game_id: 'keep-me',
      include_in_rank: true,
      include_in_file: true,
    });
    const existingKeep = { pk: meta.pk, sk: 'GAME#keep-me', game_id: 'keep-me' };

    mockSend
      .mockResolvedValueOnce({}) // PUT META
      .mockResolvedValueOnce({ Items: [existingKeep] }); // QUERY

    await updateWeek(TABLE, meta, [keepGame]);

    // PUT META + QUERY + PUT keepGame — no DELETE
    expect(mockSend).toHaveBeenCalledTimes(3);
    const calls = mockSend.mock.calls.map((c) => (c[0] as { input: Record<string, unknown> }).input);
    const hasDelete = calls.some((inp) => 'Key' in inp && !('Item' in inp));
    expect(hasDelete).toBe(false);
  });
});

// ── getWeekMeta ───────────────────────────────────────────────────────────────

describe('getWeekMeta', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns the item when found', async () => {
    const fakeItem = { pk: 'SEASON#2024#TYPE#2#WEEK#1', sk: 'META', kind: 'regular' };
    mockSend.mockResolvedValueOnce({ Item: fakeItem });

    const result = await getWeekMeta(TABLE, '2024', '2', '1');
    expect(result).toEqual(fakeItem);
  });

  it('returns null when item is not found', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await getWeekMeta(TABLE, '2024', '2', '99');
    expect(result).toBeNull();
  });

  it('queries with the correct pk and sk', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    await getWeekMeta(TABLE, '2025', '3', '2');

    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const key = cmd.input.Key as Record<string, string>;
    expect(key.pk).toBe('SEASON#2025#TYPE#3#WEEK#2');
    expect(key.sk).toBe('META');
  });
});

// ── getWeekGames ──────────────────────────────────────────────────────────────

describe('getWeekGames', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('returns all game items for the week', async () => {
    const games = [
      { sk: 'GAME#401547417', game_id: '401547417' },
      { sk: 'GAME#401547418', game_id: '401547418' },
    ];
    mockSend.mockResolvedValueOnce({ Items: games });

    const result = await getWeekGames(TABLE, '2024', '2', '1');
    expect(result).toEqual(games);
  });

  it('returns an empty array when there are no games', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const result = await getWeekGames(TABLE, '2024', '2', '1');
    expect(result).toEqual([]);
  });

  it('queries using begins_with on the GAME# prefix', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await getWeekGames(TABLE, '2024', '2', '1');

    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(cmd.input.KeyConditionExpression).toContain('begins_with');
    const values = cmd.input.ExpressionAttributeValues as Record<string, string>;
    expect(Object.values(values)).toContain('GAME#');
  });
});

// ── upsertScheduleFromEspn ────────────────────────────────────────────────────

describe('upsertScheduleFromEspn', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('conditionally creates META and each game', async () => {
    await upsertScheduleFromEspn(TABLE, '2024', '2', '1', 'Week 1', ['401547417', '401547418']);

    // 1 META + 2 games = 3 calls
    expect(mockSend).toHaveBeenCalledTimes(3);

    const metaCmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect((metaCmd.input.Item as Record<string, unknown>).sk).toBe('META');
    expect(metaCmd.input.ConditionExpression).toContain('attribute_not_exists(pk)');
    expect((metaCmd.input.Item as Record<string, unknown>).is_published).toBe(false);
  });

  it('sets kind = regular for regular season', async () => {
    await upsertScheduleFromEspn(TABLE, '2024', '2', '1', 'Week 1', []);

    const metaCmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect((metaCmd.input.Item as Record<string, unknown>).kind).toBe('regular');
  });

  it('sets kind = playoff and round_name for season type 3', async () => {
    await upsertScheduleFromEspn(TABLE, '2024', '3', '1', 'Wild Card', []);

    const metaCmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const item = metaCmd.input.Item as Record<string, unknown>;
    expect(item.kind).toBe('playoff');
    expect(item.round_name).toBe('Wild Card');
    expect(item.allow_straight_bets).toBe(true);
    expect(item.allow_parlay).toBe(false);
  });

  it('silently skips META creation when week already exists', async () => {
    mockSend.mockRejectedValueOnce(new MockConditionalCheckFailedException());

    await expect(upsertScheduleFromEspn(TABLE, '2024', '2', '1', 'Week 1', [])).resolves.toBeUndefined();
  });

  it('rethrows non-conditional errors from META creation', async () => {
    mockSend.mockRejectedValueOnce(new Error('network failure'));

    await expect(upsertScheduleFromEspn(TABLE, '2024', '2', '1', 'Week 1', [])).rejects.toThrow('network failure');
  });

  it('silently skips a game that already exists', async () => {
    mockSend
      .mockResolvedValueOnce({}) // META put
      .mockRejectedValueOnce(new MockConditionalCheckFailedException()); // game already exists

    await expect(upsertScheduleFromEspn(TABLE, '2024', '2', '1', 'Week 1', ['401547417'])).resolves.toBeUndefined();
  });
});
