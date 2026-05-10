import type { WeekDetail, WeekMeta } from '@/types/schedules';
import type { PickKind, ScheduledMatchup, WeekLineup } from '@/types/submissions';
import type { TeamID } from '@/types/teams';

import { authedFetch } from './authedFetch';

// TODO: replace with real backend call
export async function getSeasonPhase(): Promise<PickKind> {
  return 'regular'; // change to 'playoff' to test that branch
}

// TODO: replace with real backend call
export async function getYears(): Promise<number[]> {
  return [2022, 2023, 2024, 2025];
}

// ── Generic week metas fetcher ───────────────────────────────────────────────

async function getWeekMetas(year: number, seasonType: string): Promise<WeekMeta[]> {
  const params = new URLSearchParams({ year: String(year), seasonType });
  const res = await authedFetch(`/schedules?${params}`);
  if (!res.ok) throw new Error(`GET /schedules failed: ${res.status}`);
  const data = (await res.json()) as { weeks: WeekMeta[] };
  return data.weeks
    .filter((w) => w.is_published && w.submission_closes_at)
    .sort((a, b) => parseInt(a.week, 10) - parseInt(b.week, 10));
}

async function getWeekDetail(weekMeta: WeekMeta): Promise<WeekDetail> {
  const { year, season_type, week } = weekMeta;
  const res = await authedFetch(`/schedules/${year}/${season_type}/${week}`);
  if (!res.ok) throw new Error(`GET /schedules/${year}/${season_type}/${week} failed: ${res.status}`);
  return (await res.json()) as WeekDetail;
}

// ── Regular season ───────────────────────────────────────────────────────────

export const getRegularSeasonWeekMetas = (year: number) => getWeekMetas(year, '2');

function weekDetailToWeekLineup(detail: WeekDetail): WeekLineup | null {
  const { meta, games } = detail;

  const kickoff = meta.submission_closes_at;
  if (!kickoff) return null;

  const scheduledMatchups: ScheduledMatchup[] = [];

  for (const game of games) {
    if (!game.espn) continue;

    const awayId = game.espn.away as TeamID;
    const homeId = game.espn.home as TeamID;
    if (!awayId || !homeId) continue;

    if (game.include_in_rank) {
      scheduledMatchups.push({ gameId: game.game_id, matchup: [awayId, homeId], gameType: 'rank' });
    } else if (game.include_in_file) {
      scheduledMatchups.push({ gameId: game.game_id, matchup: [awayId, homeId], gameType: 'file' });
    }
  }

  if (scheduledMatchups.length === 0) return null;

  return {
    week: parseInt(meta.week, 10),
    kickoff,
    scheduledMatchups,
  };
}

export async function getWeekLineup(weekMeta: WeekMeta): Promise<WeekLineup | null> {
  const detail = await getWeekDetail(weekMeta);
  return weekDetailToWeekLineup(detail);
}

// ── Playoffs ─────────────────────────────────────────────────────────────────

export const getPlayOffsWeekMetas = (year: number) => getWeekMetas(year, '3');

export type PlayoffWageableGame = {
  gameId: string;
  away: TeamID;
  home: TeamID;
  spread: number;
};

export async function getPlayOffsWeekGames(weekMeta: WeekMeta): Promise<PlayoffWageableGame[]> {
  const detail = await getWeekDetail(weekMeta);

  return detail.games
    .filter((g) => g.is_wagerable && g.espn)
    .map((g) => ({
      gameId: g.game_id,
      away: g.espn!.away as TeamID,
      home: g.espn!.home as TeamID,
      // TODO: replace with real odds once available
      spread: -3.5,
    }));
}
