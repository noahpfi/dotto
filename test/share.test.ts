import { describe, expect, it } from 'vitest';
import { SHARE_LABEL, shareMessage, shareText, type ShareContext } from '../src/copy';
import { DWELL_MEAN_MS } from '../src/benchmarks';

const URL_ = 'https://trydotto.live/?d=24000&l=1&n=1';

const ctx = (over: Partial<ShareContext> = {}): ShareContext => ({
  survivedMs: 24_000,
  percentile: 22,
  predictedMs: null,
  dayNumber: null,
  direction: 'open',
  ...over,
});

// shared sentence claims only published distribution or this run, never reader attention
describe('shareMessage', () => {
  it('omits the link', () => {
    for (const direction of ['open', 'back', 'onward'] as const) {
      for (const extra of [{}, { predictedMs: 300_000 }, { dayNumber: 3 }]) {
        const message = shareMessage(ctx({ direction, ...extra }));
        expect(message).not.toContain('http');
        expect(message).not.toContain('trydotto');
      }
    }
  });

  it('phrases each label as a challenge', () => {
    expect(shareMessage(ctx())).toBe('Bet you won’t last longer than my 24s (avg person lasts 47s):');
    expect(shareMessage(ctx({ direction: 'back' }))).toBe(
      'Your move. Bet you won’t beat my 24s (avg person lasts 47s):',
    );
  });

  it('ends on a colon in every direction', () => {
    for (const direction of ['open', 'back', 'onward'] as const) {
      expect(shareMessage(ctx({ direction }))).toMatch(/:$/);
    }
  });

  it('anchors the number to the benchmarks average', () => {
    // figure = published mean screen dwell from benchmarks.ts
    expect(shareMessage(ctx())).toContain(`avg person lasts ${DWELL_MEAN_MS / 1000}s`);
  });

  it('never calls the average a majority', () => {
    // 47s is mean -> copy must not call it median
    expect(shareMessage(ctx())).not.toMatch(/most|majority|half of/i);
  });

  it('names the day on a daily run', () => {
    expect(shareMessage(ctx({ dayNumber: 4 }))).toContain('dotto #4 — bet you won’t last');
  });

  it('differs between sending back and passing on', () => {
    expect(shareMessage(ctx({ direction: 'back' }))).not.toBe(
      shareMessage(ctx({ direction: 'onward' })),
    );
  });

  it('claims nothing about the reader or attention', () => {
    // claims concern modelled screen-visit distribution or this run, never faculty or reader
    const forbidden = /attention|focus|span|brain|train|improve|adhd|your mind/i;
    for (const direction of ['open', 'back', 'onward'] as const) {
      for (const extra of [{}, { predictedMs: 300_000 }, { dayNumber: 3 }]) {
        expect(shareMessage(ctx({ direction, ...extra }))).not.toMatch(forbidden);
      }
    }
  });
});

describe('shareText', () => {
  it('joins the message and the link', () => {
    for (const direction of ['open', 'back', 'onward'] as const) {
      const joined = shareText(ctx({ direction }), URL_);
      expect(joined).toBe(`${shareMessage(ctx({ direction }))} ${URL_}`);
      expect(joined).toContain(URL_);
    }
  });

  it('includes the link exactly once', () => {
    expect(shareText(ctx(), URL_).split(URL_)).toHaveLength(2);
  });
});

describe('share button labels', () => {
  it('names all three directions distinctly', () => {
    const labels = Object.values(SHARE_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
    expect(SHARE_LABEL.open).toBe('Dare a friend');
    expect(SHARE_LABEL.back).toBe('Send it back');
    expect(SHARE_LABEL.onward).toBe('Dare someone else');
  });
});
