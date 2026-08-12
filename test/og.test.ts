import { describe, expect, it } from 'vitest';
import {
  FAIL_HEADLINE,
  FAIL_SUBLINE,
  NEVER_SAW_PROBE,
  OG_HEIGHT,
  OG_WIDTH,
  PASS_HEADLINE,
  PASS_SUBLINE,
  REASON_CODES,
  dwellPercentile,
  formatDuration,
  headlineFor,
  renderCard,
  stateFrom,
  sublineFor,
} from '../api/og.ts';
import { dwellPercentile as clientPercentile } from '../src/benchmarks';
import {
  FAIL_HEADLINE as CLIENT_FAIL_HEADLINE,
  FAIL_SUBLINE as CLIENT_FAIL_SUBLINE,
  PASS_HEADLINE as CLIENT_PASS_HEADLINE,
  PASS_SUBLINE as CLIENT_PASS_SUBLINE,
  failSubline,
  formatDuration as clientDuration,
} from '../src/copy';
import { REASON_CODES as CLIENT_REASON_CODES } from '../src/dare';
import indexHtml from '../index.html?raw';

// crawlers fetch preview image out of band -> breakage invisible in product
const png = async (search: string): Promise<Uint8Array> =>
  new Uint8Array(await renderCard(new URL(`https://trydotto.live/api/og${search}`)).arrayBuffer());

// PNG magic number, then IHDR width/height as big-endian uint32s
function readPng(bytes: Uint8Array): { isPng: boolean; width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return { isPng, width: view.getUint32(16), height: view.getUint32(20) };
}

describe('preview card', () => {
  it('renders a PNG at the advertised size', async () => {
    const { isPng, width, height } = readPng(await png('?d=47000&l=1&n=2'));
    expect(isPng).toBe(true);
    expect(width).toBe(OG_WIDTH);
    expect(height).toBe(OG_HEIGHT);
    // index.html dimensions must match image or crawler stretches card
    expect(indexHtml).toContain(`property="og:image:width" content="${OG_WIDTH}"`);
    expect(indexHtml).toContain(`property="og:image:height" content="${OG_HEIGHT}"`);
  });

  it('stays inside WhatsApp’s size limit', async () => {
    // WhatsApp silently shows no image above ~300KB
    for (const search of ['?d=0&l=1', '?d=47000&l=1', '?d=1200000&l=5', '?d=61000&l=0&day=12']) {
      expect((await png(search)).byteLength).toBeLessThan(300_000);
    }
  });

  it('handles a hand-edited or missing number', async () => {
    // crawler renders no card on 500 -> out-of-range input clamped
    for (const search of ['', '?d=abc&l=1', '?d=-500&l=1', '?d=999999999&l=1', '?l=0&day=x']) {
      const { isPng } = readPng(await png(search));
      expect(isPng, `failed on "${search}"`).toBe(true);
    }
  });

  it('formats durations like the app', () => {
    // card duration string must match result screen exactly
    for (const ms of [0, 900, 1000, 47_000, 59_400, 60_000, 90_000, 150_000, 1_200_000]) {
      expect(formatDuration(ms), `${ms}ms`).toBe(clientDuration(ms));
    }
  });

  it('computes the client percentile from the same figures', () => {
    // drift -> card rank contradicts result screen
    for (const ms of [1, 500, 5000, 24_000, 40_000, 47_000, 120_000, 600_000]) {
      expect(dwellPercentile(ms), `${ms}ms`).toBe(clientPercentile(ms));
    }
  });

  it('matches the sender’s screen', () => {
    // card redraws result screen -> these keep its strings in sync
    expect(FAIL_HEADLINE).toEqual({ ...CLIENT_FAIL_HEADLINE });
    expect(FAIL_SUBLINE).toEqual({ ...CLIENT_FAIL_SUBLINE });
    expect(PASS_HEADLINE).toBe(CLIENT_PASS_HEADLINE);
    expect(PASS_SUBLINE).toBe(CLIENT_PASS_SUBLINE);
    expect(NEVER_SAW_PROBE).toBe(failSubline('tap-nothing', 0));
    expect(REASON_CODES).toEqual([...CLIENT_REASON_CODES]);
  });

  it('reproduces the sent run’s headline and subline', () => {
    const url = (search: string) => new URL(`https://trydotto.live/api/og${search}`);

    const passed = stateFrom(url('?d=61000&l=1&p=1&v=3'));
    expect(headlineFor(passed)).toBe(CLIENT_PASS_HEADLINE);
    expect(sublineFor(passed)).toBe(CLIENT_PASS_SUBLINE);

    // r=0 = tap-nothing, ordinary line if probe seen, mechanic explanation if not, matches failSubline
    const tapped = stateFrom(url('?d=9000&l=1&p=0&r=0&v=2'));
    expect(headlineFor(tapped)).toBe(CLIENT_FAIL_HEADLINE['tap-nothing']);
    expect(sublineFor(tapped)).toBe(failSubline('tap-nothing', 2));
    expect(sublineFor(stateFrom(url('?d=3000&l=1&p=0&r=0&v=0')))).toBe(failSubline('tap-nothing', 0));

    // sender answering dare saw verdict, not pass/fail
    const answering = stateFrom(url('?d=38000&l=1&p=0&r=3&v=1&t=47000'));
    expect(headlineFor(answering)).toBe('9s short.');
    expect(sublineFor(answering)).toBe('The number to beat was 47s.');
    expect(headlineFor(stateFrom(url('?d=60000&l=1&p=1&t=47000')))).toBe('Beaten by 13s.');
  });

  it('falls back on a link without display fields', () => {
    const bare = stateFrom(new URL('https://trydotto.live/api/og?d=20000&l=1'));
    expect(bare.passed).toBe(false);
    expect(bare.reason).toBeNull();
    expect(headlineFor(bare)).toBe(CLIENT_FAIL_HEADLINE.quit);
  });

  it('draws a different card for a different number', async () => {
    // guards card that renders but ignores its input
    const a = await png('?d=12000&l=1');
    const b = await png('?d=240000&l=1');
    expect(a.byteLength).not.toBe(b.byteLength);
  });
});
