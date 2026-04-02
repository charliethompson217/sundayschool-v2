import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { buildGameLookupGsiPk, buildWeekPk, getDocClient } from './dynamo';
import type { EspnGameRecord } from './espn-schemas';

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
    items.push(...((result.Items as EspnGameRecord[]) ?? []));
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
  return (result.Items?.[0] as EspnGameRecord) ?? null;
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
  return (result.Items as EspnGameRecord[]) ?? [];
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
