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

  it('ends on a colon in every direction', () => {
    for (const direction of ['open', 'back', 'onward'] as const) {
      expect(shareMessage(ctx({ direction }))).toMatch(/:$/);
    }
  });

  it('anchors the number to the benchmarks average', () => {
    // figure = published mean screen dwell from benchmarks.ts
    expect(shareMessage(ctx())).toContain(`avg person lasts ${DWELL_MEAN_MS / 1000}s`);
  });

  it('names the day on a daily run', () => {
    expect(shareMessage(ctx({ dayNumber: 4 }))).toContain('#4');
    expect(shareMessage(ctx())).not.toContain('#');
  });

  it('differs between sending back and passing on', () => {
    expect(shareMessage(ctx({ direction: 'back' }))).not.toBe(
      shareMessage(ctx({ direction: 'onward' })),
    );
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
  });
});
