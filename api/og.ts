import { ImageResponse } from '@vercel/og';
import { INTER_400, INTER_600 } from '../lib/fonts/inter';

// edge disallows resvg wasm -> card renders on Node runtime
export const config = { runtime: 'nodejs' };

// declared locally -> keeps @types/node globals out of browser-only codebase
// edge runtime lacks Buffer
function toBase64(input: string): string {
  return btoa(input);
}

function fromBase64(input: string): ArrayBuffer {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Satori has no system fonts
const FONTS = [
  { name: 'Inter', data: decodeFont(INTER_400), weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: decodeFont(INTER_600), weight: 600 as const, style: 'normal' as const },
];

function decodeFont(base64: string): ArrayBuffer {
  return fromBase64(base64);
}

const INK = '#08080a';
const BONE = '#f4f4ef';
const BLOOD = '#ff3b30';

// 1.91:1 -> WhatsApp, iMessage, Twitter render uncropped
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// mirrors src/benchmarks.ts
const DWELL_MEAN_MS = 47_000;
const DWELL_MEDIAN_S = 40;
const DWELL_MEAN_S = 47;
const MU = Math.log(DWELL_MEDIAN_S);
const SIGMA = Math.sqrt(2 * (Math.log(DWELL_MEAN_S) - MU));

// mirrors src/copy.ts
export const FAIL_HEADLINE: Record<string, string> = {
  'tap-nothing': 'You tapped nothing.',
  'left-screen': 'You left.',
  'missed-probe': 'The dot called. You were not there.',
  quit: 'You walked away.',
};
export const FAIL_SUBLINE: Record<string, string> = {
  'tap-nothing': 'The dot was solid. Nobody asked you to touch it.',
  'left-screen': 'Something else got your thumb first.',
  'missed-probe': 'It went hollow, waited, and gave up on you.',
  quit: 'The dot is still there.',
};
export const NEVER_SAW_PROBE =
  'You never saw it go hollow. That is the only moment a tap counts — and it was coming.';
export const PASS_HEADLINE = 'Clean.';
export const PASS_SUBLINE = 'The dot has nothing on you. Yet.';
export const REASON_CODES: readonly string[] = [
  'tap-nothing',
  'left-screen',
  'missed-probe',
  'quit',
];

// Abramowitz & Stegun 7.1.26
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

export function dwellPercentile(ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(((1 + erf((Math.log(ms / 1000) - MU) / (SIGMA * Math.SQRT2))) / 2) * 100);
}

function dwellDensity(seconds: number): number {
  if (seconds <= 0) return 0;
  const z = (Math.log(seconds) - MU) / SIGMA;
  return Math.exp(-0.5 * z * z) / (seconds * SIGMA * Math.sqrt(2 * Math.PI));
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function dareVerdict(survivedMs: number, targetMs: number): string {
  return survivedMs > targetMs
    ? `Beaten by ${formatDuration(survivedMs - targetMs)}.`
    : `${formatDuration(targetMs - survivedMs)} short.`;
}

// mirrors src/ui/scale.ts geometry = same viewBox, log axis, ticks
const CHART = { w: 320, h: 122, padX: 14, baseY: 84, topY: 16, minS: 4, maxS: 1800 };
const AXIS_TICKS_MS: readonly number[] = [10_000, 30_000, 60_000, 300_000, 900_000];

function xForMs(ms: number): number {
  const s = Math.max(CHART.minS, Math.min(ms / 1000, CHART.maxS));
  const t = (Math.log(s) - Math.log(CHART.minS)) / (Math.log(CHART.maxS) - Math.log(CHART.minS));
  return CHART.padX + t * (CHART.w - CHART.padX * 2);
}

// rendered chart size on card + scale from scale.ts viewBox units
const CHART_W = 540;
const CHART_SCALE = CHART_W / CHART.w;
const CHART_H = Math.round(CHART.h * CHART_SCALE);

// Satori has no cascade, resvg drops <text>
export function chartSvg(survivedMs: number, passed: boolean): string {
  const mark = passed ? BONE : BLOOD;
  const samples: { x: number; y: number }[] = [];
  const steps = 96;
  for (let i = 0; i <= steps; i += 1) {
    const s = Math.exp(
      Math.log(CHART.minS) + (i / steps) * (Math.log(CHART.maxS) - Math.log(CHART.minS)),
    );
    samples.push({ x: xForMs(s * 1000), y: dwellDensity(s) });
  }
  const peak = Math.max(...samples.map((p) => p.y), Number.EPSILON);
  const points = samples
    .map(
      (p) =>
        `${p.x.toFixed(1)},${(CHART.baseY - (p.y / peak) * (CHART.baseY - CHART.topY)).toFixed(1)}`,
    )
    .join(' ');

  const ticks = AXIS_TICKS_MS.map((ms) => {
    const x = xForMs(ms).toFixed(1);
    return `<line x1="${x}" x2="${x}" y1="${CHART.baseY - 4}" y2="${CHART.baseY + 4}" stroke="${BONE}" stroke-width="1" opacity="0.25"/>`;
  }).join('');

  const avgX = xForMs(DWELL_MEAN_MS).toFixed(1);
  const youX = xForMs(survivedMs);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART.w} ${CHART.h}" width="${CHART.w}" height="${CHART.h}">` +
    `<polygon points="${CHART.padX},${CHART.baseY} ${points} ${CHART.w - CHART.padX},${CHART.baseY}" fill="${BONE}" opacity="0.1"/>` +
    `<polyline points="${points}" fill="none" stroke="${BONE}" stroke-width="1.5" opacity="0.4"/>` +
    `<line x1="${CHART.padX}" x2="${CHART.w - CHART.padX}" y1="${CHART.baseY}" y2="${CHART.baseY}" stroke="${BONE}" stroke-width="1" opacity="0.2"/>` +
    ticks +
    `<line x1="${avgX}" x2="${avgX}" y1="${CHART.topY + 4}" y2="${CHART.baseY}" stroke="${BONE}" stroke-width="1" opacity="0.5" stroke-dasharray="3 3"/>` +
    `<line x1="${youX.toFixed(1)}" x2="${youX.toFixed(1)}" y1="${CHART.topY - 2}" y2="${CHART.baseY}" stroke="${mark}" stroke-width="2"/>` +
    `<circle cx="${youX.toFixed(1)}" cy="${CHART.baseY}" r="4" fill="${mark}"/>` +
    `</svg>`
  );
}

