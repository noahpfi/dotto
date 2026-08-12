import {
  BRAND,
  DARE_ACCEPT,
  DARE_DECLINE,
  DARE_SUBLINE,
  dareChainNote,
  dareHeadline,
  dailyShareLabel,
  formatDuration,
} from '../copy';
import type { DareChallenge } from '../dare';
import { isDailyLevel, levelById } from '../levels';
import { el } from './dom';

export interface DareHandlers {
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

// target = largest element, small rules, start = sole primary action
export function createDare(dare: DareChallenge, handlers: DareHandlers): HTMLElement {
  const root = el(
    'div',
    'short-tight min-h-dvh w-full overflow-y-auto bg-ink px-6 py-[max(2rem,env(safe-area-inset-top))] ' +
      'flex flex-col items-center justify-center gap-8 text-center',
  );

  const header = el('div', 'flex flex-col items-center gap-4');
  header.appendChild(el('div', 'dot dot--small'));
  header.appendChild(el('span', 'text-sm lowercase tracking-tight text-bone/40', BRAND));
  root.appendChild(header);

  root.appendChild(
    el(
      'div',
      'display-number text-[clamp(4.5rem,26vw,10rem)] font-semibold leading-none tracking-tighter text-bone',
      formatDuration(dare.targetMs),
    ),
  );
  root.appendChild(
    el('h1', 'max-w-xs text-2xl font-medium leading-snug text-bone', dareHeadline(dare.targetMs)),
  );

  const level = levelById(dare.levelId);
  const context: string[] = [];
  if (dare.dayNumber !== null && isDailyLevel(dare.levelId)) {
    context.push(dailyShareLabel(dare.dayNumber));
  } else if (level !== null) {
    context.push(level.label);
  }
  const chainNote = dareChainNote(dare.chain);
  if (chainNote !== null) context.push(chainNote);
  if (context.length > 0) {
    root.appendChild(
      el(
        'p',
        'font-mono text-[11px] uppercase tracking-widest text-bone/30',
        context.join(' · '),
      ),
    );
  }

  root.appendChild(el('p', 'max-w-xs text-sm leading-relaxed text-bone/45', DARE_SUBLINE));

  const actions = el('div', 'flex w-full max-w-sm flex-col gap-2.5');
  const accept = el(
    'button',
    'rounded-full bg-bone px-6 py-4 text-sm font-semibold text-ink active:scale-[0.99]',
    DARE_ACCEPT,
  );
  accept.type = 'button';
  accept.addEventListener('click', handlers.onAccept);

  const decline = el('button', 'px-6 py-2 text-sm text-bone/40', DARE_DECLINE);
  decline.type = 'button';
  decline.addEventListener('click', handlers.onDecline);

  actions.append(accept, decline);
  root.appendChild(actions);

  return root;
}
