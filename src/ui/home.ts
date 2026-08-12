import { isPostHogEnabled as isAnalyticsOn } from '../analytics/posthog';
import { BENCHMARKS, FABRICATED_STAT_NOTE } from '../benchmarks';
import { BRAND, RULES, SUBLINE, TAGLINE, dailyShareLabel, formatDuration } from '../copy';
import { DAILY_LEVEL, LEVELS } from '../levels';
import { playedDaily, type SaveData } from '../storage';
import { el } from './dom';
import { createAppSection } from './appcta';

export interface HomeHandlers {
  readonly onStart: (levelId: number) => void;
  readonly onStartDaily: () => void;
  // no wake lock -> long levels get cut by auto-lock
  readonly wakeLockUnsupported: boolean;
}

export interface HomeContext {
  readonly dayNumber: number;
  readonly streak: number;
}

function createDailyCard(
  save: SaveData,
  context: HomeContext,
  handlers: HomeHandlers,
): HTMLElement {
  const done = playedDaily(save, context.dayNumber);
  const best = save.dailyBest[String(context.dayNumber)];
  const card = el(
    'button',
    'flex w-full max-w-sm flex-row items-center justify-between rounded-2xl border px-5 py-4 text-left ' +
      'transition border-bone/30 bg-bone/[0.04] text-bone hover:border-bone/50 active:scale-[0.99]',
  );
  card.type = 'button';

  const left = el('div', 'flex flex-col');
  left.appendChild(el('span', 'text-base font-medium', dailyShareLabel(context.dayNumber)));

  const detail: string[] = [];
  if (done && best !== undefined) {
    detail.push(`today ${formatDuration(best)}`);
  } else {
    detail.push(`${formatDuration(DAILY_LEVEL.durationMs)} · same for everyone`);
  }
  if (context.streak >= 2) detail.push(`${context.streak} day streak`);
  left.appendChild(el('span', 'text-xs text-bone/40', detail.join(' · ')));

  card.appendChild(left);
  card.appendChild(
    el(
      'span',
      'font-mono text-xs tracking-widest text-bone/40',
      done ? 'AGAIN' : 'PLAY',
    ),
  );
  card.addEventListener('click', handlers.onStartDaily);
  return card;
}

export function createHome(
  save: SaveData,
  context: HomeContext,
  handlers: HomeHandlers,
): HTMLElement {
  const root = el(
    'div',
    'short-tight min-h-dvh w-full overflow-y-auto bg-ink px-6 py-[max(2rem,env(safe-area-inset-top))] ' +
      'flex flex-col items-center justify-center gap-9',
  );

  // source order = phone layout
  const split = el('div', 'split gap-9');
  const paneA = el('div', 'split-a gap-9');
  const paneB = el('div', 'split-b gap-9');
  split.append(paneA, paneB);
  root.appendChild(split);

  const header = el('div', 'flex flex-col items-center gap-4 pt-6');
  header.appendChild(el('div', 'dot dot--small'));
  header.appendChild(el('h1', 'text-4xl font-semibold lowercase tracking-tight text-bone', BRAND));
  header.appendChild(el('p', 'max-w-xs text-center text-lg leading-snug text-bone', TAGLINE));
  header.appendChild(el('p', 'max-w-xs text-center text-sm text-bone/45', SUBLINE));
  paneA.appendChild(header);

  const rules = el('ol', 'w-full max-w-sm space-y-2.5 text-sm leading-relaxed text-bone/60');
  for (const [i, rule] of RULES.entries()) {
    const li = el('li', 'flex flex-row gap-3');
    li.appendChild(el('span', 'w-4 shrink-0 text-right font-mono text-xs text-bone/25', String(i + 1)));
    li.appendChild(el('span', '', rule));
    rules.appendChild(li);
  }
  paneA.appendChild(rules);

  // daily above ladder, only item tied to today
  paneB.appendChild(createDailyCard(save, context, handlers));

  const grid = el('div', 'w-full max-w-sm space-y-2');
  for (const [index, level] of LEVELS.entries()) {
    const unlocked = level.id <= save.unlockedLevel;
    const previous = LEVELS[index - 1];
    const best = save.best[String(level.id)];
    const button = el(
      'button',
      'flex w-full flex-row items-center justify-between rounded-2xl border px-5 py-4 text-left transition ' +
        (unlocked
          ? 'border-bone/15 text-bone hover:border-bone/40 active:scale-[0.99]'
          : 'border-bone/5 text-bone/25'),
    );
    button.type = 'button';
    button.disabled = !unlocked;

    // rungs matching published figure get labelled
    const marker = BENCHMARKS.find((b) => Math.abs(b.ms - level.durationMs) <= 5000);
    const left = el('div', 'flex flex-col');
    left.appendChild(el('span', 'text-base font-medium', level.label));
    left.appendChild(
      el(
        'span',
        'text-xs text-bone/35',
        unlocked
          ? best !== undefined
            ? `best ${formatDuration(best)}`
            : marker !== undefined
              ? `past ${marker.label}`
              : 'not attempted'
          : previous !== undefined
            ? `clear ${previous.label} first`
            : 'locked',
      ),
    );
    button.appendChild(left);
    button.appendChild(
      el('span', 'font-mono text-xs tracking-widest text-bone/30', unlocked ? 'START' : 'LOCKED'),
    );

    if (unlocked) button.addEventListener('click', () => handlers.onStart(level.id));
    grid.appendChild(button);
  }
  paneB.appendChild(grid);

  if (handlers.wakeLockUnsupported) {
    paneB.appendChild(
      el(
        'p',
        'max-w-sm text-center text-xs leading-relaxed text-bone/30',
        'This browser will not let the page keep your screen awake. Turn off auto-lock before the long levels, or it will end your run for you.',
      ),
    );
  }

  if (save.attempts > 0) paneB.appendChild(createAppSection('home'));

  // grid tucks it under pitch on two-column layout
  const footnote = el('div', 'split-foot footnote w-full max-w-sm pb-[max(1.5rem,env(safe-area-inset-bottom))]');
  footnote.appendChild(
    el('p', 'text-center text-xs leading-relaxed text-bone/30', FABRICATED_STAT_NOTE),
  );
  // GDPR Art 13 notice, accurate only while posthog.ts stays cookieless and EU-hosted
  footnote.appendChild(
    el(
      'p',
      'mt-2 text-center text-[10px] leading-relaxed text-bone/20',
      `${BENCHMARKS[0]?.source ?? ''} · dotto is a game · ` +
        (isAnalyticsOn()
          ? 'Anonymous EU-hosted analytics, no cookies, no account. Your progress stays on this device.'
          : 'No tracking, no account. Your progress stays on this device.'),
    ),
  );
  split.appendChild(footnote);

  return root;
}
