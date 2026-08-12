import { afterEach, describe, expect, it, vi } from 'vitest';
// read via Vite ?raw -> no @types/node globals
import edgeSource from '../api/geo.ts?raw';
import viteConfigSource from '../vite.config.ts?raw';
import geoHandler from '../api/geo.ts';
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

  it('routes the dev server through the real handler', () => {
    // dev middleware must import api/geo.ts, never restate allow-list
    expect(viteConfigSource).toMatch(/import geoHandler from '\.\/api\/geo(\.ts)?'/);
    expect(viteConfigSource).toContain('geoHandler(new Request(');
    expect(viteConfigSource).not.toMatch(/new Set\(\[\s*'[A-Z]{2}'/);
  });
});

describe('the real edge handler', () => {
  it('allows only the three countries from the header', async () => {
    const call = async (country: string | null) => {
      const headers = new Headers();
      if (country !== null) headers.set('x-vercel-ip-country', country);
      const res = geoHandler(new Request('http://localhost/api/geo', { headers }));
      return (await res.json()) as { country: string | null; pixel: boolean };
    };
    expect(await call('US')).toEqual({ country: 'US', pixel: true });
    expect(await call('ca')).toEqual({ country: 'CA', pixel: true });
    expect(await call('AT')).toEqual({ country: 'AT', pixel: false });
    // missing header -> fail closed
    expect(await call(null)).toEqual({ country: null, pixel: false });
  });

  it('never caches a verdict', () => {
    const res = geoHandler(new Request('http://localhost/api/geo'));
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});

// pixel gate and price share one memoised country lookup
describe('shared geo verdict', () => {
  // fresh module registry per test resets memo
  async function freshGeo(body: unknown, ok = true) {
    vi.resetModules();
    const fetchMock = vi.fn(async () =>
      Promise.resolve({ ok, json: async () => Promise.resolve(body) } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    return { mod: await import('../src/analytics/geo'), fetchMock };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches once for all callers', async () => {
    const { mod, fetchMock } = await freshGeo({ country: 'US', pixel: true });
    const [a, b, c] = await Promise.all([
      mod.whenGeoResolved(),
      mod.whenGeoResolved(),
      mod.whenGeoResolved(),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ country: 'US', pixel: true });
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('exposes the country only after it arrives', async () => {
    const { mod } = await freshGeo({ country: 'CA', pixel: true });
    // null before promise settles -> price falls back to USD
    expect(mod.geoCountry()).toBeNull();
    await mod.whenGeoResolved();
    expect(mod.geoCountry()).toBe('CA');
  });

  it('reports no country on failure and tries once', async () => {
    const { mod, fetchMock } = await freshGeo({}, false);
    expect(await mod.whenGeoResolved()).toEqual({ country: null, pixel: false });
    await mod.whenGeoResolved();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mod.geoCountry()).toBeNull();
  });
});
