import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { listAllWeekMetas, listSeasonWeekMetas } from '../../db/schedules/schedules';
import type { UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';
import type { WeekMetaRecord } from '@/types/schedules';

// GET /schedules?year=&seasonType=
//
// Required: nothing
// Optional: year → filters by year (requires a scan if seasonType is absent)
// Optional: seasonType → requires year; uses GSI1 for efficient lookup
//
// Non-admin users only receive weeks where is_published = true.
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: UserRecord) => {
  const { year, seasonType } = event.queryStringParameters ?? {};
  const tableName = Resource.SchedulesTable.name;

  let weeks: WeekMetaRecord[];

  if (year && seasonType) {
    weeks = await listSeasonWeekMetas(tableName, year, seasonType);
  } else {
    weeks = await listAllWeekMetas(tableName);
    if (year) {
      weeks = weeks.filter((w) => w.year === year);
    }
  }

  if (!user.isAdmin) {
    weeks = weeks.filter((w) => w.is_published);
  }

  return json(200, { weeks, count: weeks.length });
});
