import { describe, expect, it } from 'vitest';

import { EspnIngestBodySchema, GameFinalGameSchema, ScheduleUpsertGameSchema } from '../lib/espn-schemas';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const validScheduleGame = {
  game_id: '401547417',
  competition_id: '401547417',
  year: '2024',
  season_type: '2',
  week: '1',
  week_text: 'Week 1',
  start_time: '2024-09-06T00:20Z',
  home_team_id: '12',
  away_team_id: '1',
  home: 'KC',
  away: 'BAL',
  competition_type: 'Standard',
  competition_type_slug: 'standard',
  neutral_site: false,
  venue_id: '3622',
  venue_full_name: 'GEHA Field at Arrowhead Stadium',
  venue_city: 'Kansas City',
  venue_state: 'Missouri',
  venue_country: 'USA',
};

const validFinalGame = {
  game_id: '401547417',
  competition_id: '401547417',
  year: '2024',
  season_type: '2',
  week: '1',
  week_text: 'Week 1',
  start_time: '2024-09-06T00:20Z',
  home_team_id: '12',
  away_team_id: '1',
  home: 'KC',
  away: 'BAL',
  home_score: 27,
  away_score: 20,
  status: 'STATUS_FINAL',
  completed: true,
  winner: 'home' as const,
};

// ── ScheduleUpsertGameSchema ─────────────────────────────────────────────────

describe('ScheduleUpsertGameSchema', () => {
  it('accepts a valid schedule game', () => {
    const result = ScheduleUpsertGameSchema.safeParse(validScheduleGame);
    expect(result.success).toBe(true);
  });

  it('accepts nullable venue fields', () => {
    const game = { ...validScheduleGame, venue_id: null, venue_state: null };
    const result = ScheduleUpsertGameSchema.safeParse(game);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const rest: Partial<typeof validScheduleGame> = { ...validScheduleGame };
    delete rest.game_id;
    const result = ScheduleUpsertGameSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects extra/unknown keys (strict)', () => {
    const game = { ...validScheduleGame, bogus_field: 'nope' };
    const result = ScheduleUpsertGameSchema.safeParse(game);
    expect(result.success).toBe(false);
  });

  it('rejects empty game_id', () => {
    const game = { ...validScheduleGame, game_id: '' };
    const result = ScheduleUpsertGameSchema.safeParse(game);
    expect(result.success).toBe(false);
  });
});

// ── GameFinalGameSchema ──────────────────────────────────────────────────────

describe('GameFinalGameSchema', () => {
  it('accepts a valid final game', () => {
    const result = GameFinalGameSchema.safeParse(validFinalGame);
    expect(result.success).toBe(true);
  });

  it('accepts winner = tie', () => {
    const game = { ...validFinalGame, winner: 'tie' };
    const result = GameFinalGameSchema.safeParse(game);
    expect(result.success).toBe(true);
  });

  it('rejects completed = false', () => {
    const game = { ...validFinalGame, completed: false };
    const result = GameFinalGameSchema.safeParse(game);
    expect(result.success).toBe(false);
  });

  it('rejects invalid winner value', () => {
    const game = { ...validFinalGame, winner: 'draw' };
    const result = GameFinalGameSchema.safeParse(game);
    expect(result.success).toBe(false);
  });

  it('rejects null winner value', () => {
    const game = { ...validFinalGame, winner: null };
    const result = GameFinalGameSchema.safeParse(game);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer scores', () => {
    const game = { ...validFinalGame, home_score: 27.5 };
    const result = GameFinalGameSchema.safeParse(game);
    expect(result.success).toBe(false);
  });

  it('rejects extra/unknown keys (strict)', () => {
    const game = { ...validFinalGame, quarter: 4 };
    const result = GameFinalGameSchema.safeParse(game);
    expect(result.success).toBe(false);
  });
});

// ── EspnIngestBodySchema ─────────────────────────────────────────────────────

describe('EspnIngestBodySchema', () => {
  it('accepts a valid schedule_upsert body', () => {
    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-09-05T20:00:00Z',
      games: [validScheduleGame],
    };
    const result = EspnIngestBodySchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('accepts a valid game_final body', () => {
    const body = {
      type: 'game_final',
      sent_at: '2024-09-06T03:30:00Z',
      games: [validFinalGame],
    };
    const result = EspnIngestBodySchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it('rejects unknown event type', () => {
    const body = {
      type: 'halftime_update',
      sent_at: '2024-09-06T02:00:00Z',
      games: [],
    };
    const result = EspnIngestBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('rejects empty games array', () => {
    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-09-05T20:00:00Z',
      games: [],
    };
    const result = EspnIngestBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('rejects schedule_upsert with game_final game shape', () => {
    const body = {
      type: 'schedule_upsert',
      sent_at: '2024-09-05T20:00:00Z',
      games: [validFinalGame],
    };
    const result = EspnIngestBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('rejects game_final with schedule_upsert game shape', () => {
    const body = {
      type: 'game_final',
      sent_at: '2024-09-06T03:30:00Z',
      games: [validScheduleGame],
    };
    const result = EspnIngestBodySchema.safeParse(body);
    expect(result.success).toBe(false);
  });
});
