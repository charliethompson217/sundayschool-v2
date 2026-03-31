import { z } from 'zod';

// ── Shared identifying fields present in both event types ────────────────────

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

// ── schedule_upsert game schema ──────────────────────────────────────────────

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

// ── game_final game schema ───────────────────────────────────────────────────

export const GameFinalGameSchema = GameIdentifiersSchema.extend({
  home_score: z.number().int(),
  away_score: z.number().int(),
  status: z.string().min(1),
  completed: z.literal(true),
  winner: z.enum(['home', 'away']).nullable(),
}).strict();

// ── Top-level webhook body (discriminated on "type") ─────────────────────────

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

// ── Inferred TS types ────────────────────────────────────────────────────────

export type ScheduleUpsertGame = z.infer<typeof ScheduleUpsertGameSchema>;
export type GameFinalGame = z.infer<typeof GameFinalGameSchema>;
export type EspnIngestBody = z.infer<typeof EspnIngestBodySchema>;
