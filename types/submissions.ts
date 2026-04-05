import { z } from 'zod';

import { MatchupSchema, TeamIDSchema } from './teams';

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

// A user's confirmed pick — no tie, winner required.
export const GamePickSchema = z.object({
  matchup: MatchupSchema,
  winner: TeamIDSchema,
});
export type GamePick = z.infer<typeof GamePickSchema>;

// One pick while the user is still filling out — winner is null until chosen.
export const GamePickDraftSchema = z.object({
  matchup: MatchupSchema,
  winner: z.union([TeamIDSchema, z.null()]),
});
export type GamePickDraft = z.infer<typeof GamePickDraftSchema>;

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
