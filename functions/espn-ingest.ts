import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { verifyHmacSignature } from './lib/auth';
import { writeGameFinal, writeScheduleUpsert } from './lib/dynamo';
import { EspnIngestBodySchema } from '@/types/espn';
import { upsertScheduleFromEspn } from './lib/schedules-dynamo';

function jsonResponse(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    return await handleIngest(event);
  } catch (err) {
    console.error('Unhandled error in espn-ingest handler', { error: String(err) });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

async function handleIngest(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
    : (event.body ?? '');

  // ── Auth ─────────────────────────────────────────────────────────────────

  const timestamp = event.headers['x-ss-timestamp'] ?? '';
  const signature = event.headers['x-ss-signature'] ?? '';
  const secret = Resource.EspnWebhookSecret.value;

  if (!timestamp || !signature) {
    console.warn('Missing auth headers');
    return jsonResponse(401, { error: 'Missing authentication headers' });
  }

  if (!verifyHmacSignature(rawBody, timestamp, signature, secret)) {
    console.warn('HMAC verification failed', { timestamp });
    return jsonResponse(403, { error: 'Invalid signature' });
  }

  // ── Parse + validate ─────────────────────────────────────────────────────

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    console.warn('Invalid JSON body');
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const result = EspnIngestBodySchema.safeParse(parsed);
  if (!result.success) {
    console.warn('Validation failed', { issues: result.error.issues });
    return jsonResponse(400, {
      error: 'Validation failed',
      issues: result.error.issues.map((i) => ({
        path: i.path,
        message: i.message,
      })),
    });
  }

  const body = result.data;
  const tableName = Resource.EspnGames.name;

  console.info('Ingest request accepted', {
    type: body.type,
    gameCount: body.games.length,
    firstGameId: body.games[0]?.game_id,
    sentAt: body.sent_at,
  });

  // ── Write to DynamoDB ────────────────────────────────────────────────────

  const failedGameIds: string[] = [];

  if (body.type === 'schedule_upsert') {
    for (const game of body.games) {
      try {
        await writeScheduleUpsert(tableName, game, body.sent_at);
      } catch (err) {
        console.error('Schedule upsert failed', {
          gameId: game.game_id,
          error: String(err),
        });
        failedGameIds.push(game.game_id);
      }
    }

    // Auto-populate SchedulesTable (non-destructive — never overwrites existing config).
    // Group by week in case the payload spans multiple weeks.
    const weekMap = new Map<string, typeof body.games>();
    for (const game of body.games) {
      const key = `${game.year}|${game.season_type}|${game.week}`;
      const bucket = weekMap.get(key) ?? [];
      bucket.push(game);
      weekMap.set(key, bucket);
    }

    for (const weekGames of weekMap.values()) {
      const first = weekGames[0];
      try {
        await upsertScheduleFromEspn(
          Resource.SchedulesTable.name,
          first.year,
          first.season_type,
          first.week,
          first.week_text,
          weekGames.map((g) => g.game_id),
        );
      } catch (err) {
        console.error('Schedule auto-fill failed', {
          year: first.year,
          seasonType: first.season_type,
          week: first.week,
          error: String(err),
        });
      }
    }
  } else {
    for (const game of body.games) {
      try {
        await writeGameFinal(tableName, game, body.sent_at);
      } catch (err) {
        console.error('Game final write failed', {
          gameId: game.game_id,
          error: String(err),
        });
        failedGameIds.push(game.game_id);
      }
    }
  }

  if (failedGameIds.length > 0) {
    console.error('Partial write failure', {
      type: body.type,
      failedGameIds,
      successCount: body.games.length - failedGameIds.length,
    });
    return jsonResponse(500, {
      error: 'Partial write failure',
      failedGameIds,
      successCount: body.games.length - failedGameIds.length,
    });
  }

  console.info('Ingest complete', {
    type: body.type,
    gamesWritten: body.games.length,
  });

  return jsonResponse(200, {
    status: 'ok',
    type: body.type,
    gamesProcessed: body.games.length,
  });
}
