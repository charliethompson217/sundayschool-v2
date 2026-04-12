import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { buildWeekPk, getDocClient } from '../client';
import type { RegularSeasonPicksSubmission, PlayOffsPicksSubmission } from '@/types/submissions';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PickKind = 'regular' | 'playoff';

interface PicksRecordBase {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  userId: string;
  year: string;
  season_type: string;
  week: string;
  submitted_at: string;
}

export interface RegularSeasonPicksRecord extends PicksRecordBase {
  kind: 'regular';
  picks: RegularSeasonPicksSubmission;
}

export interface PlayoffPicksRecord extends PicksRecordBase {
  kind: 'playoff';
  picks: PlayOffsPicksSubmission;
}

export type PicksRecord = RegularSeasonPicksRecord | PlayoffPicksRecord;

// ── Key builders ──────────────────────────────────────────────────────────────

export { buildWeekPk };

// PK: USER#<userId>  (all weeks for a user in one partition)
export function buildPicksPk(userId: string): string {
  return `USER#${userId}`;
}

// SK: SEASON#<year>#TYPE#<seasonType>#WEEK#<week>  (one item per user per week)
export function buildPicksSk(year: string, seasonType: string, week: string): string {
  return buildWeekPk(year, seasonType, week);
}

// GSI1 PK: SEASON#<year>#TYPE#<seasonType>#WEEK#<week>  (fan-out to all users for a week)
export function buildPicksGsi1pk(year: string, seasonType: string, week: string): string {
  return buildWeekPk(year, seasonType, week);
}

// GSI1 SK: USER#<userId>
export function buildPicksGsi1sk(userId: string): string {
  return `USER#${userId}`;
}

// ── Item constructors ─────────────────────────────────────────────────────────

export function buildRegularSeasonPicksItem(
  userId: string,
  year: string,
  seasonType: string,
  week: string,
  picks: RegularSeasonPicksSubmission,
): RegularSeasonPicksRecord {
  return {
    pk: buildPicksPk(userId),
    sk: buildPicksSk(year, seasonType, week),
    gsi1pk: buildPicksGsi1pk(year, seasonType, week),
    gsi1sk: buildPicksGsi1sk(userId),
    userId,
    year,
    season_type: seasonType,
    week,
    kind: 'regular',
    picks,
    submitted_at: new Date().toISOString(),
  };
}

export function buildPlayoffPicksItem(
  userId: string,
  year: string,
  seasonType: string,
  week: string,
  picks: PlayOffsPicksSubmission,
): PlayoffPicksRecord {
  return {
    pk: buildPicksPk(userId),
    sk: buildPicksSk(year, seasonType, week),
    gsi1pk: buildPicksGsi1pk(year, seasonType, week),
    gsi1sk: buildPicksGsi1sk(userId),
    userId,
    year,
    season_type: seasonType,
    week,
    kind: 'playoff',
    picks,
    submitted_at: new Date().toISOString(),
  };
}

// ── Read operations ───────────────────────────────────────────────────────────

/** Get a single user's picks for one week. */
export async function getUserWeekPicks(
  tableName: string,
  userId: string,
  year: string,
  seasonType: string,
  week: string,
): Promise<PicksRecord | null> {
  const result = await getDocClient().send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: buildPicksPk(userId),
        sk: buildPicksSk(year, seasonType, week),
      },
    }),
  );
  return (result.Item as PicksRecord) ?? null;
}

/** Get all of a user's picks for a given year across all weeks and season types. */
export async function getUserYearPicks(tableName: string, userId: string, year: string): Promise<PicksRecord[]> {
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
      ExpressionAttributeValues: {
        ':pk': buildPicksPk(userId),
        ':prefix': `SEASON#${year}`,
      },
    }),
  );
  return (result.Items as PicksRecord[]) ?? [];
}

/** Get all of a user's picks for a specific season (year + seasonType) in one query. */
export async function getUserSeasonPicks(
  tableName: string,
  userId: string,
  year: string,
  seasonType: string,
): Promise<PicksRecord[]> {
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: { '#pk': 'pk', '#sk': 'sk' },
      ExpressionAttributeValues: {
        ':pk': buildPicksPk(userId),
        ':prefix': `SEASON#${year}#TYPE#${seasonType}`,
      },
    }),
  );
  return (result.Items as PicksRecord[]) ?? [];
}

/** Get all users' picks for a specific week via GSI1. */
export async function getAllUsersWeekPicks(
  tableName: string,
  year: string,
  seasonType: string,
  week: string,
): Promise<PicksRecord[]> {
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': buildPicksGsi1pk(year, seasonType, week),
      },
    }),
  );
  return (result.Items as PicksRecord[]) ?? [];
}

// ── Write operations ──────────────────────────────────────────────────────────

/** Upsert a picks record (overwrites any prior submission for that user+week). */
export async function putPicks(tableName: string, item: PicksRecord): Promise<void> {
  await getDocClient().send(new PutCommand({ TableName: tableName, Item: item }));
}
