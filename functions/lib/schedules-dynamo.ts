import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

import { buildWeekPk, getDocClient } from './dynamo';
import type {
  GameInput,
  MetaInput,
  PlayoffGameInput,
  PlayoffMetaInput,
  RegularGameInput,
  ScheduleGameRecord,
  WeekMetaRecord,
} from '@/types/schedules';

export type { WeekMetaRecord, ScheduleGameRecord };

// ── Key builders ──────────────────────────────────────────────────────────────

export { buildWeekPk };

export function buildScheduleGameSk(gameId: string): string {
  return `GAME#${gameId}`;
}

// GSI1: used for querying all weeks in a given season (year + seasonType)
export function buildScheduleGsi1pk(year: string, seasonType: string): string {
  return `SEASON#${year}#TYPE#${seasonType}`;
}

export function buildScheduleGsi1sk(week: string): string {
  return `WEEK#${week}#META`;
}

// ── Item constructors ─────────────────────────────────────────────────────────

function isRegularSeasonType(seasonType: string): boolean {
  return seasonType !== '3';
}

export function buildMetaItem(year: string, seasonType: string, week: string, input: MetaInput): WeekMetaRecord {
  const pk = buildWeekPk(year, seasonType, week);
  const kind = seasonType === '3' ? 'playoff' : 'regular';
  const base: WeekMetaRecord = {
    pk,
    sk: 'META',
    gsi1pk: buildScheduleGsi1pk(year, seasonType),
    gsi1sk: buildScheduleGsi1sk(week),
    year,
    season_type: seasonType,
    week,
    kind,
    is_published: input.is_published,
    submission_opens_at: input.submission_opens_at ?? null,
    submission_closes_at: input.submission_closes_at ?? null,
    notes: input.notes ?? null,
  };

  if (kind === 'playoff') {
    const playoff = input as PlayoffMetaInput;
    base.round_name = playoff.round_name;
    base.allow_straight_bets = playoff.allow_straight_bets;
    base.allow_parlay = playoff.allow_parlay;
    base.parlay_leg_count = playoff.parlay_leg_count;
  }

  return base;
}

export function buildGameItem(year: string, seasonType: string, week: string, input: GameInput): ScheduleGameRecord {
  const pk = buildWeekPk(year, seasonType, week);
  const base: ScheduleGameRecord = {
    pk,
    sk: buildScheduleGameSk(input.game_id),
    year,
    season_type: seasonType,
    week,
    game_id: input.game_id,
  };

  if (isRegularSeasonType(seasonType)) {
    const reg = input as RegularGameInput;
    base.include_in_rank = reg.include_in_rank;
    base.include_in_file = reg.include_in_file;
    base.description = reg.description ?? null;
    base.special_tag = reg.special_tag ?? null;
  } else {
    const playoff = input as PlayoffGameInput;
    base.is_wagerable = playoff.is_wagerable;
  }

  return base;
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getWeekMeta(
  tableName: string,
  year: string,
  seasonType: string,
  week: string,
): Promise<WeekMetaRecord | null> {
  const result = await getDocClient().send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: buildWeekPk(year, seasonType, week), sk: 'META' },
    }),
  );
  return (result.Item as WeekMetaRecord) ?? null;
}

export async function getWeekGames(
  tableName: string,
  year: string,
  seasonType: string,
  week: string,
): Promise<ScheduleGameRecord[]> {
  const pk = buildWeekPk(year, seasonType, week);
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
      ExpressionAttributeValues: { ':pk': pk, ':prefix': 'GAME#' },
    }),
  );
  return (result.Items as ScheduleGameRecord[]) ?? [];
}

// Query all week META items for a season via GSI1 (efficient, index-backed).
export async function listSeasonWeekMetas(
  tableName: string,
  year: string,
  seasonType: string,
): Promise<WeekMetaRecord[]> {
  const gsi1pk = buildScheduleGsi1pk(year, seasonType);
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': gsi1pk },
    }),
  );
  return (result.Items as WeekMetaRecord[]) ?? [];
}

