import { z } from 'zod';

// ── Webhook / ingest payloads ─────────────────────────────────────────────────

const GameIdentifiersSchema = z.object({
  game_id: z.string().min(1),
  competition_id: z.string().min(1),
  year: z.string().min(1),
  season_type: z.string().min(1),
  week: z.string().min(1),
  week_text: z.string(),
  start_time: z.string().min(1),
  home_team_id: z.string().min(1),
  away_team_id: z.string().min(1),
  home: z.string().min(1),
  away: z.string().min(1),
});

export const ScheduleUpsertGameSchema = GameIdentifiersSchema.extend({
  competition_type: z.string(),
  competition_type_slug: z.string(),
  neutral_site: z.boolean(),
  venue_id: z.string().nullable(),
  venue_full_name: z.string().nullable(),
  venue_city: z.string().nullable(),
  venue_state: z.string().nullable(),
  venue_country: z.string().nullable(),
}).strict();

export const GameFinalGameSchema = GameIdentifiersSchema.extend({
  home_score: z.number().int(),
  away_score: z.number().int(),
  status: z.string().min(1),
  completed: z.literal(true),
  winner: z.enum(['home', 'away', 'tie']),
}).strict();

const ScheduleUpsertBodySchema = z
  .object({
    type: z.literal('schedule_upsert'),
    sent_at: z.string().min(1),
    games: z.array(ScheduleUpsertGameSchema).min(1),
  })
  .strict();

const GameFinalBodySchema = z
  .object({
    type: z.literal('game_final'),
    sent_at: z.string().min(1),
    games: z.array(GameFinalGameSchema).min(1),
  })
  .strict();

export const EspnIngestBodySchema = z.discriminatedUnion('type', [ScheduleUpsertBodySchema, GameFinalBodySchema]);

export type ScheduleUpsertGame = z.infer<typeof ScheduleUpsertGameSchema>;
export type GameFinalGame = z.infer<typeof GameFinalGameSchema>;
export type EspnIngestBody = z.infer<typeof EspnIngestBodySchema>;

// ── DynamoDB record + API (EspnGames table / public games API) ───────────────

export const EspnGameRecordSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  gsi1pk: z.string().optional(),
  gsi1sk: z.string().optional(),
  game_id: z.string(),
  competition_id: z.string(),
  year: z.string(),
  season_type: z.string(),
  week: z.string(),
  week_text: z.string(),
  start_time: z.string(),
  home_team_id: z.string(),
  away_team_id: z.string(),
  home: z.string(),
  away: z.string(),
  entity_type: z.string(),
  source_event_type: z.enum(['schedule_upsert', 'game_final']),
  espn_updated_at: z.string(),
  ingested_at: z.string(),
  schedule_hash: z.string().optional(),
  final_hash: z.string().optional(),
  // schedule_upsert fields
  competition_type: z.string().optional(),
  competition_type_slug: z.string().optional(),
  neutral_site: z.boolean().optional(),
  venue_id: z.string().nullable().optional(),
  venue_full_name: z.string().nullable().optional(),
  venue_city: z.string().nullable().optional(),
  venue_state: z.string().nullable().optional(),
  venue_country: z.string().nullable().optional(),
  is_international: z.boolean().optional(),
  // game_final fields
  home_score: z.number().optional(),
  away_score: z.number().optional(),
  status: z.string().optional(),
  completed: z.boolean().optional(),
  winner: z.enum(['home', 'away', 'tie']).nullable().optional(),
});

export type EspnGameRecord = z.infer<typeof EspnGameRecordSchema>;

export const EspnGamesListResponseSchema = z.object({
  games: z.array(EspnGameRecordSchema),
  count: z.number(),
});

export const EspnGameResponseSchema = z.object({
  game: EspnGameRecordSchema,
});
