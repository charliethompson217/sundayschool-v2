import { createHmac } from 'node:crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

const { TEST_SECRET, TEST_TABLE, TEST_SCHEDULES_TABLE, mockSend } = vi.hoisted(() => ({
  TEST_SECRET: 'integration-test-secret',
  TEST_TABLE: 'test-espn-games',
  TEST_SCHEDULES_TABLE: 'test-schedules',
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('sst', () => ({
  Resource: {
    EspnGames: { name: TEST_TABLE },
    EspnWebhookSecret: { value: TEST_SECRET },
    SchedulesTable: { name: TEST_SCHEDULES_TABLE },
  },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {},
  ConditionalCheckFailedException: class extends Error {},
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
    DynamoDBDocumentClient: {
      from: vi.fn().mockReturnValue({ send: mockSend }),
    },
    UpdateCommand: makeCmd(),
    PutCommand: makeCmd(),
    GetCommand: makeCmd(),
    QueryCommand: makeCmd(),
    ScanCommand: makeCmd(),
    DeleteCommand: makeCmd(),
  };
});

// Import handler after mocks are in place
import { handler } from '../espn-ingest';

// ── Test helpers ─────────────────────────────────────────────────────────────

const validScheduleGame = {
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

const validFinalGame = {
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

function createSignedEvent(body: object): APIGatewayProxyEventV2 {
  const bodyStr = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', TEST_SECRET).update(`${timestamp}.${bodyStr}`).digest('hex');

  return {
    body: bodyStr,
    isBase64Encoded: false,
    headers: {
      'x-ss-timestamp': timestamp,
      'x-ss-signature': signature,
      'content-type': 'application/json',
    },
    requestContext: {
      http: { method: 'POST', path: '/internal/espn-ingest' },
    },
  } as unknown as APIGatewayProxyEventV2;
}

function createUnsignedEvent(body: object): APIGatewayProxyEventV2 {
  return {
    body: JSON.stringify(body),
    isBase64Encoded: false,
    headers: { 'content-type': 'application/json' },
    requestContext: {
      http: { method: 'POST', path: '/internal/espn-ingest' },
    },
  } as unknown as APIGatewayProxyEventV2;
}

// Handler always returns structured JSON, never a plain string
async function invoke(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  return (await handler(event)) as APIGatewayProxyStructuredResultV2;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('espn-ingest handler', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it('returns 401 when auth headers are missing', async () => {
    const event = createUnsignedEvent({ type: 'schedule_upsert', sent_at: 'now', games: [] });
    const res = await invoke(event);
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when signature is invalid', async () => {
    const bodyStr = JSON.stringify({ type: 'schedule_upsert', sent_at: 'now', games: [] });
    const event = {
      body: bodyStr,
      isBase64Encoded: false,
      headers: {
        'x-ss-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-ss-signature': 'bad'.repeat(16) + 'abcd',
        'content-type': 'application/json',
      },
      requestContext: { http: { method: 'POST', path: '/internal/espn-ingest' } },
    } as unknown as APIGatewayProxyEventV2;

    const res = await invoke(event);
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 on invalid JSON body', async () => {
    const rawBody = 'not json {{{';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', TEST_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');

    const event = {
      body: rawBody,
      isBase64Encoded: false,
      headers: {
        'x-ss-timestamp': timestamp,
        'x-ss-signature': signature,
        'content-type': 'application/json',
      },
      requestContext: { http: { method: 'POST', path: '/internal/espn-ingest' } },
    } as unknown as APIGatewayProxyEventV2;

    const res = await invoke(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body as string).error).toBe('Invalid JSON');
  });

  it('returns 400 on Zod validation failure', async () => {
    const body = { type: 'schedule_upsert', sent_at: 'now', games: [] };
    const event = createSignedEvent(body);
    const res = await invoke(event);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body as string).error).toBe('Validation failed');
  });

  it('processes a valid schedule_upsert and writes to DynamoDB', async () => {
    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-09-05T20:00:00Z',
      games: [validScheduleGame],
    };
    const event = createSignedEvent(body);
    const res = await invoke(event);

    expect(res.statusCode).toBe(200);
    const resBody = JSON.parse(res.body as string);
    expect(resBody.status).toBe('ok');
    expect(resBody.gamesProcessed).toBe(1);

    // 1 ESPN UpdateCommand + 2 SchedulesTable PutCommands (META + game auto-fill)
    expect(mockSend).toHaveBeenCalledTimes(3);
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const params = cmd.input as Record<string, unknown>;
    expect(params.TableName).toBe(TEST_TABLE);
    const key = params.Key as Record<string, string>;
    expect(key.pk).toBe('SEASON#2024#TYPE#2#WEEK#1');
    expect(key.sk).toBe('GAME#2024-09-06T00:20Z#401547417');
  });

  it('auto-fills SchedulesTable after schedule_upsert', async () => {
    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-09-05T20:00:00Z',
      games: [validScheduleGame],
    };
    const event = createSignedEvent(body);
    await invoke(event);

    // Second call: conditional PutCommand for the week META
    const metaCmd = mockSend.mock.calls[1][0] as { input: Record<string, unknown> };
    expect(metaCmd.input.TableName).toBe(TEST_SCHEDULES_TABLE);
    expect((metaCmd.input.Item as Record<string, unknown>).sk).toBe('META');
    expect((metaCmd.input.Item as Record<string, unknown>).is_published).toBe(false);
    expect(metaCmd.input.ConditionExpression).toContain('attribute_not_exists(pk)');

    // Third call: conditional PutCommand for the game
    const gameCmd = mockSend.mock.calls[2][0] as { input: Record<string, unknown> };
    expect(gameCmd.input.TableName).toBe(TEST_SCHEDULES_TABLE);
    expect((gameCmd.input.Item as Record<string, unknown>).game_id).toBe('401547417');
    expect(gameCmd.input.ConditionExpression).toContain('attribute_not_exists(pk)');
  });

  it('does not auto-fill SchedulesTable for game_final events', async () => {
    const body = {
      type: 'game_final',
      sent_at: '2024-09-06T03:30:00Z',
      games: [validFinalGame],
    };
    const event = createSignedEvent(body);
    await invoke(event);

    // Only the single ESPN UpdateCommand — no schedule auto-fill
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('processes a valid game_final and writes to DynamoDB', async () => {
    const body = {
      type: 'game_final',
      sent_at: '2024-09-06T03:30:00Z',
      games: [validFinalGame],
    };
    const event = createSignedEvent(body);
    const res = await invoke(event);

    expect(res.statusCode).toBe(200);
    const resBody = JSON.parse(res.body as string);
    expect(resBody.status).toBe('ok');
    expect(resBody.type).toBe('game_final');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const params = cmd.input as Record<string, unknown>;
    expect(params.TableName).toBe(TEST_TABLE);
    const key = params.Key as Record<string, string>;
    expect(key.pk).toBe('SEASON#2024#TYPE#2#WEEK#1');
  });

  it('returns 500 on DynamoDB write failure', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB boom'));

    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-09-05T20:00:00Z',
      games: [validScheduleGame],
    };
    const event = createSignedEvent(body);
    const res = await invoke(event);

    expect(res.statusCode).toBe(500);
    const resBody = JSON.parse(res.body as string);
    expect(resBody.failedGameIds).toContain('401547417');
  });

  it('sets is_international = false for USA venue', async () => {
    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-09-05T20:00:00Z',
      games: [validScheduleGame],
    };
    const event = createSignedEvent(body);
    await invoke(event);

    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const params = cmd.input;
    const names = params.ExpressionAttributeNames as Record<string, string>;
    const values = params.ExpressionAttributeValues as Record<string, unknown>;
    const nameEntries = Object.entries(names) as [string, string][];
    const isIntlNameRef = nameEntries.find(([, v]) => v === 'is_international')?.[0];
    expect(isIntlNameRef).toBeDefined();
    const valueRef = isIntlNameRef!.replace('#f', ':v');
    expect(values[valueRef]).toBe(false);
  });

  it('sets is_international = true for non-USA venue', async () => {
    const intlGame = { ...validScheduleGame, venue_country: 'United Kingdom' };
    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-10-13T13:00:00Z',
      games: [intlGame],
    };
    const event = createSignedEvent(body);
    await invoke(event);

    const cmd = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    const params = cmd.input;
    const names = params.ExpressionAttributeNames as Record<string, string>;
    const values = params.ExpressionAttributeValues as Record<string, unknown>;
    const nameEntries = Object.entries(names) as [string, string][];
    const isIntlNameRef = nameEntries.find(([, v]) => v === 'is_international')?.[0];
    expect(isIntlNameRef).toBeDefined();
    const valueRef = isIntlNameRef!.replace('#f', ':v');
    expect(values[valueRef]).toBe(true);
  });
});
