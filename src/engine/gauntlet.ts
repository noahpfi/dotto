import { randomIntBetween } from './rng';
import type { AttemptResult, FailReason, GauntletDeps, LevelSpec, Phase } from './types';

// START tap bleeds through on touch
export const INPUT_GRACE_MS = 450;
// no probes until player settles
export const WARMUP_MS = 2500;
// no probe scheduled inside end tail
export const END_GUARD_MS = 1200;

// time + randomness injected for deterministic tests
export class Gauntlet {
  private phase: Phase = 'idle';
  private startedAt = 0;
  private endsAt = 0;

  private probeAt: number | null = null;
  private probeActiveUntil: number | null = null;

  private probesShown = 0;
  private probesHit = 0;

  private lastResult: AttemptResult | null = null;

  constructor(
    private readonly level: LevelSpec,
    private readonly deps: GauntletDeps,
  ) {}

  getPhase(): Phase {
    return this.phase;
  }

  getResult(): AttemptResult | null {
    return this.lastResult;
  }

  isProbeActive(): boolean {
    return this.probeActiveUntil !== null;
  }

  start(): void {
    if (this.phase !== 'idle') throw new Error('Gauntlet.start: already started');
    const now = this.deps.now();
    this.phase = 'running';
    this.startedAt = now;
    this.endsAt = now + this.level.durationMs;
    this.scheduleProbe(now + WARMUP_MS, this.level.firstProbeGapMs);
  }

  // safe after run ends
  update(): void {
    if (this.phase !== 'running') return;
    const now = this.deps.now();

    // completion beats every pending hazard
    if (now >= this.endsAt) {
      this.finish(true, null, this.level.durationMs);
      return;
    }

    if (this.probeActiveUntil !== null && now >= this.probeActiveUntil) {
      this.probeActiveUntil = null;
      this.deps.emit({ type: 'probe-end', hit: false });
      this.finish(false, 'missed-probe', now - this.startedAt);
      return;
    }

    if (this.probeActiveUntil === null && this.probeAt !== null && now >= this.probeAt) {
      this.probeAt = null;
      this.probeActiveUntil = now + this.level.probeWindowMs;
      this.probesShown += 1;
      this.deps.emit({ type: 'probe-start', windowMs: this.level.probeWindowMs });
    }

    this.deps.emit({ type: 'tick', elapsedMs: now - this.startedAt, remainingMs: this.endsAt - now });
  }

  // correct only while probe up
  tap(): void {
    if (this.phase !== 'running') return;
    const now = this.deps.now();
    if (now - this.startedAt < INPUT_GRACE_MS) return;

    if (this.probeActiveUntil !== null) {
      this.probeActiveUntil = null;
      this.probesHit += 1;
      this.deps.emit({ type: 'probe-end', hit: true });
      this.scheduleProbe(now);
      return;
    }

    this.finish(false, 'tap-nothing', now - this.startedAt);
  }

  leaveScreen(): void {
    if (this.phase !== 'running') return;
    this.finish(false, 'left-screen', this.deps.now() - this.startedAt);
  }

  quit(): void {
    if (this.phase !== 'running') return;
    this.finish(false, 'quit', this.deps.now() - this.startedAt);
  }

  private scheduleProbe(from: number, gap: readonly [number, number] = this.level.probeGapMs): void {
    const [min, max] = gap;
    const at = from + randomIntBetween(this.deps.random, min, max);
    // skip probes whose answer window would straddle finish
    this.probeAt = at + this.level.probeWindowMs > this.endsAt - END_GUARD_MS ? null : at;
  }

  private finish(passed: boolean, reason: FailReason | null, survivedMs: number): void {
    this.phase = 'ended';
    this.probeAt = null;
    this.probeActiveUntil = null;
    this.lastResult = {
      levelId: this.level.id,
      passed,
      survivedMs: Math.max(0, Math.min(survivedMs, this.level.durationMs)),
      targetMs: this.level.durationMs,
      reason,
      probesShown: this.probesShown,
      probesHit: this.probesHit,
      endedAt: this.deps.epochNow(),
    };
    this.deps.emit({ type: 'ended', result: this.lastResult });
  }
}
