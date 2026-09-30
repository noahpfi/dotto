import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import vercelJson from '../vercel.json?raw';
import { applyDarePreview } from '../api/dare.ts';
import { DARE_PATH, buildDareUrl, parseDare } from '../src/dare';

// receiving apps build share card from these tags
describe('static preview tags', () => {
  it('uses absolute preview URLs', () => {
    // crawlers cannot resolve relative URLs
    for (const tag of ['og:image', 'twitter:image']) {
      const match = new RegExp(`${tag}" content="([^"]+)"`).exec(indexHtml);
      expect(match, `${tag} missing`).not.toBeNull();
      expect(match?.[1]).toMatch(/^https:\/\//);
    }
    expect(indexHtml).toContain('property="og:url" content="https://');
  });

  it('keeps the image within chat app fetch limits', () => {
    // WhatsApp drops images over ~300KB or under 100x100
    expect(indexHtml).toContain('property="og:image:width" content="1200"');
    expect(indexHtml).toContain('property="og:image:height" content="630"');
  });

  it('keeps every rewritable meta tag on one line', () => {
    // api/dare.ts rewrites these by regex -> attributes must stay on one line
    for (const tag of ['og:title', 'og:description', 'og:url']) {
      expect(indexHtml).toMatch(new RegExp(`<meta property="${tag}" content="[^"]*" />`));
    }
    expect(indexHtml).toMatch(/<meta name="twitter:title" content="[^"]*" \/>/);
  });

  it('routes dare links through the rewrite function', () => {
    // Vercel applies rewrites after filesystem
    const config = JSON.parse(vercelJson) as {
      rewrites: { source: string; destination: string }[];
    };
    const rule = config.rewrites.find((r) => r.destination === '/api/dare');
    expect(rule).toBeDefined();
    expect(rule?.source).toBe(DARE_PATH);
    expect(rule?.source).not.toBe('/');
  });

  it('sends every dare through the rewrite path', () => {
    // rewrite source and dare link path must match
    const url = new URL(
      buildDareUrl('https://trydotto.live', {
        targetMs: 47_000,
        levelId: 1,
        chain: 1,
        dayNumber: null,
      }, { direction: 'open' }),
    );
    expect(url.pathname).toBe(DARE_PATH);
  });
});

describe('applyDarePreview', () => {
  const ORIGIN = 'https://trydotto.live';
  const url = (search: string) => new URL(`${ORIGIN}/${search}`);

  it('puts the taunt in title, tab and twitter card', () => {
    // shared URL carries no text -> title holds taunt
    const taunt = 'Bet you can’t last longer than my 47s (avg person lasts 47s)';
    const out = applyDarePreview(indexHtml, url('?d=47000&l=1&n=2'), ORIGIN);
    expect(out).toContain(`property="og:title" content="${taunt}"`);
    expect(out).toContain(`name="twitter:title" content="${taunt}"`);
    expect(out).toContain(`<title>${taunt}</title>`);
    expect(out).toContain('property="og:url" content="https://trydotto.live/d?d=47000&amp;l=1&amp;n=2"');
  });

  it('says whose turn it is on a volley back', () => {
    const out = applyDarePreview(indexHtml, url('?d=47000&l=1&n=3&w=b'), ORIGIN);
    expect(out).toContain('content="Your move. Bet you can’t beat my 47s (avg person lasts 47s)"');
  });

  it('keeps the description within WhatsApp’s visible length', () => {
    const out = applyDarePreview(indexHtml, url('?d=47000&l=1'), ORIGIN);
    const description = /property="og:description" content="([^"]*)"/.exec(out)?.[1] ?? '';
    expect(description).toBe('dotto focus challenge - tap only when the dot goes hollow.');
    expect(description.length).toBeLessThan(80);
  });

  it('names the day on a daily dare', () => {
    const out = applyDarePreview(indexHtml, url('?d=150000&l=0&n=1&day=7'), ORIGIN);
    expect(out).toContain('content="dotto #7 — Bet you can’t last longer than my 2:30 (avg person lasts 47s)"');
  });

  it('claims no day for a ladder dare carrying one', () => {
    const out = applyDarePreview(indexHtml, url('?d=60000&l=2&day=7'), ORIGIN);
    expect(out).toContain('content="Bet you can’t last longer than my 1:00 (avg person lasts 47s)"');
    expect(out).not.toContain('dotto #7');
  });

  it('leaves the image pointing at the static card', () => {
    // og:image must point at existing static asset
    const out = applyDarePreview(indexHtml, url('?d=47000&l=1'), ORIGIN);
    expect(out).toContain('property="og:image" content="https://trydotto.live/og.png"');
    expect(out).not.toContain('/api/og');
  });

  it('leaves the page unchanged without a valid dare', () => {
    for (const search of ['', '?', '?utm_source=ig', '?d=abc&l=1', '?d=1000&l=99', '?d=-5&l=1']) {
      expect(applyDarePreview(indexHtml, url(search), ORIGIN)).toBe(indexHtml);
    }
  });

  it('agrees with the client parser on valid links', () => {
    // edge and app parsers must accept identical dare links
    const cases = [
      '?d=47000&l=1&n=2',
      '?d=0&l=0&day=3',
      '?d=150000&l=5',
      '?d=12000abc&l=1',
      '?d=1.5&l=1',
      '?d=99999999&l=1',
      '?d=1000&l=6',
      '?d=1000&l=-1',
      '?l=1&n=1',
      '',
    ];
    for (const search of cases) {
      const clientAccepts = parseDare(search) !== null;
      const edgeAccepts = applyDarePreview(indexHtml, url(search), ORIGIN) !== indexHtml;
      expect(edgeAccepts, `disagreement on "${search}"`).toBe(clientAccepts);
    }
  });

  it('escapes anything it injects', () => {
    // values escaped despite being integers
    const out = applyDarePreview(indexHtml, url('?d=47000&l=1&n=2&day=1'), ORIGIN);
    expect(out).not.toMatch(/content="[^"]*<[^"]*"/);
    expect(out.match(/<title>/g)).toHaveLength(1);
  });

  it('inserts replacement patterns in the query literally', () => {
    const out = applyDarePreview(indexHtml, url("?d=47000&l=1&x=$`$&$'$1"), ORIGIN);
    expect(out).toContain(
      'property="og:url" content="https://trydotto.live/d?d=47000&amp;l=1&amp;x=$`$&amp;$%27$1"',
    );
    expect(out.match(/<!doctype html>/gi)).toHaveLength(1);
    expect(out.match(/<meta property="og:url"/g)).toHaveLength(1);
  });
});
