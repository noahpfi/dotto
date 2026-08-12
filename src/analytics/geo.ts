// EU/EEA, UK, CH, unknown countries need prior consent per ePrivacy Art 5(3)
export const PIXEL_ALLOWED_COUNTRIES: readonly string[] = ['US', 'CA', 'AU'];

export function isPixelAllowedCountry(country: string | null | undefined): boolean {
  if (typeof country !== 'string') return false;
  const code = country.trim().toUpperCase();
  if (code.length !== 2) return false;
  return PIXEL_ALLOWED_COUNTRIES.includes(code);
}

export interface GeoVerdict {
  readonly country: string | null;
  readonly pixel: boolean;
}

function parseVerdict(value: unknown): GeoVerdict | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<GeoVerdict>;
  if (typeof v.pixel !== 'boolean') return null;
  const country = typeof v.country === 'string' ? v.country : null;
  return { country, pixel: v.pixel };
}

// any failure -> pixel false
export async function fetchGeoVerdict(): Promise<GeoVerdict> {
  const denied: GeoVerdict = { country: null, pixel: false };
  try {
    const res = await fetch('/api/geo', {
      headers: { accept: 'application/json' },
      // verdict per visitor -> never cache
      cache: 'no-store',
    });
    if (!res.ok) return denied;
    return parseVerdict(await res.json()) ?? denied;
  } catch {
    return denied;
  }
}

// memoised -> pixel gate + pricing share one request, one country per visit
let inflight: Promise<GeoVerdict> | null = null;
let settled: GeoVerdict | null = null;

export async function whenGeoResolved(): Promise<GeoVerdict> {
  inflight ??= fetchGeoVerdict().then((verdict) => {
    settled = verdict;
    return verdict;
  });
  return inflight;
}

// never fetches
export function geoCountry(): string | null {
  return settled === null ? null : settled.country;
}
