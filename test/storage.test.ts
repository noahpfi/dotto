import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttemptResult } from '../src/engine/types';
import { MAX_LEVEL_ID } from '../src/levels';

// in-memory Storage -> tests run under node without jsdom
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const store = new MemoryStorage();
vi.stubGlobal('localStorage', store);

const { dailyStreak, load, playedDaily, recordAttempt, save } = await import('../src/storage');

function attempt(overrides: Partial<AttemptResult> = {}): AttemptResult {
  return {
    levelId: 1,
    passed: true,
    survivedMs: 60_000,
    targetMs: 60_000,
    reason: null,
    probesShown: 2,
    probesHit: 2,
    endedAt: 1_700_000_000_000,
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe('load', () => {
  it('returns defaults on a cold start', () => {
    expect(load()).toEqual({ unlockedLevel: 1, best: {}, attempts: 0, fails: {}, dailyBest: {} });
  });

  it('reports and resets unreadable data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.setItem('dotto.v1', '{not json');
    expect(load().unlockedLevel).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('rejects a save with correct keys but wrong types', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store.setItem('dotto.v1', JSON.stringify({ unlockedLevel: '3', best: {}, attempts: 0, fails: {} }));
    expect(load().unlockedLevel).toBe(1);
  });

  it('clamps an out-of-range unlockedLevel', () => {
    store.setItem('dotto.v1', JSON.stringify({ unlockedLevel: 999, best: {}, attempts: 4, fails: {} }));
    expect(load().unlockedLevel).toBe(MAX_LEVEL_ID);
    store.setItem('dotto.v1', JSON.stringify({ unlockedLevel: -5, best: {}, attempts: 4, fails: {} }));
    expect(load().unlockedLevel).toBe(1);
  });

  it('round-trips a valid save', () => {
    const data = {
      unlockedLevel: 3,
      best: { '1': 60_000 },
      attempts: 9,
      fails: { 'tap-nothing': 4 },
      dailyBest: { '3': 42_000 },
    };
    save(data);
    expect(load()).toEqual(data);
  });
});

describe('recordAttempt', () => {
  it('unlocks the next level on a pass and persists it', () => {
    const next = recordAttempt(load(), attempt());
    expect(next.unlockedLevel).toBe(2);
    expect(next.best['1']).toBe(60_000);
    expect(next.attempts).toBe(1);
    expect(load()).toEqual(next);
  });

  it('never unlocks past the last level', () => {
    const base = { unlockedLevel: MAX_LEVEL_ID, best: {}, attempts: 0, fails: {}, dailyBest: {} };
    const next = recordAttempt(base, attempt({ levelId: MAX_LEVEL_ID }));
    expect(next.unlockedLevel).toBe(MAX_LEVEL_ID);
  });

  it('never lowers the unlock after replaying an early level', () => {
    const base = { unlockedLevel: 4, best: {}, attempts: 0, fails: {}, dailyBest: {} };
    expect(recordAttempt(base, attempt({ levelId: 1 })).unlockedLevel).toBe(4);
  });

  it('keeps the longest survival', () => {
    let data = recordAttempt(load(), attempt({ passed: false, reason: 'quit', survivedMs: 40_000 }));
    data = recordAttempt(data, attempt({ passed: false, reason: 'quit', survivedMs: 12_000 }));
    expect(data.best['1']).toBe(40_000);
  });

  it('tallies fail reasons and leaves the unlock alone', () => {
    let data = recordAttempt(load(), attempt({ passed: false, reason: 'missed-probe', survivedMs: 8000 }));
    data = recordAttempt(data, attempt({ passed: false, reason: 'missed-probe', survivedMs: 9000 }));
    data = recordAttempt(data, attempt({ passed: false, reason: 'left-screen', survivedMs: 3000 }));
    expect(data.fails).toEqual({ 'missed-probe': 2, 'left-screen': 1 });
    expect(data.unlockedLevel).toBe(1);
    expect(data.attempts).toBe(3);
  });

  it('does not mutate the save it was given', () => {
    const base = load();
    recordAttempt(base, attempt());
    expect(base).toEqual({ unlockedLevel: 1, best: {}, attempts: 0, fails: {}, dailyBest: {} });
  });
});

// streak off-by-one misreports habit metric
describe('daily results', () => {
  it('records a daily run under its day and a ladder run under none', () => {
    const withDaily = recordAttempt(load(), attempt({ levelId: 0, survivedMs: 42_000 }), 7);
    expect(withDaily.dailyBest['7']).toBe(42_000);
    const ladder = recordAttempt(withDaily, attempt({ levelId: 1 }));
    expect(Object.keys(ladder.dailyBest)).toEqual(['7']);
  });

  it('keeps the best of the day', () => {
    let data = recordAttempt(load(), attempt({ levelId: 0, survivedMs: 40_000 }), 3);
    data = recordAttempt(data, attempt({ levelId: 0, survivedMs: 12_000 }), 3);
    expect(data.dailyBest['3']).toBe(40_000);
  });

  it('counts a 0ms daily as played', () => {
    const data = recordAttempt(load(), attempt({ levelId: 0, survivedMs: 0 }), 5);
    expect(playedDaily(data, 5)).toBe(true);
    expect(playedDaily(data, 4)).toBe(false);
  });

  it('never lets a daily pass inflate the ladder unlock', () => {
    const data = recordAttempt(load(), attempt({ levelId: 0, passed: true }), 2);
    expect(data.unlockedLevel).toBe(1);
  });

  it('loads a save written before the daily existed', () => {
    // missing fields must not wipe ladder progress
    store.setItem(
      'dotto.v1',
      JSON.stringify({ unlockedLevel: 4, best: { '1': 60_000 }, attempts: 12, fails: {} }),
    );
    const loaded = load();
    expect(loaded.unlockedLevel).toBe(4);
    expect(loaded.dailyBest).toEqual({});
  });

  it('ignores a corrupt dailyBest and keeps the rest', () => {
    store.setItem(
      'dotto.v1',
      JSON.stringify({ unlockedLevel: 3, best: {}, attempts: 1, fails: {}, dailyBest: 'nope' }),
    );
    expect(load().unlockedLevel).toBe(3);
    expect(load().dailyBest).toEqual({});
  });
});

describe('dailyStreak', () => {
  const withDays = (days: number[]) => ({
    unlockedLevel: 1,
    best: {},
    attempts: days.length,
    fails: {},
    dailyBest: Object.fromEntries(days.map((d) => [String(d), 30_000])),
  });

  it('counts consecutive days ending today', () => {
    expect(dailyStreak(withDays([8, 9, 10]), 10)).toBe(3);
  });

  it('counts back from yesterday when today is not played yet', () => {
    // yesterday's play keeps streak alive until today ends
    expect(dailyStreak(withDays([8, 9, 10]), 11)).toBe(3);
  });

  it('breaks on a missed day', () => {
    expect(dailyStreak(withDays([5, 6, 8, 9, 10]), 10)).toBe(3);
  });

  it('is zero with nothing played or two missed days', () => {
    expect(dailyStreak(withDays([]), 10)).toBe(0);
    expect(dailyStreak(withDays([8]), 10)).toBe(0);
  });

  it('does not walk past day one', () => {
    expect(dailyStreak(withDays([1, 2]), 2)).toBe(2);
  });
});
