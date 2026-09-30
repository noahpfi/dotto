import { describe, expect, it } from 'vitest';
import {
  BENCHMARKS,
  DWELL_MEAN_MS,
  DWELL_MEDIAN_MS,
  DWELL_MU,
  DWELL_SIGMA,
  benchmarkAhead,
  benchmarkCleared,
  dwellDensity,
  dwellPercentile,
} from '../src/benchmarks';
import { MIN_SAMPLE, playerBand, type LevelStats } from '../src/stats';

describe('benchmarks', () => {
  it('every entry carries an attributable source', () => {
    expect(BENCHMARKS.length).toBeGreaterThan(0);
    for (const b of BENCHMARKS) {
      expect(b.source.trim().length).toBeGreaterThan(0);
      expect(b.ms).toBeGreaterThan(0);
    }
  });

  it('finds the highest benchmark cleared and the next one ahead', () => {
    expect(benchmarkCleared(10_000)).toBeNull();
    expect(benchmarkCleared(60_000)?.ms).toBe(47_000);
    expect(benchmarkCleared(200_000)?.ms).toBe(150_000);

    expect(benchmarkAhead(10_000)?.ms).toBe(47_000);
    expect(benchmarkAhead(60_000)?.ms).toBe(75_000);
    expect(benchmarkAhead(200_000)).toBeNull();
  });
});

describe('modelled dwell distribution', () => {
  it('reproduces the published median and mean', () => {
    // median = e^mu
    expect(Math.exp(DWELL_MU) * 1000).toBeCloseTo(DWELL_MEDIAN_MS, 5);
    // lognormal mean = exp of mu + sigma^2 / 2
    expect(Math.exp(DWELL_MU + (DWELL_SIGMA * DWELL_SIGMA) / 2) * 1000).toBeCloseTo(DWELL_MEAN_MS, 5);
  });

  it('puts exactly half the population under the published median', () => {
    expect(dwellPercentile(DWELL_MEDIAN_MS)).toBe(50);
  });

  it('puts the mean above the median', () => {
    expect(dwellPercentile(DWELL_MEAN_MS)).toBeGreaterThan(50);
    expect(DWELL_MEAN_MS).toBeGreaterThan(DWELL_MEDIAN_MS);
  });

  it('is a positive single-peaked density with zero mass at or below zero', () => {
    expect(dwellDensity(0)).toBe(0);
    expect(dwellDensity(-5)).toBe(0);
    const mode = Math.exp(DWELL_MU - DWELL_SIGMA * DWELL_SIGMA);
    expect(dwellDensity(mode)).toBeGreaterThan(dwellDensity(mode / 4));
    expect(dwellDensity(mode)).toBeGreaterThan(dwellDensity(mode * 4));
  });

  it('rises monotonically with the result and saturates at the extremes', () => {
    expect(dwellPercentile(5000)).toBeLessThan(dwellPercentile(40_000));
    expect(dwellPercentile(40_000)).toBeLessThan(dwellPercentile(300_000));
    expect(dwellPercentile(0)).toBe(0);
    expect(dwellPercentile(1_200_000)).toBe(100);
  });
});

describe('player stats', () => {
  const stats: LevelStats = {
    levelId: 1,
    sampleSize: 100,
    buckets: [
      { upToMs: 10_000, count: 40 },
      { upToMs: 30_000, count: 30 },
      { upToMs: 60_000, count: 30 },
    ],
  };

  it('derives a p10–p90 band with the median inside it', () => {
    const band = playerBand(stats);
    expect(band).not.toBeNull();
    expect(band!.lowMs).toBeLessThan(band!.highMs);
    expect(band!.medianMs).toBeGreaterThanOrEqual(band!.lowMs);
    expect(band!.medianMs).toBeLessThanOrEqual(band!.highMs);
  });

  it('refuses stats from too small a sample', () => {
    expect(MIN_SAMPLE).toBeGreaterThanOrEqual(30);
    const thin: LevelStats = {
      levelId: 1,
      sampleSize: 12,
      buckets: [
        { upToMs: 10_000, count: 6 },
        { upToMs: 60_000, count: 6 },
      ],
    };
    expect(playerBand(thin)).toBeNull();
  });
});
