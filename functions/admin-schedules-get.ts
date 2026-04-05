import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { withAuth } from './lib/cognito-auth';
import { getWeekMeta, getWeekGames } from './lib/schedules-dynamo';
import { getGamesByWeek } from './lib/espn-read';
import type { UserRecord } from './lib/users-dynamo';
import type { ScheduleGameRecord } from '@/types/schedules';
import type { EspnGameRecord } from '@/types/espn';

function json(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// GET /schedules/{year}/{seasonType}/{week}
//
// Returns the week's META item, its configured games, and any matching ESPN
// game data keyed by game_id. Non-admin users cannot see unpublished weeks.
export const handler = withAuth(async (event: APIGatewayProxyEventV2, user: UserRecord) => {
  const { year, seasonType, week } = event.pathParameters ?? {};

  if (!year || !seasonType || !week) {
    return json(400, { error: 'Missing path parameters' });
  }

  const schedulesTable = Resource.SchedulesTable.name;
  const espnTable = Resource.EspnGames.name;

  const meta = await getWeekMeta(schedulesTable, year, seasonType, week);
  if (!meta) {
    return json(404, { error: 'Week not found' });
  }

  if (!user.isAdmin && !meta.is_published) {
    return json(404, { error: 'Week not found' });
  }

  const [scheduleGames, espnGames] = await Promise.all([
    getWeekGames(schedulesTable, year, seasonType, week),
    getGamesByWeek(espnTable, year, seasonType, week),
  ]);

  const espnByGameId = new Map<string, EspnGameRecord>(espnGames.map((g) => [g.game_id, g]));

  const games = scheduleGames.map((g: ScheduleGameRecord) => ({
    ...g,
    espn: espnByGameId.get(g.game_id) ?? null,
  }));

  return json(200, { meta, games });
});
