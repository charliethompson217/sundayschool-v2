import type {
  PickKind,
  PastSubmissions,
  RegularSeasonPicksSubmission,
  PlayOffsPicksSubmission,
} from '@/types/submissions';

import { authedFetch } from './authedFetch';

// ── Generic helpers ──────────────────────────────────────────────────────────

async function getPicksSubmissions<T>(year: number, seasonType: string): Promise<Record<number, T>> {
  const res = await authedFetch(`/submissions/${year}/${seasonType}`);
  if (!res.ok) throw new Error(`GET /submissions/${year}/${seasonType} failed: ${res.status}`);
  const { submissions } = (await res.json()) as { submissions: Record<string, T> };
  return Object.fromEntries(Object.entries(submissions).map(([week, picks]) => [parseInt(week, 10), picks]));
}

async function submitPicks<T>(
  year: number,
  seasonType: number,
  week: number,
  kind: PickKind,
  submission: T,
): Promise<void> {
  const res = await authedFetch(`/submissions/${year}/${seasonType}/${week}`, {
    method: 'PUT',
    body: JSON.stringify({ kind, picks: submission }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT /submissions failed (${res.status}): ${body}`);
  }
}

// ── Regular season (season_type '2') ─────────────────────────────────────────

export const getRegularSeasonPicksSubmissions = (year: number) =>
  getPicksSubmissions<RegularSeasonPicksSubmission>(year, '2');

export const submitRegularSeasonPicks = (
  year: number,
  seasonType: number,
  week: number,
  submission: RegularSeasonPicksSubmission,
) => submitPicks(year, seasonType, week, 'regular', submission);

// TODO: replace with real backend call
export async function getEveryonesPastRegularSeasonSubmissions(): Promise<PastSubmissions> {
  return {};
}

// ── Playoffs (season_type '3') ────────────────────────────────────────────────

export const getPlayOffsPicksSubmissions = (year: number) => getPicksSubmissions<PlayOffsPicksSubmission>(year, '3');

export const submitPlayOffsPicks = (
  year: number,
  seasonType: number,
  week: number,
  submission: PlayOffsPicksSubmission,
) => submitPicks(year, seasonType, week, 'playoff', submission);
