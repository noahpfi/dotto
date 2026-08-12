import { describe, expect, it } from 'vitest';
import {
  beatsDare,
  buildDareUrl,
  nextDare,
  parseDare,
  type DareChallenge,
  type DarePreview,
  DARE_PATH,
} from '../src/dare';
import { DAILY_LEVEL_ID, MAX_LEVEL_ID } from '../src/levels';

const challenge = (over: Partial<DareChallenge> = {}): DareChallenge => ({
  targetMs: 47_000,
  levelId: 1,
  chain: 1,
  dayNumber: null,
  ...over,
});

// dare link holds entire loop state -> parse errors fake or drop challenges
describe('parseDare', () => {
  it('reads a complete link', () => {
    expect(parseDare('?d=47000&l=1&n=3')).toEqual({
      targetMs: 47_000,
      levelId: 1,
      chain: 3,
      dayNumber: null,
    });
  });

  it('reads a daily dare with its day', () => {
    expect(parseDare('?d=61000&l=0&n=1&day=4')).toEqual({
      targetMs: 61_000,
      levelId: DAILY_LEVEL_ID,
      chain: 1,
      dayNumber: 4,
    });
  });

  it('defaults a missing chain to the first hop', () => {
    expect(parseDare('?d=1000&l=1')?.chain).toBe(1);
  });

  it('returns null without a dare', () => {
    for (const search of ['', '?', '?utm_source=ig', '?l=1&n=1']) {
      expect(parseDare(search)).toBeNull();
    }
  });

  it('rejects a missing, negative, fractional or absurd target', () => {
    for (const search of ['?d=&l=1', '?d=-1&l=1', '?d=1.5&l=1', '?d=99999999&l=1', '?d=abc&l=1']) {
      expect(parseDare(search)).toBeNull();
    }
  });

  it('rejects a partly-numeric target', () => {
    // parseInt() accepts 12000abc as 12000
    expect(parseDare('?d=12000abc&l=1')).toBeNull();
  });

  it('rejects an unknown level', () => {
    for (const search of [`?d=1000&l=${MAX_LEVEL_ID + 1}`, '?d=1000&l=-1', '?d=1000&l=2.5']) {
      expect(parseDare(search)).toBeNull();
    }
    expect(parseDare('?d=1000&l=0')).not.toBeNull();
  });

  it('clamps a hand-edited chain', () => {
    expect(parseDare('?d=1000&l=1&n=100000')?.chain).toBe(99);
    expect(parseDare('?d=1000&l=1&n=0')?.chain).toBe(1);
    expect(parseDare('?d=1000&l=1&n=-4')?.chain).toBe(1);
  });

  it('ignores a nonsensical day and keeps the dare', () => {
    expect(parseDare('?d=1000&l=0&day=0')?.dayNumber).toBeNull();
    expect(parseDare('?d=1000&l=0&day=x')?.dayNumber).toBeNull();
  });
});

const preview: DarePreview = { direction: 'open' };

describe('buildDareUrl', () => {
  it('round-trips through parseDare', () => {
    const dare = challenge({ targetMs: 123_456, levelId: 3, chain: 7 });
    const url = new URL(buildDareUrl('https://trydotto.live', dare, preview));
    expect(parseDare(url.search)).toEqual(dare);
  });

  it('round-trips a daily dare including its day', () => {
    const dare = challenge({ levelId: DAILY_LEVEL_ID, dayNumber: 12, chain: 2 });
    const url = new URL(buildDareUrl('https://trydotto.live/', dare, preview));
    expect(parseDare(url.search)).toEqual(dare);
  });

  it('always uses the dare path regardless of share base', () => {
    // path fixed to one Vercel rewrites
    for (const base of ['https://trydotto.live', 'https://trydotto.live/', 'https://trydotto.live/play']) {
      const url = new URL(buildDareUrl(base, challenge(), preview));
      expect(url.pathname, base).toBe(DARE_PATH);
      expect(url.searchParams.get('d')).toBe('47000');
    }
  });

  it('rounds a fractional survival', () => {
    const url = new URL(buildDareUrl('https://trydotto.live', challenge({ targetMs: 47_000.6 }), preview));
    expect(url.searchParams.get('d')).toBe('47001');
    expect(parseDare(url.search)).not.toBeNull();
  });

  it('falls back to concatenation on a misconfigured share base', () => {
    // bad VITE_SHARE_URL -> ugly link, never exception in click handler
    const out = buildDareUrl('not a url', challenge(), preview);
    expect(out).toContain(`${DARE_PATH}?d=47000`);
    expect(buildDareUrl('not a url/', challenge(), preview)).toContain(`${DARE_PATH}?d=47000`);
  });
});

describe('nextDare', () => {
  it('starts a fresh chain at one', () => {
    expect(nextDare(30_000, 1, null, null)).toEqual({
      targetMs: 30_000,
      levelId: 1,
      chain: 1,
      dayNumber: null,
    });
  });

  it('extends the chain on every send', () => {
    const incoming = challenge({ chain: 4 });
    expect(nextDare(30_000, 1, null, incoming).chain).toBe(5);
  });

  it('caps the chain counter', () => {
    expect(nextDare(1000, 1, null, challenge({ chain: 99 })).chain).toBe(99);
  });

  it('carries the day of a daily dare', () => {
    expect(nextDare(1000, DAILY_LEVEL_ID, 9, null).dayNumber).toBe(9);
  });
});

describe('beatsDare', () => {
  it('requires strictly more than the target', () => {
    const dare = challenge({ targetMs: 47_000 });
    expect(beatsDare(47_001, dare)).toBe(true);
    expect(beatsDare(47_000, dare)).toBe(false);
    expect(beatsDare(46_999, dare)).toBe(false);
  });
});
