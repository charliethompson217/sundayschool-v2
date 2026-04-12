import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { getUserSeasonPicks } from '../../db/picks/picks';
import type { User } from '@/types/users';
import { json, parsePathParams } from '../../utils/http';

// GET /submissions/{year}/{seasonType}
//
// Returns all of the authenticated user's picks for every week in the given
// season in a single DynamoDB query, keyed by week number (integer).
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: User) => {
  const pathResult = parsePathParams(event, 'year', 'seasonType');
  if (!pathResult.ok) return pathResult.response;
  const { year, seasonType } = pathResult.params;

  const tableName = Resource.PicksTable.name;
  const records = await getUserSeasonPicks(tableName, user.id, year, seasonType);

  const byWeek = Object.fromEntries(records.map((r) => [parseInt(r.week, 10), r.picks]));

  return json(200, { submissions: byWeek });
});
