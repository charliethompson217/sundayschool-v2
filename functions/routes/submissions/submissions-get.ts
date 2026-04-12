import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { getUserWeekPicks } from '../../db/picks/picks';
import type { User } from '@/types/users';
import { json, parsePathParams } from '../../utils/http';

// GET /submissions/{year}/{seasonType}/{week}
//
// Returns the authenticated user's picks for the requested week,
// or null if they have not yet submitted.
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: User) => {
  const pathResult = parsePathParams(event, 'year', 'seasonType', 'week');
  if (!pathResult.ok) return pathResult.response;
  const { year, seasonType, week } = pathResult.params;

  const tableName = Resource.PicksTable.name;
  const record = await getUserWeekPicks(tableName, user.id, year, seasonType, week);

  return json(200, { picks: record ?? null });
});
