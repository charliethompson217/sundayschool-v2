import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Resource } from 'sst';

import { getGameById, getGamesBySeason, getGamesByWeek, getGamesByYear } from './lib/espn-read';

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// GET /espn/games/{gameId}
export async function getHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const gameId = event.pathParameters?.gameId;
  if (!gameId) return json(400, { error: 'Missing gameId' });

  const game = await getGameById(Resource.EspnGames.name, gameId);
  if (!game) return json(404, { error: 'Game not found' });

  return json(200, { game });
}

// GET /espn/games?year=&seasonType=&week=
//
// Required: year
// Optional: seasonType → narrows to one season type
// Optional: week      → narrows to a single week (requires seasonType)
export async function listHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { year, seasonType, week } = event.queryStringParameters ?? {};

  if (!year) return json(400, { error: '"year" query param is required' });

  const tableName = Resource.EspnGames.name;

  let games;
  if (year && seasonType && week) {
    games = await getGamesByWeek(tableName, year, seasonType, week);
  } else if (year && seasonType) {
    games = await getGamesBySeason(tableName, year, seasonType);
  } else {
    games = await getGamesByYear(tableName, year);
  }

  return json(200, { games, count: games.length });
}
