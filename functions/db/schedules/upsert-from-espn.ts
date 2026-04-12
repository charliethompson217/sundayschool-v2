import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

import { buildWeekPk, getDocClient } from '../client';
import { buildScheduleGameSk, buildScheduleGsi1pk, buildScheduleGsi1sk } from './schedules';
import type { ScheduleUpsertGame } from '@/types/espn';
import type { ScheduleGameRecord, WeekMetaRecord } from '@/types/schedules';

// ── Date helpers ──────────────────────────────────────────────────────────────

interface EasternDateParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  weekday: string; // 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
  hour: number; // 0–23
}

function getEasternDateParts(startTime: string): EasternDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(startTime));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    weekday: get('weekday'),
    hour: parseInt(get('hour')) % 24, // guard against midnight === 24 in some envs
  };
}

function isThanksgiving(year: number, month: number, day: number): boolean {
  if (month !== 11) return false;
  const nov1DayOfWeek = new Date(year, 10, 1).getDay(); // 0 = Sun … 6 = Sat
  const firstThursday = 1 + ((4 - nov1DayOfWeek + 7) % 7);
  return day === firstThursday + 21; // 4th Thursday
}

function isChristmas(month: number, day: number): boolean {
  return month === 12 && day === 25;
}

// ── Game flag helpers ─────────────────────────────────────────────────────────

function isInternational(game: ScheduleUpsertGame): boolean {
  return game.venue_country != null && game.venue_country !== 'USA';
}

export function getDayOfWeek(startTime: string): string {
  return getEasternDateParts(startTime).weekday; // 'Sun' | 'Mon' | …
}

// File games: Monday Night Football, or any domestic holiday game.
// Rank games and file games are mutually exclusive — file takes priority.
export function deriveIncludeInFile(game: ScheduleUpsertGame): boolean {
  if (isInternational(game)) return false;
  const { weekday } = getEasternDateParts(game.start_time);
  return weekday === 'Mon' || deriveSpecialTag(game) !== null;
}

export function deriveIncludeInRank(game: ScheduleUpsertGame): boolean {
  if (isInternational(game) || deriveIncludeInFile(game)) return false;
  const { weekday, hour } = getEasternDateParts(game.start_time);
  return weekday === 'Sun' && hour >= 13;
}

export function deriveSubmissionClosesAt(kind: 'regular' | 'playoff', sorted: ScheduleUpsertGame[]): string {
  if (kind === 'playoff') return sorted[0].start_time;
  return sorted.find((g) => deriveIncludeInRank(g) || deriveIncludeInFile(g))?.start_time ?? sorted[0].start_time;
}

export function deriveSpecialTag(game: ScheduleUpsertGame): string | null {
  const { year, month, day } = getEasternDateParts(game.start_time);
  if (isChristmas(month, day)) return 'christmas';
  if (isThanksgiving(year, month, day)) return 'thanksgiving';
  return null;
}

// ── Auto-populate schedule entries from an ESPN schedule_upsert event ─────────
//
// Business rules:
//   • META: only written when the record does not yet exist (is_published stays
//     untouched once set; submission windows, notes, playoff config etc. are
//     never overwritten).
//   • GAME: same conditional-put strategy — once an admin has touched a game
//     record it is left alone.
//
// Future: when odds support is added, odds fields will be treated as
//   immutable once is_published = true on the parent META record.

export async function upsertScheduleFromEspn(tableName: string, games: ScheduleUpsertGame[]): Promise<void> {
  if (games.length === 0) return;

  const sorted = [...games].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const first = sorted[0];

  const { year, season_type: seasonType, week, week_text: weekText } = first;
  const pk = buildWeekPk(year, seasonType, week);
  const kind = seasonType === '3' ? ('playoff' as const) : ('regular' as const);

  const firstCountedKickoff = deriveSubmissionClosesAt(kind, sorted);

  const metaBase: WeekMetaRecord = {
    pk,
    sk: 'META',
    gsi1pk: buildScheduleGsi1pk(year, seasonType),
    gsi1sk: buildScheduleGsi1sk(week),
    year,
    season_type: seasonType,
    week,
    kind,
    is_published: false,
    submission_opens_at: null,
    submission_closes_at: firstCountedKickoff,
    notes: null,
  };

  if (kind === 'playoff') {
    metaBase.round_name = weekText;
    metaBase.allow_straight_bets = weekText !== 'Pro Bowl';
    metaBase.allow_parlay = weekText === 'Wild Card' || weekText === 'Divisional';
    metaBase.parlay_leg_count = 4;
  }

  try {
    await getDocClient().send(
      new PutCommand({
        TableName: tableName,
        Item: metaBase,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      }),
    );
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
    // META already exists — all admin config preserved as-is
  }

  for (const game of sorted) {
    const gameBase: ScheduleGameRecord = {
      pk,
      sk: buildScheduleGameSk(game.game_id),
      year,
      season_type: seasonType,
      week,
      game_id: game.game_id,
    };

    if (kind === 'regular') {
      gameBase.include_in_rank = deriveIncludeInRank(game);
      gameBase.include_in_file = deriveIncludeInFile(game);
      gameBase.description = null;
      gameBase.special_tag = deriveSpecialTag(game);
    } else {
      gameBase.is_wagerable = !isInternational(game);
    }

    try {
      await getDocClient().send(
        new PutCommand({
          TableName: tableName,
          Item: gameBase,
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        }),
      );
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
      // Game already configured — leave it as-is
    }
  }
}
