import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from './lib/cognito-auth';
import { buildMetaItem, buildGameItem, getWeekMeta, updateWeek } from './lib/schedules-dynamo';
import { RegularWeekBodySchema, PlayoffWeekBodySchema } from '@/types/schedules';
import type { UserRecord } from './lib/users-dynamo';

function json(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// PUT /admin/schedules/{year}/{seasonType}/{week}
//
// Fully replaces a week's META and game set. Returns 404 if the week does not
// exist (use POST to create). Games not present in the new payload are deleted.
// Admin only. Body shape depends on seasonType:
//   seasonType 2 (regular): { meta: RegularMetaInput, games: RegularGameInput[] }
//   seasonType 3 (playoff):  { meta: PlayoffMetaInput, games: PlayoffGameInput[] }
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: UserRecord) => {
  if (!user.isAdmin) {
    return json(403, { error: 'Forbidden' });
  }

  const { year, seasonType, week } = event.pathParameters ?? {};
  if (!year || !seasonType || !week) {
    return json(400, { error: 'Missing path parameters' });
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const bodySchema = seasonType === '3' ? PlayoffWeekBodySchema : RegularWeekBodySchema;
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed', issues: parsed.error.issues });
  }

  const tableName = Resource.SchedulesTable.name;

  const existing = await getWeekMeta(tableName, year, seasonType, week);
  if (!existing) {
    return json(404, { error: 'Week not found. Use POST to create.' });
  }

  const { meta: metaInput, games: gamesInput } = parsed.data;

  const metaItem = buildMetaItem(year, seasonType, week, metaInput);
  const gameItems = gamesInput.map((g) => buildGameItem(year, seasonType, week, g));

  try {
    await updateWeek(tableName, metaItem, gameItems);
  } catch (err) {
    console.error('Failed to update week', err);
    return json(500, { error: 'Internal server error' });
  }

  return json(200, { meta: metaItem, games: gameItems });
});
