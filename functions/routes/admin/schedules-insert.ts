import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { buildMetaItem, buildGameItem, insertWeek } from '../../db/schedules/schedules';
import type { UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';
import { RegularWeekBodySchema, PlayoffWeekBodySchema } from '@/types/schedules';

// POST /admin/schedules/{year}/{seasonType}/{week}
//
// Creates a new week schedule. Returns 409 if the week already exists.
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

  const { meta: metaInput, games: gamesInput } = parsed.data;
  const tableName = Resource.SchedulesTable.name;

  const metaItem = buildMetaItem(year, seasonType, week, metaInput);
  const gameItems = gamesInput.map((g) => buildGameItem(year, seasonType, week, g));

  try {
    await insertWeek(tableName, metaItem, gameItems);
  } catch (err) {
    if (err instanceof Error && err.message === 'WEEK_EXISTS') {
      return json(409, { error: 'Week already exists. Use PUT to update.' });
    }
    console.error('Failed to insert week', err);
    return json(500, { error: 'Internal server error' });
  }

  return json(201, { meta: metaItem, games: gameItems });
});
