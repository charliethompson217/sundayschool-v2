import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { getAllUsersWeekPicks } from '../../db/picks/picks';
import type { UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';

// GET /admin/submissions/{year}/{seasonType}/{week}
//
// Returns every user's picks for the requested week, keyed by userId.
// Admin only.
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: UserRecord) => {
  if (!user.isAdmin) {
    return json(403, { error: 'Forbidden' });
  }

  const { year, seasonType, week } = event.pathParameters ?? {};

  if (!year || !seasonType || !week) {
    return json(400, { error: 'Missing path parameters' });
  }

  const tableName = Resource.PicksTable.name;
  const records = await getAllUsersWeekPicks(tableName, year, seasonType, week);

  // Key by userId for convenient client-side lookup.
  const byUserId = Object.fromEntries(records.map((r) => [r.userId, r]));

  return json(200, { submissions: byUserId });
});
