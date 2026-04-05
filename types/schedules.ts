import { z } from 'zod';

import { EspnGameRecordSchema } from './espn';

// ── Admin POST/PUT body (Zod validation, Lambda handlers) ────────────────────
//
// kind is derived server-side from the URL's seasonType param and not sent
// in the body; playoff-specific fields are only required when seasonType = 3.

const MetaBaseInputSchema = z.object({
  is_published: z.boolean(),
  submission_opens_at: z.string().datetime({ offset: true }).nullable(),
  submission_closes_at: z.string().datetime({ offset: true }).nullable(),
  notes: z.string().nullable().optional(),
});

export const RegularMetaInputSchema = MetaBaseInputSchema;

export const PlayoffMetaInputSchema = MetaBaseInputSchema.extend({
  round_name: z.string().min(1),
  allow_straight_bets: z.boolean(),
  allow_parlay: z.boolean(),
  parlay_leg_count: z.number().int().positive(),
});

const GameBaseInputSchema = z.object({
  game_id: z.string().min(1),
});

export const RegularGameInputSchema = GameBaseInputSchema.extend({
  include_in_rank: z.boolean(),
  include_in_file: z.boolean(),
  description: z.string().nullable().optional(),
  special_tag: z.string().nullable().optional(),
});

export const PlayoffGameInputSchema = GameBaseInputSchema.extend({
  is_wagerable: z.boolean(),
});

export const RegularWeekBodySchema = z.object({
  meta: RegularMetaInputSchema,
  games: z.array(RegularGameInputSchema),
});

export const PlayoffWeekBodySchema = z.object({
  meta: PlayoffMetaInputSchema,
  games: z.array(PlayoffGameInputSchema),
});

export type RegularMetaInput = z.infer<typeof RegularMetaInputSchema>;
export type PlayoffMetaInput = z.infer<typeof PlayoffMetaInputSchema>;
export type MetaInput = RegularMetaInput | PlayoffMetaInput;

export type RegularGameInput = z.infer<typeof RegularGameInputSchema>;
export type PlayoffGameInput = z.infer<typeof PlayoffGameInputSchema>;
export type GameInput = RegularGameInput | PlayoffGameInput;

export type RegularWeekBody = z.infer<typeof RegularWeekBodySchema>;
export type PlayoffWeekBody = z.infer<typeof PlayoffWeekBodySchema>;

// ── Shared week meta payload (Dynamo META item + API meta object) ─────────────

const WeekMetaPayloadSchema = z.object({
  year: z.string(),
  season_type: z.string(),
  week: z.string(),
  kind: z.enum(['regular', 'playoff']),
  is_published: z.boolean(),
  submission_opens_at: z.string().nullable(),
  submission_closes_at: z.string().nullable(),
  notes: z.string().nullable().optional(),
  round_name: z.string().optional(),
  allow_straight_bets: z.boolean().optional(),
  allow_parlay: z.boolean().optional(),
  parlay_leg_count: z.number().optional(),
});

const WeekMetaDynamoKeySchema = z.object({
  pk: z.string(),
  sk: z.literal('META'),
  gsi1pk: z.string(),
  gsi1sk: z.string(),
});

const WeekMetaApiKeySchema = z.object({
  pk: z.string(),
  sk: z.literal('META'),
  gsi1pk: z.string().optional(),
  gsi1sk: z.string().optional(),
});

/** Stored DynamoDB META item (GSI keys always present). */
export const WeekMetaRecordSchema = WeekMetaDynamoKeySchema.merge(WeekMetaPayloadSchema);
export type WeekMetaRecord = z.infer<typeof WeekMetaRecordSchema>;

/** GET list/detail meta (GSI keys may be omitted in JSON). */
export const WeekMetaSchema = WeekMetaApiKeySchema.merge(WeekMetaPayloadSchema);

// ── Shared schedule game row (Dynamo GAME# item + API game before/after ESPN) ─

const ScheduleGamePayloadSchema = z.object({
  game_id: z.string(),
  include_in_rank: z.boolean().optional(),
  include_in_file: z.boolean().optional(),
  description: z.string().nullable().optional(),
  special_tag: z.string().nullable().optional(),
  is_wagerable: z.boolean().optional(),
});

const ScheduleGameDynamoKeySchema = z.object({
  pk: z.string(),
  sk: z.string(),
  year: z.string(),
  season_type: z.string(),
  week: z.string(),
});

/** Stored DynamoDB game line item (no embedded ESPN). */
export const ScheduleGameRecordSchema = ScheduleGameDynamoKeySchema.merge(ScheduleGamePayloadSchema);
export type ScheduleGameRecord = z.infer<typeof ScheduleGameRecordSchema>;

/** GET detail game line with optional ESPN enrichment. */
export const ScheduleGameSchema = ScheduleGameRecordSchema.extend({
  espn: EspnGameRecordSchema.nullable().optional(),
});

// ── Composite API responses ─────────────────────────────────────────────────

export const WeekDetailSchema = z.object({
  meta: WeekMetaSchema,
  games: z.array(ScheduleGameSchema),
});

export const WeeksListResponseSchema = z.object({
  weeks: z.array(WeekMetaSchema),
  count: z.number(),
});

export type WeekMeta = z.infer<typeof WeekMetaSchema>;
export type ScheduleGame = z.infer<typeof ScheduleGameSchema>;
export type WeekDetail = z.infer<typeof WeekDetailSchema>;

// ── Client form / fetch body (regular meta + optional playoff fields) ────────

export type WeekMetaInput = RegularMetaInput &
  Partial<Pick<PlayoffMetaInput, 'round_name' | 'allow_straight_bets' | 'allow_parlay' | 'parlay_leg_count'>>;

export type WeekUpdateBody = {
  meta: WeekMetaInput;
  games: RegularGameInput[] | PlayoffGameInput[];
};
