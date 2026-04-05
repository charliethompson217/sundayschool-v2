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
  winner: z.enum(['home', 'away', 'tie']),
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

// ── DynamoDB record shape (read back from EspnGames table) ───────────────────
//
// A record is the union of all fields that may have been written by either
// a schedule_upsert or a game_final event. game_final-only fields are optional
// because a game may not yet have a final result.

export interface EspnGameRecord {
  pk: string;
  sk: string;
  gsi1pk: string;
  gsi1sk: string;
  game_id: string;
  competition_id: string;
  year: string;
  season_type: string;
  week: string;
  week_text: string;
  start_time: string;
  home_team_id: string;
  away_team_id: string;
  home: string;
  away: string;
  entity_type: string;
  source_event_type: 'schedule_upsert' | 'game_final';
  espn_updated_at: string;
  ingested_at: string;
  schedule_hash?: string;
  final_hash?: string;
  // schedule_upsert fields
  competition_type?: string;
  competition_type_slug?: string;
  neutral_site?: boolean;
  venue_id?: string | null;
  venue_full_name?: string | null;
  venue_city?: string | null;
  venue_state?: string | null;
  venue_country?: string | null;
  is_international?: boolean;
  // game_final fields
  home_score?: number;
  away_score?: number;
  status?: string;
  completed?: boolean;
  winner?: 'home' | 'away' | 'tie' | null;
}
