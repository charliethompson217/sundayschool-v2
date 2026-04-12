import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { buildWeekPk, getDocClient } from '../client';
import { buildGameLookupGsiPk } from './writes';
import { EspnGameRecordSchema, type EspnGameRecord } from '@/types/espn';

export type { EspnGameRecord };

// ── Helpers ───────────────────────────────────────────────────────────────────

async function paginatedScan(
  tableName: string,
  filterExpression: string,
  names: Record<string, string>,
  values: Record<string, unknown>,
): Promise<EspnGameRecord[]> {
  const items: EspnGameRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...(result.Items ?? []).map((item) => EspnGameRecordSchema.parse(item)));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getGameById(tableName: string, gameId: string): Promise<EspnGameRecord | null> {
  const gsi1pk = buildGameLookupGsiPk(gameId);
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'gsi1pk' },
      ExpressionAttributeValues: { ':pk': gsi1pk },
      Limit: 1,
    }),
  );
  const item = result.Items?.[0];
  return item ? EspnGameRecordSchema.parse(item) : null;
}

export async function getGamesByWeek(
  tableName: string,
  year: string,
  seasonType: string,
  week: string,
): Promise<EspnGameRecord[]> {
  const pk = buildWeekPk(year, seasonType, week);
  const result = await getDocClient().send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': 'pk' },
      ExpressionAttributeValues: { ':pk': pk },
    }),
  );
  return (result.Items ?? []).map((item) => EspnGameRecordSchema.parse(item));
}

export async function getGamesBySeason(tableName: string, year: string, seasonType: string): Promise<EspnGameRecord[]> {
  return paginatedScan(
    tableName,
    '#yr = :year AND #st = :seasonType',
    { '#yr': 'year', '#st': 'season_type' },
    { ':year': year, ':seasonType': seasonType },
  );
}

export async function getGamesByYear(tableName: string, year: string): Promise<EspnGameRecord[]> {
  return paginatedScan(tableName, '#yr = :year', { '#yr': 'year' }, { ':year': year });
}
