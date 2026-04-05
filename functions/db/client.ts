import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

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

// ── Shared key builders ───────────────────────────────────────────────────────
//
// buildWeekPk is the primary key format used across both the EspnGames table
// and the SchedulesTable — both partition their data by season/type/week.

export function buildWeekPk(year: string, seasonType: string, week: string): string {
  return `SEASON#${year}#TYPE#${seasonType}#WEEK#${week}`;
}
