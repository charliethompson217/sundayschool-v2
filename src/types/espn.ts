import { z } from 'zod';

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
  winner: z.enum(['home', 'away']).nullable().optional(),
});

export type EspnGameRecord = z.infer<typeof EspnGameRecordSchema>;

export const EspnGamesListResponseSchema = z.object({
  games: z.array(EspnGameRecordSchema),
  count: z.number(),
});

export const EspnGameResponseSchema = z.object({
  game: EspnGameRecordSchema,
});
