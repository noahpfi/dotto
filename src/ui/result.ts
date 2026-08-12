import {
  BRAND,
  FAIL_HEADLINE,
  failSubline,
  PASS_HEADLINE,
  PASS_SUBLINE,
  SHARE_LABEL,
  type ShareDirection,
  dailyShareLabel,
  dareTargetLine,
  dareVerdict,
  formatDuration,
  appVerdict,
  shareText,
} from '../copy';
import { beatsDare, nextDare, buildDareUrl, type DareChallenge } from '../dare';
import { captureScreen, shareCardFilename } from '../sharecard';
import type { AttemptResult } from '../engine/types';
import { MAX_LEVEL_ID, isDailyLevel, levelById } from '../levels';
import { fetchLevelStats } from '../stats';
import { track } from '../track';
import { el } from './dom';
import { createScale } from './scale';
import { DWELL_MODEL_NOTE, benchmarkAhead, benchmarkCleared, dwellPercentile } from '../benchmarks';
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
  readonly dayNumber: number | null;
  readonly dare: DareChallenge | null;
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

  // portrait order must stay number, chart, buttons, app, wordmark, sources
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
  // clearing level below dared time still = loss
  const beat = options.dare === null ? null : beatsDare(result.survivedMs, options.dare);
  block.appendChild(
    el(
      'h2',
      'max-w-xs text-2xl font-medium leading-snug text-bone',
      options.dare !== null && beat !== null
        ? dareVerdict(result.survivedMs, options.dare.targetMs, beat)
        : result.passed
          ? PASS_HEADLINE
          : FAIL_HEADLINE[result.reason ?? 'quit'],
    ),
  );
  block.appendChild(
    el(
      'p',
      'max-w-xs text-sm leading-relaxed text-bone/45',
      // dare target in subline -> saves vertical space
      options.dare !== null
        ? dareTargetLine(options.dare.targetMs)
        : result.passed
          ? PASS_SUBLINE
          : failSubline(result.reason ?? 'quit', result.probesShown),
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

  const predicted = getPrediction();
  const actions = el('div', 'flex w-full max-w-sm flex-col gap-2.5');
  const shareStatus = el('div', 'min-h-4 text-xs text-bone/40');
  const shareSource = result.passed ? 'result-pass' : 'result-fail';

  const cardLabel =
    options.dayNumber !== null && isDailyLevel(result.levelId)
      ? dailyShareLabel(options.dayNumber)
      : (level?.label ?? BRAND);

  // chain players get both reply + pass-on buttons
  const sendDare = async (direction: ShareDirection): Promise<void> => {
    const outgoing = nextDare(result.survivedMs, result.levelId, options.dayNumber, options.dare);
    const context = {
      survivedMs: result.survivedMs,
      percentile: dwellPercentile(result.survivedMs),
      predictedMs: predicted,
      dayNumber: options.dayNumber,
      direction,
    };
    // parseDare reads only target, level, chain, day
    const url = buildDareUrl(shareUrl(), outgoing, {
      passed: result.passed,
      reason: result.reason,
      probesShown: result.probesShown,
      answeringMs: options.dare === null ? null : options.dare.targetMs,
      direction,
    });
    const text = shareText(context, url);
    track('share_clicked', {
      source: shareSource,
      level_id: result.levelId,
      passed: result.passed,
      survived_ms: Math.round(result.survivedMs),
      direction,
      chain: outgoing.chain,
    });
    const done = (method: 'web-share' | 'clipboard'): void =>
      track('share_completed', { source: shareSource, method, direction, chain: outgoing.chain });

    if (typeof navigator.share === 'function') {
      // bare URL only -> receiving app builds preview from Open Graph tags
      void navigator
        .share({ url })
        .then(() => done('web-share'))
        .catch((err: unknown) => {
          // AbortError = player closed sheet, tracked apart from failures
          if (err instanceof DOMException && err.name === 'AbortError') {
            track('share_dismissed', { source: shareSource, direction });
            return;
          }
          console.warn('dotto: share failed, falling back to clipboard —', err);
          void copyToClipboard(text, shareStatus, shareSource, direction, outgoing.chain);
        });
      return;
    }
    void copyToClipboard(text, shareStatus, shareSource, direction, outgoing.chain);
  };

  const shareButton = (direction: ShareDirection, primary: boolean): HTMLButtonElement => {
    const button = el(
      'button',
      primary
        ? 'rounded-full bg-bone px-6 py-4 text-sm font-semibold text-ink active:scale-[0.99]'
        : 'rounded-full border border-bone/20 px-6 py-4 text-sm font-medium text-bone active:scale-[0.99]',
      SHARE_LABEL[direction],
    );
    button.type = 'button';
    button.addEventListener('click', () => void sendDare(direction));
    return button;
  };

  if (options.dare !== null) {
    actions.append(shareButton('back', true), shareButton('onward', false));
  } else {
    actions.appendChild(shareButton('open', true));
  }
  const retry = el(
    'button',
    'rounded-full border border-bone/20 px-6 py-4 text-sm font-medium text-bone active:scale-[0.99]',
    'Again',
  );
  retry.type = 'button';
  retry.addEventListener('click', handlers.onRetry);
  actions.appendChild(retry);
  actions.appendChild(shareStatus);

  // both exits in one row -> saves height
  const exits = el('div', 'flex w-full flex-row items-center justify-center gap-6');
  const saveImage = el('button', 'py-1 text-sm text-bone/40', 'Save image');
  saveImage.type = 'button';
  saveImage.addEventListener('click', () => {
    void downloadCard(root, cardLabel, shareStatus, shareSource);
  });
  const home = el('button', 'py-1 text-sm text-bone/40', 'All levels');
  home.type = 'button';
  home.addEventListener('click', handlers.onHome);
  exits.append(saveImage, home);
  actions.appendChild(exits);

  paneB.appendChild(actions);

  // below buttons -> Again stays above fold on 600px screens
  if (result.passed && result.levelId < MAX_LEVEL_ID) {
    const next = levelById(result.levelId + 1);
    if (next !== null) paneB.appendChild(el('p', 'text-sm text-bone/60', `${next.label} is open.`));
  }

  // app card below buttons -> share button stays above fold on phones
  paneB.appendChild(
    createAppSection(result.passed ? 'result-pass' : 'result-fail', {
      verdict: appVerdict(result.survivedMs, predicted, options.retrospectivePrediction),
      survivedMs: result.survivedMs,
      ...(predicted !== null ? { predictedMs: predicted } : {}),
    }),
  );

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

// saves screen as file, shows failure on screen
async function downloadCard(
  node: HTMLElement,
  label: string,
  status: HTMLElement,
  source: string,
): Promise<void> {
  const blob = await captureScreen(node);
  if (blob === null) {
    status.textContent = 'This browser will not draw the image.';
    track('image_saved', { source, ok: false });
    return;
  }
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = shareCardFilename(label);
  link.click();
  // sync revoke races Safari download
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  status.textContent = 'Saved.';
  track('image_saved', { source, ok: true });
}

async function copyToClipboard(
  text: string,
  status: HTMLElement,
  source: string,
  direction: ShareDirection,
  chain: number,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied. Go ruin someone else’s day.';
    track('share_completed', { source, method: 'clipboard', direction, chain });
  } catch (err) {
    console.warn('dotto: clipboard write failed —', err);
    status.textContent = text;
    track('share_failed', { source });
  }
}
