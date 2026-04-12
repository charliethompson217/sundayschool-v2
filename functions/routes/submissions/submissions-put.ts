import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from '../../utils/auth/cognito-auth';
import { buildRegularSeasonPicksItem, buildPlayoffPicksItem, putPicks } from '../../db/picks/picks';
import type { UserRecord } from '../../db/users/users';
import { json } from '../../utils/http';
import { RegularSeasonPicksSubmissionSchema, PlayOffsPicksSubmissionSchema } from '@/types/submissions';
import { getWeekMeta } from '../../db/schedules/schedules';

// PUT /submissions/{year}/{seasonType}/{week}
//
// Upserts the authenticated user's picks for a week.
// Body must be { kind: 'regular', picks: RegularSeasonPicksSubmission }
//            or { kind: 'playoff', picks: PlayOffsPicksSubmission }
//
// Re-submitting overwrites the previous entry; submitted_at is refreshed.
// Returns 409 if the week's submission_closes_at has already passed.
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: UserRecord) => {
  const { year, seasonType, week } = event.pathParameters ?? {};

  if (!year || !seasonType || !week) {
    return json(400, { error: 'Missing path parameters' });
  }

  const meta = await getWeekMeta(Resource.SchedulesTable.name, year, seasonType, week);

  if (!meta) {
    return json(404, { error: 'Week not found' });
  }

  if (meta.submission_closes_at && new Date() > new Date(meta.submission_closes_at)) {
    return json(409, { error: 'Submission window has closed', closes_at: meta.submission_closes_at });
  }

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (typeof body !== 'object' || body === null || !('kind' in body) || !('picks' in body)) {
    return json(400, { error: 'Body must include "kind" and "picks"' });
  }

  const { kind, picks } = body as { kind: unknown; picks: unknown };

  const tableName = Resource.PicksTable.name;

  if (kind === 'regular') {
    const parsed = RegularSeasonPicksSubmissionSchema.safeParse(picks);
    if (!parsed.success) {
      return json(422, { error: 'Invalid regular season picks', details: parsed.error.flatten() });
    }
    const item = buildRegularSeasonPicksItem(user.id, year, seasonType, week, parsed.data);
    await putPicks(tableName, item);
    return json(200, { picks: item });
  }

  if (kind === 'playoff') {
    const parsed = PlayOffsPicksSubmissionSchema.safeParse(picks);
    if (!parsed.success) {
      return json(422, { error: 'Invalid playoff picks', details: parsed.error.flatten() });
    }
    const item = buildPlayoffPicksItem(user.id, year, seasonType, week, parsed.data);
    await putPicks(tableName, item);
    return json(200, { picks: item });
  }

  return json(400, { error: 'kind must be "regular" or "playoff"' });
});
