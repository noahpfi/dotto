import { describe, expect, it } from 'vitest';
import { Gauntlet, INPUT_GRACE_MS, WARMUP_MS } from '../src/engine/gauntlet';
import type { GauntletEvent, LevelSpec } from '../src/engine/types';
import { LEVELS } from '../src/levels';

const T0 = 1000;

// earlier-first-probe tests override firstProbeGapMs
function level(overrides: Partial<LevelSpec> = {}): LevelSpec {
  const probeGapMs = overrides.probeGapMs ?? ([5000, 5000] as const);
  return {
    id: 99,
    label: 'test',
    durationMs: 30_000,
    firstProbeGapMs: probeGapMs,
    probeGapMs,
    probeWindowMs: 1000,
    ...overrides,
  };
}

function harness(spec: LevelSpec, random: () => number = () => 0) {
  let now = T0;
  const events: GauntletEvent[] = [];
  const gauntlet = new Gauntlet(spec, {
    now: () => now,
    epochNow: () => 1_700_000_000_000,
    random,
    emit: (e) => events.push(e),
  });
  return {
    gauntlet,
    events,
    // steps clock, ticks engine each step -> schedules fire in order
    advance(ms: number, step = 25): void {
      const target = now + ms;
      while (now < target) {
        now = Math.min(now + step, target);
        gauntlet.update();
      }
    },
    // one discontinuous jump proves ordering inside single update() call
    jumpTo(absolute: number): void {
      now = absolute;
      gauntlet.update();
    },
    kinds(type: GauntletEvent['type']): GauntletEvent[] {
      return events.filter((e) => e.type === type);
    },
  };
}

describe('Gauntlet lifecycle', () => {
  it('starts idle and refuses a second start', () => {
    const h = harness(level());
    expect(h.gauntlet.getPhase()).toBe('idle');
    h.gauntlet.start();
    expect(h.gauntlet.getPhase()).toBe('running');
    expect(() => h.gauntlet.start()).toThrow(/already started/);
  });

  it('passes a run with no probes and clamps survivedMs to the target', () => {
    // 6s level, first probe at 2.5s+5s straddles end guard -> none scheduled
    const h = harness(level({ durationMs: 6000 }));
    h.gauntlet.start();
    h.advance(7000);

    const result = h.gauntlet.getResult();
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.reason).toBeNull();
    expect(result?.survivedMs).toBe(6000);
    expect(h.kinds('probe-start')).toHaveLength(0);
  });
});

describe('tap rules', () => {
  it('swallows taps inside the input grace window', () => {
    const h = harness(level());
    h.gauntlet.start();
    h.advance(INPUT_GRACE_MS - 100);
    h.gauntlet.tap();
    expect(h.gauntlet.getPhase()).toBe('running');
  });

  it('ends the run when the surface is tapped with no probe up', () => {
    const h = harness(level());
    h.gauntlet.start();
    h.advance(2000);
    h.gauntlet.tap();

    const result = h.gauntlet.getResult();
    expect(result?.passed).toBe(false);
    expect(result?.reason).toBe('tap-nothing');
    expect(result?.survivedMs).toBeGreaterThan(INPUT_GRACE_MS);
  });

  it('counts a tap inside the probe window as a hit and keeps running', () => {
    const h = harness(level());
    h.gauntlet.start();
    h.advance(WARMUP_MS + 5000 + 100);
    expect(h.gauntlet.isProbeActive()).toBe(true);

    h.gauntlet.tap();
    expect(h.gauntlet.getPhase()).toBe('running');
    expect(h.gauntlet.isProbeActive()).toBe(false);
    expect(h.kinds('probe-end')).toEqual([{ type: 'probe-end', hit: true }]);
  });

  it('ends the run when a probe expires unanswered', () => {
    const h = harness(level());
    h.gauntlet.start();
    h.advance(WARMUP_MS + 5000 + 1000 + 100);

    const result = h.gauntlet.getResult();
    expect(result?.reason).toBe('missed-probe');
    expect(result?.probesShown).toBe(1);
    expect(result?.probesHit).toBe(0);
    expect(h.kinds('probe-end')).toEqual([{ type: 'probe-end', hit: false }]);
  });

  it('keeps probing after a hit', () => {
    // answer first probe, ignore next -> run ends early
    const h = harness(level({ durationMs: 120_000, probeGapMs: [5000, 5000], probeWindowMs: 1000 }));
    h.gauntlet.start();
    h.advance(WARMUP_MS + 5000 + 100);
    h.gauntlet.tap();
    h.advance(6500);

    const result = h.gauntlet.getResult();
    expect(result?.reason).toBe('missed-probe');
    expect(result?.probesShown).toBe(2);
    expect(result?.probesHit).toBe(1);
    expect(result?.survivedMs).toBeLessThan(20_000);
  });
});

