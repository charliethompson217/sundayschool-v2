import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAdmin } from '../../utils/auth/cognito-auth';
import { getAllUsersWeekPicks } from '../../db/picks/picks';
import { json, parsePathParams } from '../../utils/http';

// GET /admin/submissions/{year}/{seasonType}/{week}
//
// Returns every user's picks for the requested week, keyed by userId.
export const handler = withAdmin(async (event: APIGatewayProxyEventV2) => {
  const pathResult = parsePathParams(event, 'year', 'seasonType', 'week');
  if (!pathResult.ok) return pathResult.response;
  const { year, seasonType, week } = pathResult.params;

  const tableName = Resource.PicksTable.name;
  const records = await getAllUsersWeekPicks(tableName, year, seasonType, week);

  const byUserId = Object.fromEntries(records.map((r) => [r.userId, r]));

  return json(200, { submissions: byUserId });
});
