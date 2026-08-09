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

export const PASS_HEADLINE = 'Clean.';
export const PASS_SUBLINE = 'The dot has nothing on you. Yet.';

export const PREDICT_QUESTION = 'How long do you think you can hold it?';
// states run gets raised to claimed length
export const PREDICT_SUB = 'Be honest.';

// retrospective covers later runs
export function predictionVerdict(
  predictedMs: number,
  survivedMs: number,
  retrospective: boolean,
): string {
  const claim = retrospective ? 'In the beginning you said' : 'You said';
  return `${claim} ${formatDuration(predictedMs)}. You held ${formatDuration(survivedMs)}.`;
}

export const APP_CTA_LABEL = 'I want the app';
// promises run history, never improvement
export const APP_HEADLINE = 'Five minutes a day.';
export const APP_PITCH = 'Make it a habit. One dot, every morning.';
export const APP_NOT_OUT = 'Not out yet. You can play in the browser in the meantime.';

export function shareText(survivedMs: number, passed: boolean, url: string): string {
  const t = formatDuration(survivedMs);
  return passed
    ? `I held the dot for ${t}. The average person lasts 47 seconds. ${url}`
    : `I lasted ${t} staring at a dot. The average person lasts 47 seconds. ${url}`;
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
