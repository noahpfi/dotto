// published reference points only, never claims about player per MDCG 2019-11

export interface Benchmark {
  readonly ms: number;
  readonly label: string;
  // shown when nearest mark below or above result
  readonly line: string;
  readonly source: string;
}

const MARK_SOURCE = 'Gloria Mark, UC Irvine — Attention Span (2023)';

export const BENCHMARKS: readonly Benchmark[] = [
  {
    ms: 47_000,
    label: 'today',
    line: 'The average person switches screens every 47 seconds.',
    source: MARK_SOURCE,
  },
  {
    ms: 75_000,
    label: '2012',
    line: 'In 2012 the same measurement was 75 seconds.',
    source: MARK_SOURCE,
  },
  {
    ms: 150_000,
    label: '2004',
    line: 'In 2004, the first time this was measured, it was two and a half minutes.',
    source: 'Mark & González, UC Irvine (2004)',
  },
];

export const FABRICATED_STAT_NOTE =
  'You have probably been told humans manage 8 seconds, worse than a goldfish. ' +
  'That number has no study behind it — it traces to a statistics site that could never produce a source. ' +
  'The real figure is 47 seconds.';

// lognormal fit to Mark's published median 40s, mean 47s
export const DWELL_MEDIAN_MS = 40_000;
export const DWELL_MEAN_MS = 47_000;
export const DWELL_MU = Math.log(DWELL_MEDIAN_MS / 1000);
export const DWELL_SIGMA = Math.sqrt(2 * (Math.log(DWELL_MEAN_MS / 1000) - DWELL_MU));

export const DWELL_MODEL_NOTE =
  'Curve modelled from the published mean (47s) and median (40s) for screen dwell. Holding a dot on purpose is a different task — the comparison is the game, not a measurement of you.';

// unnormalised lognormal density
export function dwellDensity(seconds: number): number {
  if (seconds <= 0) return 0;
  const z = (Math.log(seconds) - DWELL_MU) / DWELL_SIGMA;
  return Math.exp(-0.5 * z * z) / (seconds * DWELL_SIGMA * Math.sqrt(2 * Math.PI));
}

// percent of modelled population at or below ms, via erf approx
export function dwellPercentile(ms: number): number {
  if (ms <= 0) return 0;
  const z = (Math.log(ms / 1000) - DWELL_MU) / (DWELL_SIGMA * Math.SQRT2);
  return Math.round(((1 + erf(z)) / 2) * 100);
}

// Abramowitz & Stegun 7.1.26, max abs error 1.5e-7
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

export function benchmarkCleared(survivedMs: number): Benchmark | null {
  let best: Benchmark | null = null;
  for (const b of BENCHMARKS) {
    if (survivedMs >= b.ms && (best === null || b.ms > best.ms)) best = b;
  }
  return best;
}

export function benchmarkAhead(survivedMs: number): Benchmark | null {
  let next: Benchmark | null = null;
  for (const b of BENCHMARKS) {
    if (survivedMs < b.ms && (next === null || b.ms < next.ms)) next = b;
  }
  return next;
}
