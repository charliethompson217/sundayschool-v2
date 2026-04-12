import { UserSchema, type User } from '@/types/users';
import {
  WeekDetailSchema,
  WeeksListResponseSchema,
  type WeekDetail,
  type WeekMeta,
  type WeekUpdateBody,
} from '@/types/schedules';
import type { PicksRecord } from '@/types/submissions';

import { authedFetch } from './authedFetch';

export async function getUsers(): Promise<User[]> {
  const res = await authedFetch('/admin/users');
  if (!res.ok) {
    throw new Error(`GET /admin/users failed: ${res.status}`);
  }
  const data = await res.json();
  return UserSchema.array().parse(data.users);
}

// ── Schedule API ──────────────────────────────────────────────────────────────

export async function getScheduleWeeks(filter?: { year?: string; seasonType?: string }): Promise<WeekMeta[]> {
  const params = new URLSearchParams();
  if (filter?.year) params.set('year', filter.year);
  if (filter?.seasonType) params.set('seasonType', filter.seasonType);
  const query = params.size ? `?${params}` : '';
  const res = await authedFetch(`/schedules${query}`);
  if (!res.ok) throw new Error(`GET /schedules failed: ${res.status}`);
  return WeeksListResponseSchema.parse(await res.json()).weeks;
}

export async function getScheduleWeekDetail(year: string, seasonType: string, week: string): Promise<WeekDetail> {
  const res = await authedFetch(`/schedules/${year}/${seasonType}/${week}`);
  if (!res.ok) throw new Error(`GET /schedules/${year}/${seasonType}/${week} failed: ${res.status}`);
  return WeekDetailSchema.parse(await res.json());
}

export async function createScheduleWeek(
  year: string,
  seasonType: string,
  week: string,
  body: WeekUpdateBody,
): Promise<WeekDetail> {
  const res = await authedFetch(`/admin/schedules/${year}/${seasonType}/${week}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Create schedule failed: ${res.status}`);
  }
  return WeekDetailSchema.parse(await res.json());
}

// ── Picks API ─────────────────────────────────────────────────────────────────

/** Fetch every user's picks for a specific week. Admin only. */
export async function getAdminWeekSubmissions(
  year: string,
  seasonType: string,
  week: string,
): Promise<Record<string, PicksRecord>> {
  const res = await authedFetch(`/admin/submissions/${year}/${seasonType}/${week}`);
  if (!res.ok) throw new Error(`GET /admin/submissions failed: ${res.status}`);
  const data = (await res.json()) as { submissions: Record<string, PicksRecord> };
  return data.submissions;
}

export async function updateScheduleWeek(
  year: string,
  seasonType: string,
  week: string,
  body: WeekUpdateBody,
): Promise<WeekDetail> {
  const res = await authedFetch(`/admin/schedules/${year}/${seasonType}/${week}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Update schedule failed: ${res.status}`);
  }
  return WeekDetailSchema.parse(await res.json());
}
