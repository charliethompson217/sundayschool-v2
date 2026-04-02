import { EspnGameResponseSchema, EspnGamesListResponseSchema, type EspnGameRecord } from '@/types/espn';

const ESPN_API_URL = import.meta.env.VITE_ESPN_API_URL as string;

function espnApiFetch(path: string): Promise<Response> {
  return fetch(`${ESPN_API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface EspnGamesFilter {
  year: string;
  seasonType?: string;
  week?: string;
}

export async function getEspnGames(filter: EspnGamesFilter): Promise<EspnGameRecord[]> {
  const params = new URLSearchParams({ year: filter.year });
  if (filter.seasonType) params.set('seasonType', filter.seasonType);
  if (filter.week) params.set('week', filter.week);

  const res = await espnApiFetch(`/espn/games?${params.toString()}`);
  if (!res.ok) throw new Error(`GET /espn/games failed: ${res.status}`);

  const data = await res.json();
  return EspnGamesListResponseSchema.parse(data).games;
}

export async function getEspnGame(gameId: string): Promise<EspnGameRecord> {
  const res = await espnApiFetch(`/espn/games/${encodeURIComponent(gameId)}`);
  if (!res.ok) throw new Error(`GET /espn/games/${gameId} failed: ${res.status}`);

  const data = await res.json();
  return EspnGameResponseSchema.parse(data).game;
}
