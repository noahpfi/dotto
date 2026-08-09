import { describe, expect, it } from 'vitest';
// read via Vite ?raw -> no @types/node globals
import edgeSource from '../api/geo.ts?raw';
import { PIXEL_ALLOWED_COUNTRIES, isPixelAllowedCountry } from '../src/analytics/geo';

describe('pixel geo gate', () => {
  it('allows only the three no-prior-consent countries', () => {
    expect([...PIXEL_ALLOWED_COUNTRIES].sort()).toEqual(['AU', 'CA', 'US']);
    for (const c of PIXEL_ALLOWED_COUNTRIES) expect(isPixelAllowedCountry(c)).toBe(true);
  });

  it('denies every prior-consent jurisdiction', () => {
    // regression = unlawful pixel
    for (const c of ['AT', 'DE', 'FR', 'IT', 'ES', 'NL', 'IE', 'PL', 'SE', 'NO', 'GB', 'CH']) {
      expect(isPixelAllowedCountry(c)).toBe(false);
    }
  });

  it('fails closed on unreadable input', () => {
    for (const bad of [null, undefined, '', ' ', 'U', 'USA', 'xx', '12', 'US US']) {
      expect(isPixelAllowedCountry(bad as string | null)).toBe(false);
    }
  });

  it('normalises case and surrounding whitespace', () => {
    expect(isPixelAllowedCountry(' us ')).toBe(true);
    expect(isPixelAllowedCountry('ca')).toBe(true);
  });

  it('keeps the edge allow-list identical to the client one', () => {
    // api/geo.ts cannot import from src/
    const match = /new Set\(\[(.*?)\]\)/s.exec(edgeSource);
    expect(match).not.toBeNull();
    const edgeList = [...(match?.[1] ?? '').matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]).sort();
    expect(edgeList).toEqual([...PIXEL_ALLOWED_COUNTRIES].sort());
  });

  it('defaults the edge function to deny', () => {
    expect(edgeSource).toContain('no-store');
    expect(edgeSource).toMatch(/country\.length === 2 && ALLOWED\.has\(country\)/);
  });
});
