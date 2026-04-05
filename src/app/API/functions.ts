import type { RegularSeasonGameResults } from '@/types/results';
import type { WeekDetail, WeekMeta } from '@/types/schedules';
import type { PastSubmissions, RegularSeasonPicksSubmission, ScheduledMatchup, WeekLineup } from '@/types/submissions';
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

  // Week open/close is determined solely by the admin-configured submission window.
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
  // season_type '2' is ESPN's numeric code for regular season (stored as-is in DynamoDB).
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

// TODO: replace with real backend call
export async function getRegularSeasonPicksSubmissions(
  _year: number,
): Promise<Record<number, RegularSeasonPicksSubmission>> {
  return {};
}

// TODO: replace with real backend call
export async function submitRegularSeasonPicks(
  _year: number,
  _seasonType: number,
  _week: number,
  _submission: RegularSeasonPicksSubmission,
): Promise<void> {
  // no-op until submissions API is wired up
  console.log('submitRegularSeasonPicks', _year, _seasonType, _week, _submission);
}

// TODO: replace with real backend call
export async function getGameResults(): Promise<Record<number, RegularSeasonGameResults>> {
  return {};
}

// TODO: replace with real backend call
export async function getPastSubmissions(): Promise<PastSubmissions> {
  return {};
}
