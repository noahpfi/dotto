import './style.css';

import { Gauntlet } from './engine/gauntlet';
import type { AttemptResult, GauntletEvent } from './engine/types';
import { dwellPercentile } from './benchmarks';
import { dailyDayNumber, dailyRandom } from './daily';
import { beatsDare, parseDare, type DareChallenge } from './dare';
import { DAILY_LEVEL_ID, isDailyLevel, levelById, levelForPrediction, longerLevel } from './levels';
import { getPrediction, getPredictionArm, setPrediction } from './prediction';
import { dailyStreak, load, playedDaily, recordAttempt, type SaveData } from './storage';
import { initAnalytics, setTrackContext, track } from './track';
import { clear } from './ui/dom';
import { createDare } from './ui/dare';
import { createHome } from './ui/home';
import { PlayView } from './ui/play';
import { createPredict } from './ui/predict';
import { createResult } from './ui/result';

const WAKE_LOCK_SUPPORTED = 'wakeLock' in navigator;

class App {
  private save: SaveData = load();
  private gauntlet: Gauntlet | null = null;
  private play: PlayView | null = null;
  private rafId: number | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private currentLevelId = 1;
  // true only for single run session prediction was made for
  private predictionRun = false;
  private currentDailyDay: number | null = null;
  // kept across retries, cleared on return home
  private dare: DareChallenge | null = null;

