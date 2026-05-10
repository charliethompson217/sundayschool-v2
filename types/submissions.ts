import { z } from 'zod';

import { MatchupSchema, TeamIDSchema } from './teams.ts';

export const PickKindSchema = z.enum(['regular', 'playoff']);
export type PickKind = z.infer<typeof PickKindSchema>;

// 'rank' — user picks a winner AND ranks the game by confidence.
// 'file' — user just picks a winner; the game is not ranked.
export const GameTypeSchema = z.enum(['rank', 'file']);
export type GameType = z.infer<typeof GameTypeSchema>;

export const ScheduledMatchupSchema = z.object({
  gameId: z.string(),
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
  gameId: z.string(),
  winner: TeamIDSchema,
});
export type GamePick = z.infer<typeof GamePickSchema>;

// One pick while the user is still filling out — winner is null until chosen.
// Includes the matchup for in-form display; only gameId + winner are submitted.
export const GamePickDraftSchema = z.object({
  gameId: z.string(),
  matchup: MatchupSchema,
  winner: z.union([TeamIDSchema, z.null()]),
});
export type GamePickDraft = z.infer<typeof GamePickDraftSchema>;

// Validated regular season weekly picks submission.
// rankedPicks — 'rank' games in confidence order: [0] = most confident.
//               Empty when a player missed the rank deadline but still filed a pick.
// filedPicks  — 'file' games in any order; confidence is not tracked.
export const RegularSeasonPicksSubmissionSchema = z.object({
  rankedPicks: z.array(GamePickSchema),
  filedPicks: z.array(GamePickSchema),
});
export type RegularSeasonPicksSubmission = z.infer<typeof RegularSeasonPicksSubmissionSchema>;

// All users' submissions for a single closed week, keyed by user ID.
export const RegularSeasonAllUsersSubmissionsSchema = z.record(z.string(), RegularSeasonPicksSubmissionSchema);
export type RegularSeasonAllUsersSubmissions = z.infer<typeof RegularSeasonAllUsersSubmissionsSchema>;

// Past submissions across all closed weeks, keyed by week number.
export const PastSubmissionsSchema = z.record(z.coerce.number(), RegularSeasonAllUsersSubmissionsSchema);
export type PastSubmissions = z.infer<typeof PastSubmissionsSchema>;

// ── Playoffs betting ──────────────────────────────────────────────────────────

// One straight bet: pick a team to cover the spread, plus an amount.
export const PlayoffStraightBetSchema = z.object({
  gameId: z.string(),
  winner: TeamIDSchema,
  amount: z.number().int().positive(),
});
export type PlayoffStraightBet = z.infer<typeof PlayoffStraightBetSchema>;

// One leg of a parlay.
export const PlayoffParlayLegSchema = z.object({
  gameId: z.string(),
  winner: TeamIDSchema,
});
export type PlayoffParlayLeg = z.infer<typeof PlayoffParlayLegSchema>;

// A parlay bet: exactly parlay_leg_count legs with a combined wager.
export const PlayoffParlayBetSchema = z.object({
  legs: z.array(PlayoffParlayLegSchema).min(2),
  amount: z.number().int().positive(),
});
export type PlayoffParlayBet = z.infer<typeof PlayoffParlayBetSchema>;

export const PlayOffsPicksSubmissionSchema = z.object({
  straightBets: z.array(PlayoffStraightBetSchema),
  parlayBet: PlayoffParlayBetSchema.nullable(),
});
export type PlayOffsPicksSubmission = z.infer<typeof PlayOffsPicksSubmissionSchema>;

// ── Picks records (Dynamo items) ──────────────────────────────────────────────

const PicksRecordBaseSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  gsi1pk: z.string(),
  gsi1sk: z.string(),
  userId: z.string(),
  year: z.string(),
  season_type: z.string(),
  week: z.string(),
  submitted_at: z.string(),
});

export const RegularSeasonPicksRecordSchema = PicksRecordBaseSchema.extend({
  kind: z.literal('regular'),
  picks: RegularSeasonPicksSubmissionSchema,
});
export type RegularSeasonPicksRecord = z.infer<typeof RegularSeasonPicksRecordSchema>;

export const PlayoffPicksRecordSchema = PicksRecordBaseSchema.extend({
  kind: z.literal('playoff'),
  picks: PlayOffsPicksSubmissionSchema,
});
export type PlayoffPicksRecord = z.infer<typeof PlayoffPicksRecordSchema>;

export const PicksRecordSchema = z.discriminatedUnion('kind', [
  RegularSeasonPicksRecordSchema,
  PlayoffPicksRecordSchema,
]);
export type PicksRecord = z.infer<typeof PicksRecordSchema>;
