import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.stubGlobal('sessionStorage', store);

const { PREDICTION_CHOICES, getPrediction, setPrediction } = await import('../src/prediction');

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});

describe('prediction', () => {
  it('is absent until answered and round-trips after', () => {
    expect(getPrediction()).toBeNull();
    setPrediction(300_000);
    expect(getPrediction()).toBe(300_000);
  });

  it('drops a stored value that is not a usable duration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const bad of ['abc', '', '0', '-5', 'NaN']) {
      store.setItem('dotto.prediction', bad);
      expect(getPrediction()).toBeNull();
    }
    expect(warn).toHaveBeenCalled();
  });

  it('offers ascending choices spanning the whole ladder', () => {
    expect(PREDICTION_CHOICES.length).toBeGreaterThanOrEqual(4);
    const values = PREDICTION_CHOICES.map((c) => c.ms);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(Math.min(...values)).toBeLessThanOrEqual(60_000);
    expect(Math.max(...values)).toBeGreaterThanOrEqual(600_000);
  });
});

describe('prediction run length', () => {
  it('maps every choice to a level at least that long', async () => {
    const { levelForPrediction } = await import('../src/levels');
    for (const choice of PREDICTION_CHOICES) {
      const level = levelForPrediction(choice.ms);
      expect(level.durationMs).toBeGreaterThanOrEqual(choice.ms);
    }
  });

  it('maps each choice to a level without rounding up', async () => {
    const { LEVELS, levelForPrediction } = await import('../src/levels');
    // levels above shortest rung must be exact rungs
    for (const choice of PREDICTION_CHOICES) {
      if (choice.ms <= LEVELS[0]!.durationMs) continue;
      expect(levelForPrediction(choice.ms).durationMs).toBe(choice.ms);
    }
  });

  it('caps at the longest level beyond the ladder', async () => {
    const { LEVELS, levelForPrediction } = await import('../src/levels');
    const longest = LEVELS[LEVELS.length - 1]!;
    expect(levelForPrediction(99_000_000).id).toBe(longest.id);
  });

  it('never shortens the chosen level', async () => {
    const { LEVELS, levelForPrediction, longerLevel } = await import('../src/levels');
    const chosen = LEVELS[3]!; // 10 minutes
    expect(longerLevel(chosen, levelForPrediction(30_000)).id).toBe(chosen.id);
    expect(longerLevel(chosen, levelForPrediction(1_200_000)).id).toBe(LEVELS[4]!.id);
  });
});

describe('predictionVerdict', () => {
  it('states both numbers and nothing about the player', async () => {
    const { predictionVerdict } = await import('../src/copy');
    const line = predictionVerdict(300_000, 12_000, false);
    expect(line).toContain('5:00');
    expect(line).toContain('12s');
    expect(line).not.toMatch(/attention|focus|healthy|normal|poor/i);
  });

  it('uses present tense for the predicted run', async () => {
    const { predictionVerdict } = await import('../src/copy');
    expect(predictionVerdict(300_000, 12_000, false)).toMatch(/^You said 5:00\./);
  });

  it('uses past tense for later runs', async () => {
    const { predictionVerdict } = await import('../src/copy');
    expect(predictionVerdict(300_000, 12_000, true)).toMatch(/^In the beginning you said 5:00\./);
  });
});
