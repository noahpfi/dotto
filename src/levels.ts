import type { LevelSpec } from './engine/types';

// probeGapMs[1] bounds time away from screen, keep under ~65s
export const LEVELS: readonly LevelSpec[] = [
  {
    id: 1,
    label: '1 minute',
    durationMs: 60_000,
    firstProbeGapMs: [3500, 6000],
    probeGapMs: [16_000, 26_000],
    probeWindowMs: 3000,
  },
  {
    id: 2,
    label: '2:30',
    durationMs: 150_000,
    firstProbeGapMs: [4000, 7000],
    probeGapMs: [22_000, 40_000],
    probeWindowMs: 3000,
  },
  {
    id: 3,
    label: '5 minutes',
    durationMs: 300_000,
    firstProbeGapMs: [4000, 8000],
    probeGapMs: [25_000, 45_000],
    probeWindowMs: 2800,
  },
  {
    id: 4,
    label: '10 minutes',
    durationMs: 600_000,
    firstProbeGapMs: [4000, 8000],
    probeGapMs: [30_000, 55_000],
    probeWindowMs: 2500,
  },
  {
    id: 5,
    label: '20 minutes',
    durationMs: 1_200_000,
    firstProbeGapMs: [4000, 8000],
    probeGapMs: [35_000, 65_000],
    probeWindowMs: 2200,
  },
];

export function levelById(id: number): LevelSpec | null {
  return LEVELS.find((l) => l.id === id) ?? null;
}

// shortest level >= predictedMs, else longest if claim exceeds ladder
export function levelForPrediction(predictedMs: number): LevelSpec {
  return LEVELS.find((l) => l.durationMs >= predictedMs) ?? LEVELS[LEVELS.length - 1]!;
}

export function longerLevel(a: LevelSpec, b: LevelSpec): LevelSpec {
  return b.durationMs > a.durationMs ? b : a;
}

export const MAX_LEVEL_ID = LEVELS[LEVELS.length - 1]!.id;
