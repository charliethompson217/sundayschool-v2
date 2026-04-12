import type { WeekDetail, WeekMeta } from '@/types/schedules';
import type { ScheduledMatchup, WeekLineup } from '@/types/submissions';
import type { TeamID } from '@/types/teams';

import { authedFetch } from './authedFetch';

export type SeasonPhase = 'regular' | 'playoffs';

// TODO: replace with real backend call
export async function getSeasonPhase(): Promise<SeasonPhase> {
  return 'regular'; // change to 'playoffs' to test that branch
}

export async function getYears(): Promise<number[]> {
  return [2022, 2023, 2024, 2025];
}

function weekDetailToWeekLineup(detail: WeekDetail): WeekLineup | null {
  const { meta, games } = detail;

  // Weeks without a closes_at are not yet ready for submission — skip them.
  const kickoff = meta.submission_closes_at;
  if (!kickoff) return null;

  const scheduledMatchups: ScheduledMatchup[] = [];

  for (const game of games) {
    if (!game.espn) continue;

    const awayId = game.espn.away as TeamID;
    const homeId = game.espn.home as TeamID;
    if (!awayId || !homeId) continue;

    if (game.include_in_rank) {
      scheduledMatchups.push({ matchup: [awayId, homeId], gameType: 'rank' });
    } else if (game.include_in_file) {
      scheduledMatchups.push({ matchup: [awayId, homeId], gameType: 'file' });
    }
  }

  if (scheduledMatchups.length === 0) return null;

  return {
    week: parseInt(meta.week, 10),
    kickoff,
    scheduledMatchups,
  };
}

export async function getRegularSeasonWeekMetas(year: number): Promise<WeekMeta[]> {
  // season_type '2' is ESPN's numeric code for regular season.
  const params = new URLSearchParams({ year: String(year), seasonType: '2' });
  const res = await authedFetch(`/schedules?${params}`);
  if (!res.ok) throw new Error(`GET /schedules failed: ${res.status}`);
  const data = (await res.json()) as { weeks: WeekMeta[] };
  return data.weeks
    .filter((w) => w.is_published && w.submission_closes_at)
    .sort((a, b) => parseInt(a.week, 10) - parseInt(b.week, 10));
}

export async function getWeekLineup(weekMeta: WeekMeta): Promise<WeekLineup | null> {
  const { year, season_type, week } = weekMeta;
  const res = await authedFetch(`/schedules/${year}/${season_type}/${week}`);
  if (!res.ok) throw new Error(`GET /schedules/${year}/${season_type}/${week} failed: ${res.status}`);
  const detail = (await res.json()) as WeekDetail;
  return weekDetailToWeekLineup(detail);
}

/** A wagerable game in a playoff week, with teams and a spread. */
export type PlayoffWageableGame = {
  gameId: string;
  away: TeamID;
  home: TeamID;
  /** Points: negative means home is favored. e.g. -3.5 → home -3.5, away +3.5. */
  spread: number;
};

export async function getPlayOffsWeekMetas(year: number): Promise<WeekMeta[]> {
  // season_type '3' is ESPN's numeric code for post-season.
  const params = new URLSearchParams({ year: String(year), seasonType: '3' });
  const res = await authedFetch(`/schedules?${params}`);
  if (!res.ok) throw new Error(`GET /schedules failed: ${res.status}`);
  const data = (await res.json()) as { weeks: WeekMeta[] };
  return data.weeks
    .filter((w) => w.is_published && w.submission_closes_at)
    .sort((a, b) => parseInt(a.week, 10) - parseInt(b.week, 10));
}

export async function getPlayOffsWeekGames(weekMeta: WeekMeta): Promise<PlayoffWageableGame[]> {
  const { year, season_type, week } = weekMeta;
  const res = await authedFetch(`/schedules/${year}/${season_type}/${week}`);
  if (!res.ok) throw new Error(`GET /schedules/${year}/${season_type}/${week} failed: ${res.status}`);
  const detail = (await res.json()) as WeekDetail;

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
