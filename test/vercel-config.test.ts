import { describe, expect, it } from 'vitest';
import vercelConfig from '../vercel.json';

// PostHog paths end in slash, Vercel :path* misses it
describe('vercel.json ingest proxy', () => {
  const rewrites = vercelConfig.rewrites ?? [];

  it('routes every /ingest path, trailing slash included', () => {
    const ingest = rewrites.filter((r) => r.source.startsWith('/ingest'));
    expect(ingest.length).toBeGreaterThan(0);
    for (const r of ingest) {
      expect(r.source).not.toContain(':path*');
      expect(r.source).toMatch(/\(\.\*\)$/);
      expect(r.destination).toMatch(/\$1$/);
    }
  });

  it('sends assets and events to the right PostHog hosts', () => {
    const assets = rewrites.find((r) => r.source.startsWith('/ingest/static'));
    const events = rewrites.find((r) => r.source === '/ingest/(.*)');
    expect(assets?.destination).toBe('https://eu-assets.i.posthog.com/static/$1');
    expect(events?.destination).toBe('https://eu.i.posthog.com/$1');
  });

  it('keeps the static rule ahead of the catch-all', () => {
    // catch-all after /ingest/static -> assets reach asset host
    const order = rewrites.map((r) => r.source);
    expect(order.indexOf('/ingest/static/(.*)')).toBeLessThan(order.indexOf('/ingest/(.*)'));
  });

  it('does not enforce trailing-slash normalisation', () => {
    // trailingSlash false would redirect /ingest/e/ before rewrite runs
    expect('trailingSlash' in vercelConfig).toBe(false);
  });
});
