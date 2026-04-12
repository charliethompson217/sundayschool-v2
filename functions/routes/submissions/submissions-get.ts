import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { getUserWeekPicks } from '../../db/picks/picks';
import type { UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';

// GET /submissions/{year}/{seasonType}/{week}
//
// Returns the authenticated user's picks for the requested week,
// or null if they have not yet submitted.
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: UserRecord) => {
  const { year, seasonType, week } = event.pathParameters ?? {};

  if (!year || !seasonType || !week) {
    return json(400, { error: 'Missing path parameters' });
  }

  const tableName = Resource.PicksTable.name;
  const record = await getUserWeekPicks(tableName, user.id, year, seasonType, week);

  return json(200, { picks: record ?? null });
});