  // per-run analytics state, reset in startLevel
  private probeIndex = 0;
  private probeShownAt: number | null = null;
  private elapsedMs = 0;

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.gauntlet?.leaveScreen();
  };
  private readonly onBlur = (): void => this.gauntlet?.leaveScreen();
  private readonly onPageHide = (): void => this.gauntlet?.leaveScreen();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.gauntlet?.quit();
  };

  constructor(private readonly mount: HTMLElement) {}

  showHome(): void {
    this.teardownRun();
    // dare buttons on result screen apply only inside challenge
    this.dare = null;
    clear(this.mount);
    const day = dailyDayNumber();
    const streak = dailyStreak(this.save, day);
    this.mount.appendChild(
      createHome(
        this.save,
        { dayNumber: day, streak },
        {
          onStart: (levelId) => this.beginLevel(levelId),
          onStartDaily: () => this.beginLevel(DAILY_LEVEL_ID),
          wakeLockUnsupported: !WAKE_LOCK_SUPPORTED,
        },
      ),
    );
    track('home_viewed', {
      unlocked_level: this.save.unlockedLevel,
      attempts: this.save.attempts,
      returning: this.save.attempts > 0,
      daily_streak: streak,
      daily_played: playedDaily(this.save, day),
    });
  }

  showDare(dare: DareChallenge): void {
    this.dare = dare;
    clear(this.mount);
    this.mount.appendChild(
      createDare(dare, {
        onAccept: () => {
          track('dare_accepted', {
            level_id: dare.levelId,
            target_ms: dare.targetMs,
            chain: dare.chain,
          });
          this.beginLevel(dare.levelId);
        },
        onDecline: () => {
          track('dare_declined', { chain: dare.chain });
          this.showHome();
        },
      }),
    );
    track('dare_landed', {
      level_id: dare.levelId,
      target_ms: dare.targetMs,
      chain: dare.chain,
      daily: isDailyLevel(dare.levelId),
    });
  }

  // prediction sets length of that one run only
  private beginLevel(levelId: number): void {
    // prediction could lengthen run away from shared or dared level
    if (isDailyLevel(levelId) || this.dare !== null) {
      this.predictionRun = false;
      this.startLevel(levelId);
      return;
    }
    if (getPredictionArm() === 'skip' || getPrediction() !== null) {
      this.predictionRun = false;
      this.startLevel(levelId);
      return;
    }
    this.teardownRun();
    clear(this.mount);
    track('prediction_shown', { level_id: levelId });
    this.mount.appendChild(
      createPredict((ms) => {
        setPrediction(ms);
        const runLevelId = this.levelHonouring(levelId, ms);
        track('prediction_answered', {
          predicted_ms: ms,
          chosen_level_id: levelId,
          run_level_id: runLevelId,
          raised: runLevelId !== levelId,
        });
        this.predictionRun = true;
        this.startLevel(runLevelId);
      }),
    );
  }

  // prediction only lengthens its run, never shortens chosen level
  private levelHonouring(levelId: number, predictedMs: number): number {
    const chosen = levelById(levelId);
    if (chosen === null) return levelId;
    return longerLevel(chosen, levelForPrediction(predictedMs)).id;
  }

  private startLevel(levelId: number): void {
    const level = levelById(levelId);
    if (level === null) {
      console.warn(`dotto: no such level ${levelId}, returning home`);
      this.showHome();
      return;
    }
    this.currentLevelId = levelId;
    // per run -> daily started across UTC midnight gets current day
    this.currentDailyDay = isDailyLevel(levelId) ? dailyDayNumber() : null;
    this.probeIndex = 0;
    this.probeShownAt = null;
    this.elapsedMs = 0;

    // wake lock needs live user gesture
    void this.acquireWakeLock();

    const play = new PlayView({ onTap: () => this.gauntlet?.tap() });
    // date-seeded -> identical everywhere
    const random = this.currentDailyDay === null ? Math.random : dailyRandom(this.currentDailyDay);
    const gauntlet = new Gauntlet(level, {
      now: () => performance.now(),
      epochNow: () => Date.now(),
      random,
      emit: (event) => this.onEngineEvent(event),
    });

    this.play = play;
    this.gauntlet = gauntlet;

    clear(this.mount);
    this.mount.appendChild(play.root);
    play.setRemaining(level.durationMs);

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('keydown', this.onKeyDown);

    gauntlet.start();
    track('run_started', {
      level_id: levelId,
      target_ms: level.durationMs,
      predicted_ms: getPrediction(),
      is_prediction_run: this.predictionRun,
      attempt_number: this.save.attempts + 1,
      daily_day: this.currentDailyDay,
      dare_chain: this.dare === null ? null : this.dare.chain,
    });
    this.loop();
  }

  private loop(): void {
    this.rafId = requestAnimationFrame(() => {
      this.gauntlet?.update();
      if (this.gauntlet?.getPhase() === 'running') this.loop();
    });
  }

  private onEngineEvent(event: GauntletEvent): void {
    const play = this.play;
    if (play === null) return;
    switch (event.type) {
      case 'tick':
        play.setRemaining(event.remainingMs);
        this.elapsedMs = event.elapsedMs;
        break;
      case 'probe-start':
        play.setProbeActive(true);
        this.probeIndex += 1;
        this.probeShownAt = performance.now();
        track('probe_shown', {
          level_id: this.currentLevelId,
          index: this.probeIndex,
          elapsed_ms: Math.round(this.elapsedMs),
          window_ms: event.windowMs,
        });
        break;
      case 'probe-end': {
        play.setProbeActive(false);
        // reaction time = product's only behavioural measurement
        const shownAt = this.probeShownAt;
        this.probeShownAt = null;
        if (event.hit) {
          track('probe_answered', {
            level_id: this.currentLevelId,
            index: this.probeIndex,
            reaction_ms: shownAt === null ? -1 : Math.round(performance.now() - shownAt),
          });
        } else {
          track('probe_missed', {
            level_id: this.currentLevelId,
            index: this.probeIndex,
            elapsed_ms: Math.round(this.elapsedMs),
          });
        }
        break;
      }
      case 'ended':
        // ended event can fire inside pointerdown of view about to be destroyed
        queueMicrotask(() => this.showResult(event.result));
        break;
    }
  }

  private showResult(result: AttemptResult): void {
    const predicted = getPrediction();
    const unlockedBefore = this.save.unlockedLevel;
    const dailyDay = this.currentDailyDay;
    const dare = this.dare;
    this.save = recordAttempt(this.save, result, dailyDay);

    track('run_ended', {
      level_id: result.levelId,
      passed: result.passed,
      reason: result.reason,
      survived_ms: Math.round(result.survivedMs),
      target_ms: result.targetMs,
      completion_ratio: Number((result.survivedMs / result.targetMs).toFixed(4)),
      probes_shown: result.probesShown,
      probes_hit: result.probesHit,
      predicted_ms: predicted,
      prediction_ratio:
        predicted === null ? null : Number((result.survivedMs / predicted).toFixed(4)),
      is_prediction_run: this.predictionRun,
      daily_day: dailyDay,
      dare_chain: dare === null ? null : dare.chain,
    });
    if (this.save.unlockedLevel > unlockedBefore) {
      track('level_unlocked', { level_id: this.save.unlockedLevel });
    }
    // apart from run_ended -> own dare funnel landed/accepted/result, beat picks volley
    if (dare !== null) {
      track('dare_result', {
        level_id: result.levelId,
        target_ms: dare.targetMs,
        survived_ms: Math.round(result.survivedMs),
        chain: dare.chain,
        beat: beatsDare(result.survivedMs, dare),
      });
    }

    this.teardownRun();
    clear(this.mount);
    this.mount.appendChild(
      createResult(
        result,
        {
          // retry = new run -> claim now past
          onRetry: () => {
            this.predictionRun = false;
            this.startLevel(this.currentLevelId);
          },
          onHome: () => this.showHome(),
        },
        { retrospectivePrediction: !this.predictionRun, dayNumber: dailyDay, dare },
      ),
    );
    track('result_viewed', {
      level_id: result.levelId,
      passed: result.passed,
      reason: result.reason,
      survived_ms: Math.round(result.survivedMs),
      dwell_percentile: dwellPercentile(result.survivedMs),
    });
  }

  private teardownRun(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('keydown', this.onKeyDown);
    this.play?.destroy();
    this.play = null;
    this.gauntlet = null;
    void this.releaseWakeLock();
  }

  // stops phone auto-lock visibilitychange ending long run
  private async acquireWakeLock(): Promise<void> {
    if (!WAKE_LOCK_SUPPORTED) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn('dotto: screen wake lock refused, long runs may be cut short by auto-lock —', err);
    }
  }

  private async releaseWakeLock(): Promise<void> {
    const lock = this.wakeLock;
    this.wakeLock = null;
    if (lock === null) return;
    try {
      await lock.release();
    } catch (err) {
      console.warn('dotto: wake lock release failed —', err);
    }
  }
}

const mount = document.getElementById('app');
if (mount === null) throw new Error('dotto: #app mount point missing from index.html');
initAnalytics();
// set before first event -> every funnel incl home_viewed splits by arm
setTrackContext({ prediction_arm: getPredictionArm() });

// malformed dare link parses to null -> lands on home
const app = new App(mount);
const incoming = parseDare(window.location.search);
if (incoming === null) app.showHome();
else app.showDare(incoming);
