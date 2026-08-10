// pre-run prediction, per session, reused across that visit's levels
const KEY = 'dotto.prediction';
const ARM_KEY = 'dotto.predictionArm';

// sticky per-session coin flip -> ask to predict or skip, A/B test
export type PredictionArm = 'ask' | 'skip';

function coinFlip(): PredictionArm {
  return Math.random() < 0.5 ? 'ask' : 'skip';
}

// storage failure -> fresh flip
export function getPredictionArm(): PredictionArm {
  try {
    const stored = sessionStorage.getItem(ARM_KEY);
    if (stored === 'ask' || stored === 'skip') return stored;
    const arm = coinFlip();
    sessionStorage.setItem(ARM_KEY, arm);
    return arm;
  } catch (err) {
    console.warn('dotto: sessionStorage unavailable, prediction arm will not persist —', err);
    return coinFlip();
  }
}

// every value after first must match level length
export const PREDICTION_CHOICES: readonly { readonly ms: number; readonly label: string }[] = [
  { ms: 30_000, label: 'Under a minute' },
  { ms: 60_000, label: '1:00' },
  { ms: 150_000, label: '2:30' },
  { ms: 300_000, label: '5:00' },
  { ms: 600_000, label: '10 minutes' },
  { ms: 1_200_000, label: '20 minutes' },
];

export function getPrediction(): number | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch (err) {
    console.warn('dotto: sessionStorage unavailable, prediction will not persist —', err);
    return null;
  }
  if (raw === null) return null;
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) {
    console.warn('dotto: stored prediction was unusable and has been dropped');
    return null;
  }
  return ms;
}

export function setPrediction(ms: number): void {
  try {
    sessionStorage.setItem(KEY, String(ms));
  } catch (err) {
    console.warn('dotto: could not store prediction —', err);
  }
}
