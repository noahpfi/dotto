// never claim to train/measure attention -> dodges UWG §2 + MDCG 2019-11

export type FailReason =
  | 'tap-nothing'
  // tab hidden, window blurred or page hidden
  | 'left-screen'
  // probe expired unanswered, eg player walked away
  | 'missed-probe'
  | 'quit';

export type Phase = 'idle' | 'running' | 'ended';

export interface LevelSpec {
  readonly id: number;
  readonly label: string;
  readonly durationMs: number;
  // max caps how long walk-away goes unseen
  readonly probeGapMs: readonly [number, number];
  readonly probeWindowMs: number;
}

export interface AttemptResult {
  readonly levelId: number;
  readonly passed: boolean;
  readonly survivedMs: number;
  readonly targetMs: number;
  readonly reason: FailReason | null;
  readonly probesShown: number;
  readonly probesHit: number;
  // epoch ms for local history log
  readonly endedAt: number;
}

export type GauntletEvent =
  | { readonly type: 'tick'; readonly elapsedMs: number; readonly remainingMs: number }
  | { readonly type: 'probe-start'; readonly windowMs: number }
  | { readonly type: 'probe-end'; readonly hit: boolean }
  | { readonly type: 'ended'; readonly result: AttemptResult };

export interface GauntletDeps {
  // monotonic ms, injected -> tests control time
  readonly now: () => number;
  // injected -> deterministic probe schedules in tests
  readonly random: () => number;
  // wall-clock epoch ms, only stamps result
  readonly epochNow: () => number;
  readonly emit: (event: GauntletEvent) => void;
}