// label centred on chart x in viewBox units, drawn over rasterised SVG
function chartLabel(viewBoxX: number, viewBoxY: number, content: string, style: Record<string, unknown>): Node {
  const width = 120;
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'absolute',
        left: `${viewBoxX * CHART_SCALE - width / 2}px`,
        top: `${viewBoxY * CHART_SCALE}px`,
        width: `${width}px`,
        justifyContent: 'center',
        ...style,
      },
      children: content,
    },
  };
}

// chart + labels resvg cannot draw, positioned on same log axis
export function chartBlock(survivedMs: number, passed: boolean): Node {
  const mark = passed ? BONE : BLOOD;
  const chart = `data:image/svg+xml;base64,${toBase64(chartSvg(survivedMs, passed))}`;
  const youX = Math.min(
    Math.max(xForMs(survivedMs), CHART.padX + 10),
    CHART.w - CHART.padX - 10,
  );
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        position: 'relative',
        width: `${CHART_W}px`,
        height: `${CHART_H}px`,
      },
      children: [
        { type: 'img', props: { src: chart, width: CHART_W, height: CHART_H } },
        ...AXIS_TICKS_MS.map((ms) =>
          chartLabel(xForMs(ms), CHART.baseY + 8, formatDuration(ms), {
            fontSize: 15,
            color: 'rgba(244,244,239,0.4)',
          }),
        ),
        chartLabel(xForMs(DWELL_MEAN_MS), CHART.topY - 9, `avg ${formatDuration(DWELL_MEAN_MS)}`, {
          fontSize: 14,
          color: 'rgba(244,244,239,0.5)',
        }),
        chartLabel(youX, CHART.topY - 18, 'you', { fontSize: 16, color: mark }),
      ],
    },
  };
}

