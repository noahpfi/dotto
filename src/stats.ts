// no endpoint -> result screen uses cited-benchmark scale
const ENDPOINT = import.meta.env['VITE_STATS_ENDPOINT'] as string | undefined;

// min recorded runs before any percentile shown
export const MIN_SAMPLE = 50;

export interface StatsBucket {
  // upper bucket edge in ms
  readonly upToMs: number;
  readonly count: number;
}

export interface LevelStats {
  readonly levelId: number;
  readonly sampleSize: number;
  // ascending by upToMs
  readonly buckets: readonly StatsBucket[];
}

// middle band of real dotto runs in ms, drawn over modelled curve
export interface PlayerBand {
  readonly lowMs: number;
  readonly highMs: number;
  readonly medianMs: number;
}

export function playerBand(stats: LevelStats): PlayerBand | null {
  const total = stats.buckets.reduce((sum, b) => sum + b.count, 0);
  if (total < MIN_SAMPLE) return null;
  const at = (share: number): number | null => {
    let seen = 0;
    for (const b of stats.buckets) {
      seen += b.count;
      if (seen / total >= share) return b.upToMs;
    }
    return null;
  };
  const lowMs = at(0.1);
  const medianMs = at(0.5);
  const highMs = at(0.9);
  if (lowMs === null || medianMs === null || highMs === null || highMs <= lowMs) return null;
  return { lowMs, highMs, medianMs };
}

export function isStatsEnabled(): boolean {
  return ENDPOINT !== undefined && ENDPOINT !== '';
}

function parseStats(levelId: number, value: unknown): LevelStats | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<LevelStats>;
  if (typeof v.sampleSize !== 'number' || !Number.isFinite(v.sampleSize) || v.sampleSize < 0) return null;
  if (!Array.isArray(v.buckets)) return null;
  const buckets: StatsBucket[] = [];
  for (const raw of v.buckets) {
    if (typeof raw !== 'object' || raw === null) return null;
    const b = raw as Partial<StatsBucket>;
    if (typeof b.upToMs !== 'number' || !Number.isFinite(b.upToMs)) return null;
    if (typeof b.count !== 'number' || !Number.isFinite(b.count) || b.count < 0) return null;
    buckets.push({ upToMs: b.upToMs, count: b.count });
  }
  buckets.sort((a, b) => a.upToMs - b.upToMs);
  return { levelId, sampleSize: v.sampleSize, buckets };
}

// GET VITE_STATS_ENDPOINT?level=<id> -> sampleSize + buckets of upToMs, count, else null
export async function fetchLevelStats(levelId: number): Promise<LevelStats | null> {
  if (!isStatsEnabled()) return null;
  try {
    const url = new URL(ENDPOINT as string, window.location.origin);
    url.searchParams.set('level', String(levelId));
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`stats endpoint returned ${res.status}`);
    const parsed = parseStats(levelId, await res.json());
    if (parsed === null) throw new Error('stats endpoint returned an unusable shape');
    return parsed;
  } catch (err) {
    console.warn('dotto: could not load level stats, falling back to benchmarks —', err);
    return null;
  }
}

// 0 to 100
export function percentileOf(stats: LevelStats, ms: number): number {
  const total = stats.buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return 0;
  const below = stats.buckets.reduce((sum, b) => (b.upToMs <= ms ? sum + b.count : sum), 0);
  return Math.round((below / total) * 100);
}
