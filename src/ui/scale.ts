import {
  BENCHMARKS,
  DWELL_MEAN_MS,
  benchmarkAhead,
  benchmarkCleared,
  dwellDensity,
  dwellPercentile,
} from '../benchmarks';
import { formatDuration } from '../copy';
import type { AttemptResult } from '../engine/types';
import { playerBand, type LevelStats } from '../stats';
import { el } from './dom';

const W = 320;
const H = 122;
const PAD_X = 14;
const BASE_Y = 84;
const TOP_Y = 16;

// dwell times span two orders of magnitude
const MIN_S = 4;
const MAX_S = 1800;

// ticks spaced for legibility at 9px on log axis
const AXIS_TICKS_MS: readonly number[] = [10_000, 30_000, 60_000, 300_000, 900_000];

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(NS, tag);
}

function attrs(node: SVGElement, map: Record<string, string | number>): void {
  for (const [k, v] of Object.entries(map)) node.setAttribute(k, String(v));
}

function xForMs(ms: number): number {
  const s = Math.max(MIN_S, Math.min(ms / 1000, MAX_S));
  const t = (Math.log(s) - Math.log(MIN_S)) / (Math.log(MAX_S) - Math.log(MIN_S));
  return PAD_X + t * (W - PAD_X * 2);
}

// layers Mark's modelled dwell distribution, player band once runs exist, own result
export function createScale(result: AttemptResult, stats: LevelStats | null): HTMLElement {
  const wrap = el('div', 'w-full max-w-sm text-bone');
  const svg = svgEl('svg');
  attrs(svg, { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img' });
  svg.setAttribute(
    'aria-label',
    `Your run of ${formatDuration(result.survivedMs)} against the published screen-dwell distribution`,
  );
  svg.classList.add('block');

  const samples: { x: number; y: number }[] = [];
  const steps = 96;
  for (let i = 0; i <= steps; i += 1) {
    const s = Math.exp(Math.log(MIN_S) + (i / steps) * (Math.log(MAX_S) - Math.log(MIN_S)));
    samples.push({ x: xForMs(s * 1000), y: dwellDensity(s) });
  }
  const peak = Math.max(...samples.map((p) => p.y), Number.EPSILON);
  const points = samples.map((p) => `${p.x.toFixed(1)},${(BASE_Y - (p.y / peak) * (BASE_Y - TOP_Y)).toFixed(1)}`);

  const area = svgEl('polygon');
  attrs(area, { points: `${PAD_X},${BASE_Y} ${points.join(' ')} ${W - PAD_X},${BASE_Y}`, fill: 'currentColor', opacity: 0.1 });
  svg.appendChild(area);

  const curve = svgEl('polyline');
  attrs(curve, { points: points.join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, opacity: 0.4 });
  svg.appendChild(curve);

  const axis = svgEl('line');
  attrs(axis, { x1: PAD_X, x2: W - PAD_X, y1: BASE_Y, y2: BASE_Y, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.2 });
  svg.appendChild(axis);

  const band = stats !== null ? playerBand(stats) : null;
  if (band !== null) {
    const x1 = xForMs(band.lowMs);
    const x2 = xForMs(band.highMs);
    const rect = svgEl('rect');
    attrs(rect, { x: x1, y: TOP_Y - 4, width: Math.max(2, x2 - x1), height: BASE_Y - TOP_Y + 4, fill: 'currentColor', opacity: 0.14, rx: 3 });
    svg.appendChild(rect);

    const mid = svgEl('line');
    attrs(mid, { x1: xForMs(band.medianMs), x2: xForMs(band.medianMs), y1: TOP_Y - 4, y2: BASE_Y, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.4, 'stroke-dasharray': '2 3' });
    svg.appendChild(mid);

    const tag = svgEl('text');
    attrs(tag, { x: (x1 + x2) / 2, y: TOP_Y - 8, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor', opacity: 0.45 });
    tag.textContent = 'dotto players';
    svg.appendChild(tag);
  }

  for (const ms of AXIS_TICKS_MS) {
    const x = xForMs(ms);
    const tick = svgEl('line');
    attrs(tick, { x1: x, x2: x, y1: BASE_Y - 4, y2: BASE_Y + 4, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.25 });
    svg.appendChild(tick);

    const label = svgEl('text');
    attrs(label, { x, y: BASE_Y + 18, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor', opacity: 0.4 });
    label.textContent = formatDuration(ms);
    svg.appendChild(label);
  }

  // average as dashed line above axis -> no collision with axis labels
  const average = BENCHMARKS.find((b) => b.ms === DWELL_MEAN_MS);
  if (average !== undefined) {
    const x = xForMs(average.ms);
    const line = svgEl('line');
    attrs(line, { x1: x, x2: x, y1: TOP_Y + 4, y2: BASE_Y, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.5, 'stroke-dasharray': '3 3' });
    svg.appendChild(line);

    const tag = svgEl('text');
    attrs(tag, { x, y: TOP_Y, 'text-anchor': 'middle', 'font-size': 9, fill: 'currentColor', opacity: 0.5 });
    tag.textContent = `avg ${formatDuration(average.ms)}`;
    svg.appendChild(tag);
  }

  const youX = xForMs(result.survivedMs);
  const stem = svgEl('line');
  attrs(stem, { x1: youX, x2: youX, y1: TOP_Y - 2, y2: BASE_Y, stroke: result.passed ? 'var(--color-bone)' : 'var(--color-blood)', 'stroke-width': 2 });
  svg.appendChild(stem);

  const head = svgEl('circle');
  attrs(head, { cx: youX, cy: BASE_Y, r: 4, fill: result.passed ? 'var(--color-bone)' : 'var(--color-blood)' });
  svg.appendChild(head);

  const youLabel = svgEl('text');
  attrs(youLabel, {
    x: Math.min(Math.max(youX, PAD_X + 10), W - PAD_X - 10),
    y: TOP_Y - 8,
    'text-anchor': 'middle',
    'font-size': 10,
    'font-weight': 600,
    fill: result.passed ? 'var(--color-bone)' : 'var(--color-blood)',
  });
  youLabel.textContent = 'you';
  svg.appendChild(youLabel);

  wrap.appendChild(svg);

  const pct = dwellPercentile(result.survivedMs);
  wrap.appendChild(
    el(
      'p',
      'mt-3 text-center text-sm leading-snug text-bone/70',
      `Longer than ${pct}% of measured screen-dwell times.`,
    ),
  );

  // modelling note renders at bottom of result screen in ui/result.ts
  const cite = benchmarkCleared(result.survivedMs) ?? benchmarkAhead(result.survivedMs);
  if (cite !== null) {
    wrap.appendChild(el('p', 'mt-2 text-center text-xs leading-relaxed text-bone/45', cite.line));
  }

  return wrap;
}
