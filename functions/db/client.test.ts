import { describe, expect, it } from 'vitest';

import { buildWeekPk } from './client';

describe('buildWeekPk', () => {
  it('formats correctly', () => {
    expect(buildWeekPk('2024', '2', '1')).toBe('SEASON#2024#TYPE#2#WEEK#1');
  });

  it('handles postseason type and week', () => {
    expect(buildWeekPk('2024', '3', '4')).toBe('SEASON#2024#TYPE#3#WEEK#4');
  });
});
