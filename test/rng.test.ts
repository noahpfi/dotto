import { describe, expect, it } from 'vitest';
import { mulberry32, randomIntBetween } from '../src/engine/rng';

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const values = Array.from({ length: 500 }, () => a());
    expect(values).toEqual(Array.from({ length: 500 }, () => b()));
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('randomIntBetween', () => {
  it('covers both endpoints inclusively', () => {
    expect(randomIntBetween(() => 0, 5, 9)).toBe(5);
    expect(randomIntBetween(() => 0.9999999, 5, 9)).toBe(9);
  });

  it('stays inside the range across the whole stream', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const v = randomIntBetween(rng, 4000, 9000);
      expect(v).toBeGreaterThanOrEqual(4000);
      expect(v).toBeLessThanOrEqual(9000);
    }
  });

  it('throws on an inverted range', () => {
    expect(() => randomIntBetween(() => 0, 9, 5)).toThrow(RangeError);
    expect(() => randomIntBetween(() => 0, Number.NaN, 5)).toThrow(RangeError);
  });
});
