import { z } from 'zod';

import { TEAM_IDS } from './TEAM_IDS';

// ── Primitives ────────────────────────────────────────────────────────────────

// Mirror of the TeamID union as a runtime-checkable Zod enum.
export const TeamIDSchema = z.enum(Object.keys(TEAM_IDS) as [keyof typeof TEAM_IDS, ...Array<keyof typeof TEAM_IDS>]);

// What ChooseTeam stores: a chosen team, a tie, or nothing yet (null).
// `allowTie` controls whether 'TIE' is ever reachable in the UI.
export const TeamSelectionSchema = z.union([TeamIDSchema, z.literal('TIE'), z.null()]);
export type TeamSelection = z.infer<typeof TeamSelectionSchema>;

// Matchup: [awayTeamID, homeTeamID]
export const MatchupSchema = z.tuple([TeamIDSchema, TeamIDSchema]);
export type Matchup = z.infer<typeof MatchupSchema>;

// ── Schedule ──────────────────────────────────────────────────────────────────

// 'rank' — user picks a winner AND ranks the game by confidence.
// 'file' — user just picks a winner; the game is not ranked.
export const GameTypeSchema = z.enum(['rank', 'file']);
export type GameType = z.infer<typeof GameTypeSchema>;

export const ScheduledMatchupSchema = z.object({
  matchup: MatchupSchema,
  gameType: GameTypeSchema,
});
export type ScheduledMatchup = z.infer<typeof ScheduledMatchupSchema>;

export const WeekLineupSchema = z.object({
  week: z.number().int().positive(),
  scheduledMatchups: z.array(ScheduledMatchupSchema).min(1),
  kickoff: z.iso.datetime(),
});
export type WeekLineup = z.infer<typeof WeekLineupSchema>;

export const RegularSeasonLineupsSchema = z.array(WeekLineupSchema).min(1);
export type RegularSeasonLineups = z.infer<typeof RegularSeasonLineupsSchema>;

// ── Single-game types ─────────────────────────────────────────────────────────

// A user's confirmed pick — no tie, winner required.
export const GamePickSchema = z.object({
  matchup: MatchupSchema,
  winner: TeamIDSchema,
});
export type GamePick = z.infer<typeof GamePickSchema>;

// Admin-entered actual result — tie is valid, winner required.
export const GameResultSchema = z.object({
  matchup: MatchupSchema,
  winner: z.union([TeamIDSchema, z.literal('TIE')]),
});
export type GameResult = z.infer<typeof GameResultSchema>;

// Actual result with final scores — score is [awayScore, homeScore] mirroring the matchup tuple.
export const GameResultWithScoreSchema = GameResultSchema.extend({
  score: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
});
export type GameResultWithScore = z.infer<typeof GameResultWithScoreSchema>;

// Full results for a week, split to mirror the RegularSeasonPicksSubmission shape.
export const RegularSeasonGameResultsSchema = z.object({
  rankedResults: z.array(GameResultWithScoreSchema).min(1),
  filedResults: z.array(GameResultWithScoreSchema),
});
export type RegularSeasonGameResults = z.infer<typeof RegularSeasonGameResultsSchema>;

// ── Draft (in-progress form state) ───────────────────────────────────────────

// One pick while the user is still filling out — winner is null until chosen.
export const GamePickDraftSchema = z.object({
  matchup: MatchupSchema,
  winner: z.union([TeamIDSchema, z.null()]),
});
export type GamePickDraft = z.infer<typeof GamePickDraftSchema>;

// ── Submission ────────────────────────────────────────────────────────────────

// Validated regular season weekly picks submission.
// rankedPicks — 'rank' games in confidence order: [0] = most confident.
// filedPicks  — 'file' games in any order; confidence is not tracked.
export const RegularSeasonPicksSubmissionSchema = z.object({
  rankedPicks: z.array(GamePickSchema).min(1),
  filedPicks: z.array(GamePickSchema),
});
export type RegularSeasonPicksSubmission = z.infer<typeof RegularSeasonPicksSubmissionSchema>;

// All users' submissions for a single closed week, keyed by user ID.
export const RegularSeasonAllUsersSubmissionsSchema = z.record(z.string(), RegularSeasonPicksSubmissionSchema);
export type RegularSeasonAllUsersSubmissions = z.infer<typeof RegularSeasonAllUsersSubmissionsSchema>;

// Past submissions across all closed weeks, keyed by week number.
export const PastSubmissionsSchema = z.record(z.coerce.number(), RegularSeasonAllUsersSubmissionsSchema);
export type PastSubmissions = z.infer<typeof PastSubmissionsSchema>;
