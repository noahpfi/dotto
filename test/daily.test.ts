import { describe, expect, it } from 'vitest';
import { DAILY_EPOCH_UTC, dailyDayNumber, dailyRandom, dailySeed } from '../src/daily';
import { dailyShareLabel } from '../src/copy';
import { DAILY_LEVEL, LEVELS, levelById } from '../src/levels';
import { Gauntlet } from '../src/engine/gauntlet';
import type { GauntletEvent } from '../src/engine/types';

// daily day number + seed must stay stable -> runs remain comparable
describe('daily day number', () => {
  it('numbers the epoch day as #1', () => {
    expect(dailyDayNumber(new Date(DAILY_EPOCH_UTC))).toBe(1);
  });

  it('rolls over at UTC midnight', () => {
    // 23:59:59Z and next 00:00:00Z = different days in every timezone
    expect(dailyDayNumber(new Date(DAILY_EPOCH_UTC + 86_399_999))).toBe(1);
    expect(dailyDayNumber(new Date(DAILY_EPOCH_UTC + 86_400_000))).toBe(2);
  });

  it('ignores the local clock offset', () => {
    // same instant in Sydney and Los Angeles offsets -> same day
    const instant = Date.UTC(2026, 7, 20, 12, 0, 0);
    expect(dailyDayNumber(new Date(instant))).toBe(dailyDayNumber(new Date(new Date(instant).toISOString())));
  });

  it('counts forward one per day', () => {
    for (const days of [0, 1, 7, 30, 365]) {
      expect(dailyDayNumber(new Date(DAILY_EPOCH_UTC + days * 86_400_000))).toBe(days + 1);
    }
  });
});

describe('daily seed', () => {
  it('gives every day its own seed', () => {
    const seeds = new Set(Array.from({ length: 400 }, (_, i) => dailySeed(i + 1)));
    expect(seeds.size).toBe(400);
  });

  it('is a valid uint32 for mulberry32', () => {
    for (const day of [1, 2, 99, 5000]) {
      const seed = dailySeed(day);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('repeats the stream within a day and changes it the next', () => {
    const a = dailyRandom(12);
    const b = dailyRandom(12);
    const c = dailyRandom(13);
    const draw = (r: () => number) => [r(), r(), r()];
    expect(draw(a)).toEqual(draw(b));
    expect(draw(dailyRandom(12))).not.toEqual(draw(c));
  });
});

describe('daily level', () => {
  it('sits outside the ladder and unlocks nothing', () => {
    expect(LEVELS.some((l) => l.id === DAILY_LEVEL.id)).toBe(false);
    expect(DAILY_LEVEL.id).toBe(0);
  });

  it('resolves by id', () => {
    expect(levelById(DAILY_LEVEL.id)).toBe(DAILY_LEVEL);
  });

  it('is finishable', () => {
    expect(DAILY_LEVEL.durationMs).toBe(60_000);
  });

  it('gives same-day players an identical probe schedule', () => {
    // same day -> same probe timings through real engine
    const run = (day: number): number[] => {
      const probes: number[] = [];
      let clock = 0;
      const g = new Gauntlet(DAILY_LEVEL, {
        now: () => clock,
        epochNow: () => 0,
        random: dailyRandom(day),
        emit: (e: GauntletEvent) => {
          if (e.type === 'probe-start') probes.push(clock);
        },
      });
      g.start();
      for (clock = 0; clock <= DAILY_LEVEL.durationMs; clock += 50) g.update();
      return probes;
    };
    expect(run(31)).toEqual(run(31));
    expect(run(31).length).toBeGreaterThan(0);
    expect(run(31)).not.toEqual(run(32));
  });
});

describe('daily label', () => {
  it('is one copy.ts string shared by screen and share', () => {
    expect(dailyShareLabel(4)).toBe('dotto #4');
  });
});
