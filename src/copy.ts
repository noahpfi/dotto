import { DWELL_MEAN_MS } from './benchmarks';
import type { FailReason } from './engine/types';

// no string may claim dotto improves or assesses attention, per FTC Lumosity and MDCG 2019-11

export const BRAND = 'dotto';
export const TAGLINE = 'The average person lasts 47 seconds on one screen.';
export const SUBLINE = 'Stare at the dot. See where you land.';

export const RULES: readonly string[] = [
  'Watch the dot.',
  'When it goes hollow, tap once. You get a moment, not a minute.',
  'Tap at any other time and you are out.',
  'Leave the screen and you are out.',
];

export const FAIL_HEADLINE: Record<FailReason, string> = {
  'tap-nothing': 'You tapped nothing.',
  'left-screen': 'You left.',
  'missed-probe': 'The dot called. You were not there.',
  quit: 'You walked away.',
};

export const FAIL_SUBLINE: Record<FailReason, string> = {
  'tap-nothing': 'The dot was solid. Nobody asked you to touch it.',
  'left-screen': 'Something else got your thumb first.',
  'missed-probe': 'It went hollow, waited, and gave up on you.',
  quit: 'The dot is still there.',
};

// tap before first probe ever appeared -> explain what probe looks like
export function failSubline(reason: FailReason, probesShown: number): string {
  if (reason === 'tap-nothing' && probesShown === 0) {
    return 'You never saw it go hollow. That is the only moment a tap counts — and it was coming.';
  }
  return FAIL_SUBLINE[reason];
}

export const PASS_HEADLINE = 'Clean.';
export const PASS_SUBLINE = 'The dot has nothing on you. Yet.';

export const PREDICT_QUESTION = 'How long do you think you can hold it?';
// states run gets raised to claimed length
export const PREDICT_SUB = 'Be honest.';

// both experiment arms get exactly one line, differing only in reference
export function appVerdict(
  survivedMs: number,
  predictedMs: number | null,
  retrospective: boolean,
): string {
  const held = formatDuration(survivedMs);
  if (predictedMs === null) {
    // benchmark comparison = study fact + run fact
    return `You held ${held}. The average person lasts 47 seconds.`;
  }
  const claim = retrospective ? 'In the beginning you said' : 'You said';
  return `${claim} ${formatDuration(predictedMs)}. You held ${held}.`;
}

// fake-door button, per-country price from pricing.ts appended
export function appCtaLabel(price: string): string {
  return `I want the app — ${price}`;
}

export const APP_PRICE_NOTE = 'One time. No subscription.';

// promises run history, never improvement
export const APP_HEADLINE = 'Five minutes a day.';
export const APP_PITCH = 'Make it a habit. One dot, every morning.';
// required while price displays
export const APP_NOT_OUT =
  'Not out yet — nothing was charged. You can play in the browser in the meantime.';

// changes sentence only, never link
export type ShareDirection = 'open' | 'back' | 'onward';

export interface ShareContext {
  readonly survivedMs: number;
  readonly percentile: number;
  // null = no claim made
  readonly predictedMs: number | null;
  // set on daily run -> number refers to shared daily dot
  readonly dayNumber: number | null;
  readonly direction: ShareDirection;
}

// ends on colon, link follows
export function shareMessage(ctx: ShareContext): string {
  const held = formatDuration(ctx.survivedMs);
  const anchor = `(avg person lasts ${Math.round(DWELL_MEAN_MS / 1000)}s)`;
  // only volley back names whose turn it is
  if (ctx.direction === 'back') return `Your move. Bet you won’t beat my ${held} ${anchor}:`;
  const opener = ctx.dayNumber === null ? 'Bet' : `${dailyShareLabel(ctx.dayNumber)} — bet`;
  return `${opener} you won’t last longer than my ${held} ${anchor}:`;
}

export function shareText(ctx: ShareContext, url: string): string {
  return `${shareMessage(ctx)} ${url}`;
}

// kept beside share copy -> shared string and on-screen label match
export function dailyShareLabel(dayNumber: number): string {
  return `${BRAND} #${dayNumber}`;
}

export const SHARE_LABEL: Record<ShareDirection, string> = {
  open: 'Dare a friend',
  back: 'Send it back',
  onward: 'Dare someone else',
};

export function dareHeadline(targetMs: number): string {
  return `Someone says you can’t hold ${formatDuration(targetMs)}.`;
}

// sole instruction on dare screen, keeps start button above fold
export const DARE_SUBLINE = 'Focus on the dot. Tap only when it goes hollow. Beat the number.';
export const DARE_ACCEPT = 'Take it';
export const DARE_DECLINE = 'Just play normally';

export function dareChainNote(chain: number): string | null {
  return chain >= 3 ? `Passed along ${chain} times before it reached you.` : null;
}

// shown to dared player in place of pass/fail subline
export function dareTargetLine(targetMs: number): string {
  return `The number to beat was ${formatDuration(targetMs)}.`;
}

export function dareVerdict(survivedMs: number, targetMs: number, beat: boolean): string {
  return beat
    ? `Beaten by ${formatDuration(survivedMs - targetMs)}.`
    : `${formatDuration(targetMs - survivedMs)} short.`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

// mm:ss -> fixed width in live countdown
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
