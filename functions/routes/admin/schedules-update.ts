import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAdmin } from '../../utils/auth/cognito-auth';
import { buildMetaItem, buildGameItem, getWeekMeta, updateWeek } from '../../db/schedules/schedules';
import { json, parsePathParams, parseJsonBody, validateBody } from '../../utils/http';
import { RegularWeekBodySchema, PlayoffWeekBodySchema } from '@/types/schedules';

// PUT /admin/schedules/{year}/{seasonType}/{week}
//
// Fully replaces a week's META and game set. Returns 404 if the week does not
// exist (use POST to create). Games not present in the new payload are deleted.
export const handler = withAdmin(async (event: APIGatewayProxyEventV2) => {
  const pathResult = parsePathParams(event, 'year', 'seasonType', 'week');
  if (!pathResult.ok) return pathResult.response;
  const { year, seasonType, week } = pathResult.params;

  const bodyResult = parseJsonBody(event);
  if (!bodyResult.ok) return bodyResult.response;

  const bodySchema = seasonType === '3' ? PlayoffWeekBodySchema : RegularWeekBodySchema;
  const validated = validateBody(bodySchema, bodyResult.data);
  if (!validated.ok) return validated.response;

  const tableName = Resource.SchedulesTable.name;

  const existing = await getWeekMeta(tableName, year, seasonType, week);
  if (!existing) {
    return json(404, { error: 'Week not found. Use POST to create.' });
  }

  const { meta: metaInput, games: gamesInput } = validated.data;

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
