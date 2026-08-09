import { PREDICT_QUESTION, PREDICT_SUB } from '../copy';
import { PREDICTION_CHOICES } from '../prediction';
import { el } from './dom';

// six options fit small phones without scroll
export function createPredict(onAnswer: (ms: number) => void): HTMLElement {
  const root = el(
    'div',
    'short-tight flex min-h-dvh w-full flex-col items-center justify-center gap-7 overflow-y-auto bg-ink ' +
      'px-6 py-[max(2rem,env(safe-area-inset-top))]',
  );

  const head = el('div', 'flex w-full max-w-sm flex-col gap-2');
  head.appendChild(
    el(
      'h2',
      'text-3xl font-medium leading-tight tracking-tight text-bone [@media(max-height:620px)]:text-2xl',
      PREDICT_QUESTION,
    ),
  );
  head.appendChild(el('p', 'text-sm leading-relaxed text-bone/40', PREDICT_SUB));
  root.appendChild(head);

  const list = el('div', 'choice-grid max-w-sm [@media(min-width:700px)]:max-w-2xl');
  for (const choice of PREDICTION_CHOICES) {
    const button = el(
      'button',
      'w-full rounded-2xl border border-bone/12 px-5 py-3.5 text-left text-base font-medium ' +
        'text-bone transition hover:border-bone/40 active:scale-[0.99]',
      choice.label,
    );
    button.type = 'button';
    button.addEventListener('click', () => onAnswer(choice.ms));
    list.appendChild(button);
  }
  root.appendChild(list);

  return root;
}
