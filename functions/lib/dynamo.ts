import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'node:crypto';

import type { GameFinalGame, ScheduleUpsertGame } from '@/types/espn';

// ── Client singleton (reused across Lambda invocations) ──────────────────────

let _docClient: DynamoDBDocumentClient | undefined;

export function getDocClient(): DynamoDBDocumentClient {
  if (!_docClient) {
    _docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _docClient;
}

// ── Key builders ─────────────────────────────────────────────────────────────

export function buildWeekPk(year: string, seasonType: string, week: string): string {
  return `SEASON#${year}#TYPE#${seasonType}#WEEK#${week}`;
}

export function buildGameSk(startTime: string, gameId: string): string {
  return `GAME#${startTime}#${gameId}`;
}

export function buildGameLookupGsiPk(gameId: string): string {
  return `GAME#${gameId}`;
}

// ── Content hashing (deterministic, key-sorted) ──────────────────────────────

export function computeContentHash(fields: Record<string, unknown>): string {
  const sorted = Object.keys(fields)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = fields[key];
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── is_international derivation ──────────────────────────────────────────────

export function deriveIsInternational(venueCountry: string | null): boolean {
  return venueCountry != null && venueCountry !== 'USA';
}

// ── DynamoDB UpdateExpression builder ────────────────────────────────────────

function buildUpdateExpression(fields: Record<string, unknown>) {
  const setParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  let i = 0;
  for (const [key, val] of Object.entries(fields)) {
    const nameRef = `#f${i}`;
    const valueRef = `:v${i}`;
    setParts.push(`${nameRef} = ${valueRef}`);
    names[nameRef] = key;
    values[valueRef] = val ?? null;
    i++;
  }

  return {
    UpdateExpression: `SET ${setParts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

// ── Write: schedule_upsert ───────────────────────────────────────────────────

export async function writeScheduleUpsert(tableName: string, game: ScheduleUpsertGame, sentAt: string): Promise<void> {
  const pk = buildWeekPk(game.year, game.season_type, game.week);
  const sk = buildGameSk(game.start_time, game.game_id);
  const gsi1pk = buildGameLookupGsiPk(game.game_id);

  const scheduleFields: Record<string, unknown> = {
    game_id: game.game_id,
    competition_id: game.competition_id,
    year: game.year,
    season_type: game.season_type,
    week: game.week,
    week_text: game.week_text,
    start_time: game.start_time,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home: game.home,
    away: game.away,
    competition_type: game.competition_type,
    competition_type_slug: game.competition_type_slug,
    neutral_site: game.neutral_site,
    venue_id: game.venue_id,
    venue_full_name: game.venue_full_name,
    venue_city: game.venue_city,
    venue_state: game.venue_state,
    venue_country: game.venue_country,
  };

  const allFields = {
    ...scheduleFields,
    gsi1pk,
    gsi1sk: gsi1pk,
    entity_type: 'espn_game',
    is_international: deriveIsInternational(game.venue_country),
    espn_updated_at: sentAt,
    ingested_at: new Date().toISOString(),
    source_event_type: 'schedule_upsert',
    schedule_hash: computeContentHash(scheduleFields),
  };

  const params = buildUpdateExpression(allFields);

  await getDocClient().send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk, sk },
      ...params,
    }),
  );
}

// ── Write: game_final ────────────────────────────────────────────────────────

export async function writeGameFinal(tableName: string, game: GameFinalGame, sentAt: string): Promise<void> {
  const pk = buildWeekPk(game.year, game.season_type, game.week);
  const sk = buildGameSk(game.start_time, game.game_id);
  const gsi1pk = buildGameLookupGsiPk(game.game_id);

  const resultFields: Record<string, unknown> = {
    home_score: game.home_score,
    away_score: game.away_score,
    status: game.status,
    completed: game.completed,
    winner: game.winner,
  };

  const allFields = {
    ...resultFields,
    game_id: game.game_id,
    competition_id: game.competition_id,
    year: game.year,
    season_type: game.season_type,
    week: game.week,
    week_text: game.week_text,
    start_time: game.start_time,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home: game.home,
    away: game.away,
    gsi1pk,
    gsi1sk: gsi1pk,
    entity_type: 'espn_game',
    espn_updated_at: sentAt,
    ingested_at: new Date().toISOString(),
    source_event_type: 'game_final',
    final_hash: computeContentHash(resultFields),
  };

  const params = buildUpdateExpression(allFields);

  await getDocClient().send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk, sk },
      ...params,
    }),
  );
}
