import type { PastSubmissions, PlayOffsPicksSubmission, RegularSeasonPicksSubmission } from '@/types/submissions';

import { authedFetch } from './authedFetch';

// ── Regular season (season_type '2') ─────────────────────────────────────────

/** Returns the current user's picks for every regular season week in `year`, keyed by week number. */
export async function getRegularSeasonPicksSubmissions(
  year: number,
): Promise<Record<number, RegularSeasonPicksSubmission>> {
  const res = await authedFetch(`/submissions/${year}/2`);
  if (!res.ok) throw new Error(`GET /submissions/${year}/2 failed: ${res.status}`);
  const { submissions } = (await res.json()) as { submissions: Record<string, RegularSeasonPicksSubmission> };
  // Re-key with integer week numbers to match the hook's Record<number, ...> contract.
  return Object.fromEntries(Object.entries(submissions).map(([week, picks]) => [parseInt(week, 10), picks]));
}

/** Upserts the current user's regular season picks for a specific week. */
export async function submitRegularSeasonPicks(
  year: number,
  seasonType: number,
  week: number,
  submission: RegularSeasonPicksSubmission,
): Promise<void> {
  const res = await authedFetch(`/submissions/${year}/${seasonType}/${week}`, {
    method: 'PUT',
    body: JSON.stringify({ kind: 'regular', picks: submission }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT /submissions failed (${res.status}): ${body}`);
  }
}

/** Fetches all users' regular season submissions for every closed week in `year`.
 *  Requires admin access; returns an object keyed by week → userId → picks.
 *  Callers that need this should drive the per-week admin endpoint directly. */
export async function getEveryonesPastRegularSeasonSubmissions(): Promise<PastSubmissions> {
  return {};
}

// ── Playoffs (season_type '3') ────────────────────────────────────────────────

/** Returns the current user's picks for every playoff week in `year`, keyed by week number. */
export async function getPlayOffsPicksSubmissions(year: number): Promise<Record<number, PlayOffsPicksSubmission>> {
  const res = await authedFetch(`/submissions/${year}/3`);
  if (!res.ok) throw new Error(`GET /submissions/${year}/3 failed: ${res.status}`);
  const { submissions } = (await res.json()) as { submissions: Record<string, PlayOffsPicksSubmission> };
  return Object.fromEntries(Object.entries(submissions).map(([week, picks]) => [parseInt(week, 10), picks]));
}

/** Upserts the current user's playoff picks for a specific week. */
export async function submitPlayOffsPicks(
  year: number,
  seasonType: number,
  week: number,
  submission: PlayOffsPicksSubmission,
): Promise<void> {
  const res = await authedFetch(`/submissions/${year}/${seasonType}/${week}`, {
    method: 'PUT',
    body: JSON.stringify({ kind: 'playoff', picks: submission }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PUT /submissions failed (${res.status}): ${body}`);
  }
}
