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

const { load, recordAttempt, save } = await import('../src/storage');

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
    expect(load()).toEqual({ unlockedLevel: 1, best: {}, attempts: 0, fails: {} });
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
    const data = { unlockedLevel: 3, best: { '1': 60_000 }, attempts: 9, fails: { 'tap-nothing': 4 } };
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
    const base = { unlockedLevel: MAX_LEVEL_ID, best: {}, attempts: 0, fails: {} };
    const next = recordAttempt(base, attempt({ levelId: MAX_LEVEL_ID }));
    expect(next.unlockedLevel).toBe(MAX_LEVEL_ID);
  });

  it('never lowers the unlock after replaying an early level', () => {
    const base = { unlockedLevel: 4, best: {}, attempts: 0, fails: {} };
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
    expect(base).toEqual({ unlockedLevel: 1, best: {}, attempts: 0, fails: {} });
  });
});
