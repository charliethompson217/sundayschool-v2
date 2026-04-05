import { z } from 'zod';

import { MatchupSchema, TeamIDSchema } from './teams';

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
