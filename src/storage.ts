import type { AttemptResult, FailReason } from './engine/types';
import { MAX_LEVEL_ID } from './levels';

const KEY = 'dotto.v1';

export interface SaveData {
  unlockedLevel: number;
  // levelId -> longest survivedMs on that level
  best: Record<string, number>;
  attempts: number;
  fails: Record<string, number>;
  // daily day number -> longest survivedMs, keyed by number to match shared #12
  dailyBest: Record<string, number>;
}

function defaults(): SaveData {
  return { unlockedLevel: 1, best: {}, attempts: 0, fails: {}, dailyBest: {} };
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === 'number' && Number.isFinite(v));
}

function parse(raw: string): SaveData | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<SaveData>;
  if (typeof v.unlockedLevel !== 'number' || !Number.isFinite(v.unlockedLevel)) return null;
  if (typeof v.attempts !== 'number' || !Number.isFinite(v.attempts)) return null;
  if (!isNumberRecord(v.best) || !isNumberRecord(v.fails)) return null;
  return {
    unlockedLevel: Math.min(Math.max(1, Math.trunc(v.unlockedLevel)), MAX_LEVEL_ID),
    best: v.best,
    attempts: Math.max(0, Math.trunc(v.attempts)),
    fails: v.fails,
    // missing in older saves
    dailyBest: isNumberRecord(v.dailyBest) ? v.dailyBest : {},
  };
}

// reports and replaces corrupt or foreign data
export function load(): SaveData {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (err) {
    console.warn('dotto: localStorage unavailable, progress will not persist —', err);
    return defaults();
  }
  if (raw === null) return defaults();
  const parsed = parse(raw);
  if (parsed === null) {
    console.warn('dotto: save data was unreadable and has been reset');
    return defaults();
  }
  return parsed;
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('dotto: could not write save —', err);
  }
}

// pure apart from write
export function recordAttempt(
  data: SaveData,
  result: AttemptResult,
  dailyDay: number | null = null,
): SaveData {
  const key = String(result.levelId);
  const next: SaveData = {
    unlockedLevel: data.unlockedLevel,
    best: { ...data.best },
    fails: { ...data.fails },
    attempts: data.attempts + 1,
    dailyBest: { ...data.dailyBest },
  };

  const previousBest = next.best[key] ?? 0;
  if (result.survivedMs > previousBest) next.best[key] = result.survivedMs;

  if (dailyDay !== null) {
    const dayKey = String(dailyDay);
    const previousDay = next.dailyBest[dayKey] ?? -1;
    if (result.survivedMs > previousDay) next.dailyBest[dayKey] = result.survivedMs;
  }

  if (result.passed) {
    next.unlockedLevel = Math.min(Math.max(next.unlockedLevel, result.levelId + 1), MAX_LEVEL_ID);
  } else if (result.reason !== null) {
    const reason: FailReason = result.reason;
    next.fails[reason] = (next.fails[reason] ?? 0) + 1;
  }

  save(next);
  return next;
}

// -1 sentinel lets 0ms count
export function playedDaily(data: SaveData, dayNumber: number): boolean {
  return data.dailyBest[String(dayNumber)] !== undefined;
}

// consecutive played days ending today, or yesterday if today unplayed
export function dailyStreak(data: SaveData, dayNumber: number): number {
  let day = playedDaily(data, dayNumber) ? dayNumber : dayNumber - 1;
  let streak = 0;
  while (day > 0 && playedDaily(data, day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}
