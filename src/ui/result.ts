import {
  BRAND,
  FAIL_HEADLINE,
  failSubline,
  PASS_HEADLINE,
  PASS_SUBLINE,
  formatDuration,
  appVerdict,
  shareText,
} from '../copy';
import type { AttemptResult } from '../engine/types';
import { MAX_LEVEL_ID, levelById } from '../levels';
import { fetchLevelStats } from '../stats';
import { track } from '../track';
import { el } from './dom';
import { createScale } from './scale';
import { DWELL_MODEL_NOTE, benchmarkAhead, benchmarkCleared } from '../benchmarks';
import { getPrediction } from '../prediction';
import { createAppSection } from './appcta';
import { envOr } from '../analytics/env';

export interface ResultHandlers {
  readonly onRetry: () => void;
  readonly onHome: () => void;
}

export interface ResultOptions {
  // true for every run except one session prediction was made for
  readonly retrospectivePrediction: boolean;
}

function shareUrl(): string {
  const configured = envOr(import.meta.env.VITE_SHARE_URL, '');
  return configured !== '' ? configured : window.location.origin;
}

// fail screen centres on one big number vs published figure
export function createResult(
  result: AttemptResult,
  handlers: ResultHandlers,
  options: ResultOptions,
): HTMLElement {
  const level = levelById(result.levelId);
  const root = el(
    'div',
    'short-tight min-h-dvh w-full overflow-y-auto bg-ink px-6 py-[max(2rem,env(safe-area-inset-top))] ' +
      'flex flex-col items-center justify-center gap-7 text-center',
  );

  // portrait order must stay number, chart, meta, app, buttons, wordmark, sources
  const split = el('div', 'split gap-7');
  const paneA = el('div', 'split-a gap-7');
  const paneB = el('div', 'split-b gap-7');
  split.append(paneA, paneB);
  root.appendChild(split);

  const block = el('div', 'flex flex-col items-center gap-3');
  block.appendChild(
    el(
      'div',
      'display-number text-[clamp(4.5rem,26vw,10rem)] font-semibold leading-none tracking-tighter ' +
        (result.passed ? 'text-bone' : 'text-blood'),
      formatDuration(result.survivedMs),
    ),
  );
  block.appendChild(
    el(
      'h2',
      'max-w-xs text-2xl font-medium leading-snug text-bone',
      result.passed ? PASS_HEADLINE : FAIL_HEADLINE[result.reason ?? 'quit'],
    ),
  );
  block.appendChild(
    el(
      'p',
      'max-w-xs text-sm leading-relaxed text-bone/45',
      result.passed ? PASS_SUBLINE : failSubline(result.reason ?? 'quit', result.probesShown),
    ),
  );
  paneA.appendChild(block);

  // starts on benchmark view, upgrades in place once stats endpoint has enough runs
  const scaleSlot = el('div', 'w-full max-w-sm text-bone');
  scaleSlot.appendChild(createScale(result, null));
  paneA.appendChild(scaleSlot);
  void fetchLevelStats(result.levelId).then((stats) => {
    if (stats === null || !scaleSlot.isConnected) return;
    scaleSlot.replaceChildren(createScale(result, stats));
  });

  const meta = el(
    'div',
    'flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-bone/30',
  );
  meta.appendChild(el('span', '', level !== null ? level.label : `level ${result.levelId}`));
  meta.appendChild(el('span', '', `${result.probesHit}/${result.probesShown} tapped`));
  paneB.appendChild(meta);

  if (result.passed && result.levelId < MAX_LEVEL_ID) {
    const next = levelById(result.levelId + 1);
    if (next !== null) paneB.appendChild(el('p', 'text-sm text-bone/60', `${next.label} is open.`));
  }

  // app card above buttons, next to number contradicting player's prediction
  const predicted = getPrediction();
  paneB.appendChild(
    createAppSection(result.passed ? 'result-pass' : 'result-fail', {
      verdict: appVerdict(result.survivedMs, predicted, options.retrospectivePrediction),
      survivedMs: result.survivedMs,
      ...(predicted !== null ? { predictedMs: predicted } : {}),
    }),
  );

  const actions = el('div', 'flex w-full max-w-sm flex-col gap-2.5');
  const share = el(
    'button',
    'rounded-full bg-bone px-6 py-4 text-sm font-semibold text-ink active:scale-[0.99]',
    result.passed ? 'Share it' : 'Share your fail',
  );
  share.type = 'button';
  const shareStatus = el('div', 'min-h-4 text-xs text-bone/40');
  const shareSource = result.passed ? 'result-pass' : 'result-fail';
  share.addEventListener('click', () => {
    const text = shareText(result.survivedMs, result.passed, shareUrl());
    track('share_clicked', {
      source: shareSource,
      level_id: result.levelId,
      passed: result.passed,
      survived_ms: Math.round(result.survivedMs),
    });
    if (typeof navigator.share === 'function') {
      void navigator
        .share({ title: BRAND, text })
        .then(() => track('share_completed', { source: shareSource, method: 'web-share' }))
        .catch((err: unknown) => {
          // AbortError = player closed sheet, tracked apart from failures
          if (err instanceof DOMException && err.name === 'AbortError') {
            track('share_dismissed', { source: shareSource });
            return;
          }
          console.warn('dotto: share failed, falling back to clipboard —', err);
          void copyToClipboard(text, shareStatus, shareSource);
        });
      return;
    }
    void copyToClipboard(text, shareStatus, shareSource);
  });
  actions.append(share, shareStatus);

  const retry = el(
    'button',
    'rounded-full border border-bone/20 px-6 py-4 text-sm font-medium text-bone active:scale-[0.99]',
    'Again',
  );
  retry.type = 'button';
  retry.addEventListener('click', handlers.onRetry);

  const home = el('button', 'px-6 py-2 text-sm text-bone/40', 'All levels');
  home.type = 'button';
  home.addEventListener('click', handlers.onHome);

  actions.append(retry, home);
  paneB.appendChild(actions);

  // wordmark on screenshot -> shared image points somewhere
  const mark = el('div', 'flex flex-row items-center gap-2 pt-2');
  mark.appendChild(el('span', 'size-2 rounded-full bg-bone/40'));
  mark.appendChild(el('span', 'text-sm lowercase tracking-tight text-bone/40', BRAND));
  paneB.appendChild(mark);

  // two-column grid puts sources under chart
  const cite = benchmarkCleared(result.survivedMs) ?? benchmarkAhead(result.survivedMs);
  const footnote = el('div', 'split-foot footnote max-w-sm pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4');
  if (cite !== null) {
    footnote.appendChild(el('p', 'text-center text-[10px] text-bone/20', cite.source));
  }
  footnote.appendChild(
    el('p', 'mt-1 text-center text-[10px] leading-relaxed text-bone/20', DWELL_MODEL_NOTE),
  );
  split.appendChild(footnote);

  return root;
}

async function copyToClipboard(text: string, status: HTMLElement, source: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied. Go ruin someone else’s day.';
    track('share_completed', { source, method: 'clipboard' });
  } catch (err) {
    console.warn('dotto: clipboard write failed —', err);
    status.textContent = text;
    track('share_failed', { source });
  }
}
