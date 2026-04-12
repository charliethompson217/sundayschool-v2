import { describe, expect, it } from 'vitest';

import {
  PlayoffGameInputSchema,
  PlayoffMetaInputSchema,
  PlayoffWeekBodySchema,
  RegularGameInputSchema,
  RegularMetaInputSchema,
  RegularWeekBodySchema,
} from './schedules';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const validRegularMeta = {
  is_published: false,
  submission_opens_at: '2024-09-04T12:00:00.000Z',
  submission_closes_at: '2024-09-06T17:00:00.000Z',
};

const validPlayoffMeta = {
  is_published: true,
  submission_opens_at: '2025-01-14T12:00:00.000Z',
  submission_closes_at: '2025-01-18T17:00:00.000Z',
  round_name: 'Divisional Round',
  allow_straight_bets: true,
  allow_parlay: true,
  parlay_leg_count: 2,
};

const validRegularGame = { game_id: '401547417', include_in_rank: true, include_in_file: true };
const validPlayoffGame = { game_id: '401547417', is_wagerable: true };

// ── RegularMetaInputSchema ────────────────────────────────────────────────────

describe('RegularMetaInputSchema', () => {
  it('accepts a valid regular meta', () => {
    expect(RegularMetaInputSchema.safeParse(validRegularMeta).success).toBe(true);
  });

  it('accepts null submission_opens_at', () => {
    const meta = { ...validRegularMeta, submission_opens_at: null };
    expect(RegularMetaInputSchema.safeParse(meta).success).toBe(true);
  });

  it('accepts optional notes field', () => {
    expect(RegularMetaInputSchema.safeParse({ ...validRegularMeta, notes: 'Week 7 is a bye-heavy week' }).success).toBe(
      true,
    );
  });

  it('accepts null notes', () => {
    expect(RegularMetaInputSchema.safeParse({ ...validRegularMeta, notes: null }).success).toBe(true);
  });

  it('rejects missing is_published', () => {
    const { is_published: _, ...rest } = validRegularMeta as typeof validRegularMeta & { is_published: boolean };
    expect(RegularMetaInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-boolean is_published', () => {
    expect(RegularMetaInputSchema.safeParse({ ...validRegularMeta, is_published: 'yes' }).success).toBe(false);
  });

  it('rejects invalid datetime format for submission_opens_at', () => {
    expect(RegularMetaInputSchema.safeParse({ ...validRegularMeta, submission_opens_at: 'not-a-date' }).success).toBe(
      false,
    );
  });
});

// ── PlayoffMetaInputSchema ────────────────────────────────────────────────────

describe('PlayoffMetaInputSchema', () => {
  it('accepts a valid playoff meta with all required fields', () => {
    expect(PlayoffMetaInputSchema.safeParse(validPlayoffMeta).success).toBe(true);
  });

  it('rejects missing round_name', () => {
    const { round_name: _, ...rest } = validPlayoffMeta;
    expect(PlayoffMetaInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty round_name', () => {
    expect(PlayoffMetaInputSchema.safeParse({ ...validPlayoffMeta, round_name: '' }).success).toBe(false);
  });

  it('rejects missing allow_straight_bets', () => {
    const { allow_straight_bets: _, ...rest } = validPlayoffMeta;
    expect(PlayoffMetaInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing allow_parlay', () => {
    const { allow_parlay: _, ...rest } = validPlayoffMeta;
    expect(PlayoffMetaInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects parlay_leg_count of zero', () => {
    expect(PlayoffMetaInputSchema.safeParse({ ...validPlayoffMeta, parlay_leg_count: 0 }).success).toBe(false);
  });

  it('rejects non-integer parlay_leg_count', () => {
    expect(PlayoffMetaInputSchema.safeParse({ ...validPlayoffMeta, parlay_leg_count: 2.5 }).success).toBe(false);
  });

  it('rejects missing parlay_leg_count', () => {
    const { parlay_leg_count: _, ...rest } = validPlayoffMeta;
    expect(PlayoffMetaInputSchema.safeParse(rest).success).toBe(false);
  });
});

// ── RegularGameInputSchema ────────────────────────────────────────────────────

describe('RegularGameInputSchema', () => {
  it('accepts a valid regular game', () => {
    expect(RegularGameInputSchema.safeParse(validRegularGame).success).toBe(true);
  });

  it('accepts optional null description and special_tag', () => {
    expect(
      RegularGameInputSchema.safeParse({ ...validRegularGame, description: null, special_tag: null }).success,
    ).toBe(true);
  });

  it('accepts string values for description and special_tag', () => {
    expect(
      RegularGameInputSchema.safeParse({ ...validRegularGame, description: 'SNF', special_tag: 'TNF' }).success,
    ).toBe(true);
  });

  it('rejects missing game_id', () => {
    const { game_id: _, ...rest } = validRegularGame;
    expect(RegularGameInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty game_id', () => {
    expect(RegularGameInputSchema.safeParse({ ...validRegularGame, game_id: '' }).success).toBe(false);
  });

  it('rejects missing include_in_rank', () => {
    const { include_in_rank: _, ...rest } = validRegularGame;
    expect(RegularGameInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing include_in_file', () => {
    const { include_in_file: _, ...rest } = validRegularGame;
    expect(RegularGameInputSchema.safeParse(rest).success).toBe(false);
  });
});

// ── PlayoffGameInputSchema ────────────────────────────────────────────────────

describe('PlayoffGameInputSchema', () => {
  it('accepts a valid playoff game', () => {
    expect(PlayoffGameInputSchema.safeParse(validPlayoffGame).success).toBe(true);
  });

  it('accepts is_wagerable = false', () => {
    expect(PlayoffGameInputSchema.safeParse({ ...validPlayoffGame, is_wagerable: false }).success).toBe(true);
  });

  it('rejects missing game_id', () => {
    const { game_id: _, ...rest } = validPlayoffGame;
    expect(PlayoffGameInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing is_wagerable', () => {
    const { is_wagerable: _, ...rest } = validPlayoffGame;
    expect(PlayoffGameInputSchema.safeParse(rest).success).toBe(false);
  });
});

// ── RegularWeekBodySchema ─────────────────────────────────────────────────────

describe('RegularWeekBodySchema', () => {
  it('accepts a valid body with games', () => {
    expect(RegularWeekBodySchema.safeParse({ meta: validRegularMeta, games: [validRegularGame] }).success).toBe(true);
  });

  it('accepts an empty games array', () => {
    expect(RegularWeekBodySchema.safeParse({ meta: validRegularMeta, games: [] }).success).toBe(true);
  });

  it('rejects missing meta', () => {
    expect(RegularWeekBodySchema.safeParse({ games: [validRegularGame] }).success).toBe(false);
  });

  it('rejects missing games array', () => {
    expect(RegularWeekBodySchema.safeParse({ meta: validRegularMeta }).success).toBe(false);
  });

  it('rejects invalid game in games array', () => {
    expect(RegularWeekBodySchema.safeParse({ meta: validRegularMeta, games: [{ game_id: '' }] }).success).toBe(false);
  });
});

// ── PlayoffWeekBodySchema ─────────────────────────────────────────────────────

describe('PlayoffWeekBodySchema', () => {
  it('accepts a valid playoff body', () => {
    expect(PlayoffWeekBodySchema.safeParse({ meta: validPlayoffMeta, games: [validPlayoffGame] }).success).toBe(true);
  });

  it('accepts an empty games array', () => {
    expect(PlayoffWeekBodySchema.safeParse({ meta: validPlayoffMeta, games: [] }).success).toBe(true);
  });

  it('rejects when playoff meta fields are missing', () => {
    expect(PlayoffWeekBodySchema.safeParse({ meta: validRegularMeta, games: [validPlayoffGame] }).success).toBe(false);
  });

  it('rejects a regular game in a playoff body', () => {
    expect(PlayoffWeekBodySchema.safeParse({ meta: validPlayoffMeta, games: [validRegularGame] }).success).toBe(false);
  });
});
