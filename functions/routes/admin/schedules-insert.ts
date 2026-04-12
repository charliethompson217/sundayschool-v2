import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAdmin } from '../../utils/auth/cognito-auth';
import { buildMetaItem, buildGameItem, insertWeek } from '../../db/schedules/schedules';
import { json, parsePathParams, parseJsonBody, validateBody } from '../../utils/http';
import { RegularWeekBodySchema, PlayoffWeekBodySchema } from '@/types/schedules';

// POST /admin/schedules/{year}/{seasonType}/{week}
//
// Creates a new week schedule. Returns 409 if the week already exists.
export const handler = withAdmin(async (event: APIGatewayProxyEventV2) => {
  const pathResult = parsePathParams(event, 'year', 'seasonType', 'week');
  if (!pathResult.ok) return pathResult.response;
  const { year, seasonType, week } = pathResult.params;

  const bodyResult = parseJsonBody(event);
  if (!bodyResult.ok) return bodyResult.response;

  const bodySchema = seasonType === '3' ? PlayoffWeekBodySchema : RegularWeekBodySchema;
  const validated = validateBody(bodySchema, bodyResult.data);
  if (!validated.ok) return validated.response;

  const { meta: metaInput, games: gamesInput } = validated.data;
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