// Scan all META items (admin use; small total dataset for an NFL season pool).
export async function listAllWeekMetas(tableName: string): Promise<WeekMetaRecord[]> {
  const items: WeekMetaRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'sk = :meta',
        ExpressionAttributeValues: { ':meta': 'META' },
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...((result.Items as WeekMetaRecord[]) ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

// ── Write operations ──────────────────────────────────────────────────────────

// Create a new week — fails with WEEK_EXISTS if the META item already exists.
export async function insertWeek(
  tableName: string,
  metaItem: WeekMetaRecord,
  gameItems: ScheduleGameRecord[],
): Promise<void> {
  try {
    await getDocClient().send(
      new PutCommand({
        TableName: tableName,
        Item: metaItem,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new Error('WEEK_EXISTS');
    }
    throw err;
  }

  for (const game of gameItems) {
    await getDocClient().send(new PutCommand({ TableName: tableName, Item: game }));
  }
}

// Auto-populate schedule entries from an ESPN schedule_upsert event.
//
// Both the META and individual GAME items use conditional puts so existing
// admin configuration (submission windows, is_published, custom flags, etc.)
// is never overwritten. This is purely additive — it only fills in gaps.
export async function upsertScheduleFromEspn(
  tableName: string,
  year: string,
  seasonType: string,
  week: string,
  weekText: string,
  gameIds: string[],
): Promise<void> {
  const pk = buildWeekPk(year, seasonType, week);
  const kind = seasonType === '3' ? ('playoff' as const) : ('regular' as const);

  const metaBase: WeekMetaRecord = {
    pk,
    sk: 'META',
    gsi1pk: buildScheduleGsi1pk(year, seasonType),
    gsi1sk: buildScheduleGsi1sk(week),
    year,
    season_type: seasonType,
    week,
    kind,
    is_published: false,
    submission_opens_at: null,
    submission_closes_at: null,
  };

  if (kind === 'playoff') {
    metaBase.round_name = weekText;
    metaBase.allow_straight_bets = true;
    metaBase.allow_parlay = false;
    metaBase.parlay_leg_count = 2;
  }

  try {
    await getDocClient().send(
      new PutCommand({
        TableName: tableName,
        Item: metaBase,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      }),
    );
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
    // META already exists — admin config preserved as-is
  }

  for (const gameId of gameIds) {
    const gameBase: ScheduleGameRecord = {
      pk,
      sk: buildScheduleGameSk(gameId),
      year,
      season_type: seasonType,
      week,
      game_id: gameId,
    };

    if (kind === 'regular') {
      gameBase.include_in_rank = true;
      gameBase.include_in_file = true;
      gameBase.description = null;
      gameBase.special_tag = null;
    } else {
      gameBase.is_wagerable = false;
    }

    try {
      await getDocClient().send(
        new PutCommand({
          TableName: tableName,
          Item: gameBase,
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        }),
      );
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
      // Game already configured — leave it as-is
    }
  }
}

// Replace META and full game set for a week.
// Games not present in newGameItems are deleted; new/updated games are upserted.
export async function updateWeek(
  tableName: string,
  metaItem: WeekMetaRecord,
  newGameItems: ScheduleGameRecord[],
): Promise<void> {
  await getDocClient().send(new PutCommand({ TableName: tableName, Item: metaItem }));

  const existingGames = await getWeekGames(tableName, metaItem.year, metaItem.season_type, metaItem.week);

  const newSkSet = new Set(newGameItems.map((g) => g.sk));
  const toDelete = existingGames.filter((g) => !newSkSet.has(g.sk));

  for (const game of toDelete) {
    await getDocClient().send(new DeleteCommand({ TableName: tableName, Key: { pk: metaItem.pk, sk: game.sk } }));
  }

  for (const game of newGameItems) {
    await getDocClient().send(new PutCommand({ TableName: tableName, Item: game }));
  }
}