describe('leaving and quitting', () => {
  it('ends the run when the player leaves the screen', () => {
    const h = harness(level());
    h.gauntlet.start();
    h.advance(3000);
    h.gauntlet.leaveScreen();
    expect(h.gauntlet.getResult()?.reason).toBe('left-screen');
  });

  it('ignores leaveScreen and quit once the run is over', () => {
    const h = harness(level());
    h.gauntlet.start();
    h.advance(3000);
    h.gauntlet.quit();
    const first = h.gauntlet.getResult();

    h.gauntlet.leaveScreen();
    h.gauntlet.quit();
    expect(h.gauntlet.getResult()).toBe(first);
    expect(h.kinds('ended')).toHaveLength(1);
  });
});

describe('scheduling guards', () => {
  it('schedules no probe whose window straddles the finish', () => {
    const h = harness(level({ durationMs: 9000, probeGapMs: [5000, 5000], probeWindowMs: 1000 }));
    h.gauntlet.start();
    h.advance(10_000);
    // WARMUP+5000 = 7500, window ends 8500, guard cutoff 9000-1200 = 7800 -> skipped
    expect(h.kinds('probe-start')).toHaveLength(0);
    expect(h.gauntlet.getResult()?.passed).toBe(true);
  });

  it('lets the buzzer beat a probe expiring in the same update', () => {
    const h = harness(level({ durationMs: 10_000, probeGapMs: [1000, 1000], probeWindowMs: 2000 }));
    h.gauntlet.start();
    h.advance(WARMUP_MS + 1000 + 100);
    expect(h.gauntlet.isProbeActive()).toBe(true);

    // one discontinuous frame past probe deadline and finish line
    h.jumpTo(T0 + 12_000);
    expect(h.gauntlet.getResult()?.passed).toBe(true);
    expect(h.gauntlet.getResult()?.reason).toBeNull();
  });

  it('uses the short first gap for probe one and the long gap thereafter', () => {
    const h = harness(level({ durationMs: 120_000, firstProbeGapMs: [4000, 4000], probeGapMs: [30_000, 30_000] }));
    h.gauntlet.start();

    // first probe at WARMUP + 4000, not WARMUP + 30000
    h.advance(WARMUP_MS + 4000 + 50);
    expect(h.gauntlet.isProbeActive()).toBe(true);
    h.gauntlet.tap();

    // one more step expires answer window -> run ends
    h.advance(5000);
    expect(h.gauntlet.isProbeActive()).toBe(false);
    h.advance(25_500);
    expect(h.gauntlet.isProbeActive()).toBe(true);
  });

  it('shows each level its first probe within 11 seconds', () => {
    // guards every level against first probe landing after most runs ended
    for (const spec of LEVELS) {
      const latestFirstProbeMs = WARMUP_MS + spec.firstProbeGapMs[1];
      expect(latestFirstProbeMs).toBeLessThanOrEqual(11_000);
      expect(spec.firstProbeGapMs[0]).toBeLessThanOrEqual(spec.firstProbeGapMs[1]);
      expect(spec.firstProbeGapMs[1]).toBeLessThan(spec.probeGapMs[0]);
    }
  });

  it('covers the whole random probe gap range', () => {
    const early = harness(level({ probeGapMs: [5000, 15_000] }), () => 0);
    early.gauntlet.start();
    early.advance(WARMUP_MS + 5000 + 50);
    expect(early.gauntlet.isProbeActive()).toBe(true);

    const late = harness(level({ probeGapMs: [5000, 15_000] }), () => 0.9999);
    late.gauntlet.start();
    late.advance(WARMUP_MS + 5000 + 50);
    expect(late.gauntlet.isProbeActive()).toBe(false);
    late.advance(10_000);
    expect(late.gauntlet.isProbeActive()).toBe(true);
  });
});
