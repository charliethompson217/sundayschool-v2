import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { getUserSeasonPicks } from '../../db/picks/picks';
import type { UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';

// GET /submissions/{year}/{seasonType}
//
// Returns all of the authenticated user's picks for every week in the given
// season in a single DynamoDB query, keyed by week number (integer).
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: UserRecord) => {
  const { year, seasonType } = event.pathParameters ?? {};

  if (!year || !seasonType) {
    return json(400, { error: 'Missing path parameters' });
  }

  const tableName = Resource.PicksTable.name;
  const records = await getUserSeasonPicks(tableName, user.id, year, seasonType);

  // Key by week number (integer) to match the Record<number, ...> shape the
  // frontend hooks expect.
  const byWeek = Object.fromEntries(records.map((r) => [parseInt(r.week, 10), r.picks]));

  return json(200, { submissions: byWeek });
});
