import { MAX_LEVEL_ID, levelById } from './levels';

// dare carried entirely in URL query as four integers, no server, account or storage
export interface DareChallenge {
  readonly targetMs: number;
  // 0 = daily
  readonly levelId: number;
  // hops travelled, starts at 1
  readonly chain: number;
  // set when dare came from daily run
  readonly dayNumber: number | null;
}

// anything longer = hand-edited
const MAX_TARGET_MS = 2 * 60 * 60 * 1000;
// longer values clamped
const MAX_CHAIN = 99;

const PARAM = { target: 'd', level: 'l', chain: 'n', day: 'day' } as const;

// parseDare ignores this key
const PREVIEW_PARAM = { direction: 'w' } as const;

export interface DarePreview {
  readonly direction: 'open' | 'back' | 'onward';
}

function readInt(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  // Number() rejects partially numeric values parseInt() accepts
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  return value;
}

export function parseDare(search: string): DareChallenge | null {
  const params = new URLSearchParams(search);
  const targetMs = readInt(params, PARAM.target);
  if (targetMs === null || targetMs < 0 || targetMs > MAX_TARGET_MS) return null;

  const levelId = readInt(params, PARAM.level);
  if (levelId === null || levelId < 0 || levelId > MAX_LEVEL_ID) return null;
  // rejects in-range level ids not playable
  if (levelById(levelId) === null) return null;

  const chain = readInt(params, PARAM.chain);
  const day = readInt(params, PARAM.day);

  return {
    targetMs,
    levelId,
    chain: chain === null ? 1 : Math.min(Math.max(1, chain), MAX_CHAIN),
    dayNumber: day !== null && day > 0 ? day : null,
  };
}

// Vercel applies rewrites after filesystem -> rewrite on / never fires
export const DARE_PATH = '/d';

// parses base, falls back to concatenation if VITE_SHARE_URL is not URL
export function buildDareUrl(base: string, dare: DareChallenge, preview: DarePreview): string {
  const query = new URLSearchParams();
  query.set(PARAM.target, String(Math.round(dare.targetMs)));
  query.set(PARAM.level, String(dare.levelId));
  query.set(PARAM.chain, String(Math.min(Math.max(1, Math.round(dare.chain)), MAX_CHAIN)));
  if (dare.dayNumber !== null) query.set(PARAM.day, String(dare.dayNumber));

  query.set(PREVIEW_PARAM.direction, preview.direction.charAt(0));

  try {
    const url = new URL(DARE_PATH, base);
    for (const [key, value] of query) url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return `${base.replace(/\/$/, '')}${DARE_PATH}?${query.toString()}`;
  }
}

// sent after run, player's time = next target
export function nextDare(
  survivedMs: number,
  levelId: number,
  dayNumber: number | null,
  previous: DareChallenge | null,
): DareChallenge {
  return {
    targetMs: Math.round(survivedMs),
    levelId,
    // every send incl volley back increments hop count
    chain: previous === null ? 1 : Math.min(previous.chain + 1, MAX_CHAIN),
    dayNumber,
  };
}

// ties go to challenger
export function beatsDare(survivedMs: number, dare: DareChallenge): boolean {
  return survivedMs > dare.targetMs;
}
