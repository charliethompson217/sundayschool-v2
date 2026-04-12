import type { RegularSeasonGameResults } from '@/types/results';

// TODO: replace with real backend call
export async function getGameResults(): Promise<Record<number, RegularSeasonGameResults>> {
  return {};
}

// TODO: replace with real backend call
export async function getPlayOffsBucks(_year: number): Promise<number> {
  return 1000;
}
