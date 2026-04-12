import type { WeekMeta } from '@/types/schedules';

export function isWeekClosed(meta: WeekMeta): boolean {
  return meta.submission_closes_at !== null && new Date(meta.submission_closes_at) <= new Date();
}

export function formatKickoff(closesAt: string): string {
  return new Date(closesAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}
