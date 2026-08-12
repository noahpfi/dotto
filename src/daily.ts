import { mulberry32 } from './engine/rng';

// same dot for everyone, UTC-date seeded -> compare without identity or server

// moving it renumbers every already-shared day
export const DAILY_EPOCH_UTC = Date.UTC(2026, 7, 9);

// one UTC day -> daily rolls over worldwide at same instant
const DAY_MS = 86_400_000;

// UTC -> every timezone shares same day number
export function dailyDayNumber(now: Date = new Date()): number {
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((utcMidnight - DAILY_EPOCH_UTC) / DAY_MS) + 1;
}

// Knuth constant -> consecutive days get distinct mulberry32 probe schedules
export function dailySeed(dayNumber: number): number {
  return Math.imul(dayNumber, 2654435761) >>> 0;
}

export function dailyRandom(dayNumber: number): () => number {
  return mulberry32(dailySeed(dayNumber));
}