export interface CardState {
  readonly survivedMs: number;
  readonly passed: boolean;
  readonly reason: string | null;
  readonly probesShown: number;
  // target sender was answering when in chain
  readonly answeringMs: number | null;
}

export function headlineFor(state: CardState): string {
  if (state.answeringMs !== null) return dareVerdict(state.survivedMs, state.answeringMs);
  if (state.passed) return PASS_HEADLINE;
  return FAIL_HEADLINE[state.reason ?? 'quit'] ?? FAIL_HEADLINE.quit ?? '';
}

export function sublineFor(state: CardState): string {
  if (state.answeringMs !== null) {
    return `The number to beat was ${formatDuration(state.answeringMs)}.`;
  }
  if (state.passed) return PASS_SUBLINE;
  const reason = state.reason ?? 'quit';
  if (reason === 'tap-nothing' && state.probesShown === 0) return NEVER_SAW_PROBE;
  return FAIL_SUBLINE[reason] ?? FAIL_SUBLINE.quit ?? '';
}

interface Node {
  type: string;
  props: Record<string, unknown>;
}

const text = (content: string, style: Record<string, unknown>): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: content },
});

// Satori tree as plain objects, laid out like .split grid in style.css
export function cardTree(state: CardState): Node {
  const number = formatDuration(state.survivedMs);
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: INK,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter',
        padding: '30px 60px',
      },
      children: [
        // number + chart share top row, ranking spans full width below
        {
          type: 'div',
          props: {
            // widest case = 5-char duration beside chart, needs 1030 of 1080 usable px
            style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '90px' },
            children: [
              text(number, {
                fontSize: number.length > 4 ? 150 : 190,
                fontWeight: 600,
                color: state.passed ? BONE : BLOOD,
                lineHeight: 1,
                letterSpacing: '-7px',
              }),
              chartBlock(state.survivedMs, state.passed),
            ],
          },
        },
        text(`Longer than ${dwellPercentile(state.survivedMs)}% of measured screen-dwell times.`, {
          fontSize: 38,
          color: BONE,
          marginTop: '34px',
          textAlign: 'center',
        }),
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '26px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    width: '16px',
                    height: '16px',
                    borderRadius: '8px',
                    background: 'rgba(244,244,239,0.45)',
                  },
                },
              },
              text('dotto', { fontSize: 32, color: 'rgba(244,244,239,0.45)' }),
            ],
          },
        },
      ],
    },
  };
}

function readInt(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && Number.isInteger(value) ? value : null;
}

const MAX_TARGET_MS = 2 * 60 * 60 * 1000;

// parses sender screen from dare URL, per-field fallback on invalid input
export function stateFrom(url: URL): CardState {
  const clamp = (ms: number | null): number | null =>
    ms === null ? null : Math.min(Math.max(0, ms), MAX_TARGET_MS);
  const reasonCode = readInt(url.searchParams, 'r');
  const answering = clamp(readInt(url.searchParams, 't'));
  return {
    survivedMs: clamp(readInt(url.searchParams, 'd')) ?? 0,
    passed: url.searchParams.get('p') === '1',
    reason:
      reasonCode !== null && reasonCode >= 0 && reasonCode < REASON_CODES.length
        ? (REASON_CODES[reasonCode] ?? null)
        : null,
    probesShown: Math.max(0, readInt(url.searchParams, 'v') ?? 1),
    answeringMs: answering,
  };
}

// clamps out-of-range input, crawler error = no card
export function renderCard(url: URL): ImageResponse {
  return new ImageResponse(cardTree(stateFrom(url)) as unknown as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: FONTS,
    headers: {
      // query string encodes whole screen -> response immutable per URL
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

// full render awaited -> stream failure falls back to static image
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    const bytes = await renderCard(url).arrayBuffer();
    if (bytes.byteLength === 0) throw new Error('renderer produced no bytes');
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // error text as 500 only when x-dotto-debug header set
    if (request.headers.get('x-dotto-debug') === '1') {
      return new Response(message, { status: 500, headers: { 'content-type': 'text/plain' } });
    }
    return Response.redirect(new URL('/og.png', url.origin).toString(), 302);
  }
}
