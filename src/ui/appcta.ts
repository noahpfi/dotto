import { APP_CTA_LABEL, APP_HEADLINE, APP_PITCH, APP_NOT_OUT } from '../copy';
import { track } from '../track';
import { el } from './dom';
import { envOr } from '../analytics/env';

const ENDPOINT = envOr(import.meta.env.VITE_WAITLIST_ENDPOINT, '');

// endpoint does real validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function captureEnabled(): boolean {
  return ENDPOINT !== '';
}

export interface AppSectionOptions {
  readonly verdict?: string;
  // segments fake-door rate by run outcome
  readonly survivedMs?: number;
  readonly predictedMs?: number;
}

// email field renders only with configured endpoint
export function createAppSection(source: string, options: AppSectionOptions = {}): HTMLElement {
  const card = el(
    'section',
    'app-card flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-bone/12 bg-bone/[0.03] px-6 py-7',
  );

  if (options.verdict !== undefined) {
    card.appendChild(
      el('p', 'text-center text-base font-medium leading-snug text-bone', options.verdict),
    );
    card.appendChild(el('div', 'h-px w-10 bg-bone/15'));
  }

  card.appendChild(
    el('h3', 'text-center text-xl font-semibold leading-snug text-bone', APP_HEADLINE),
  );
  card.appendChild(el('p', 'text-center text-sm leading-relaxed text-bone/50', APP_PITCH));

  const button = el(
    'button',
    'w-full rounded-full bg-bone px-6 py-4 text-sm font-semibold text-ink active:scale-[0.99]',
    APP_CTA_LABEL,
  );
  button.type = 'button';
  const slot = el('div', 'w-full');

  button.addEventListener('click', () => {
    track('app_intent', {
      source,
      survived_ms: options.survivedMs === undefined ? null : Math.round(options.survivedMs),
      predicted_ms: options.predictedMs ?? null,
    });
    button.remove();
    slot.replaceChildren(
      captureEnabled() ? emailForm(source) : el('p', 'text-center text-sm text-bone/60', APP_NOT_OUT),
    );
  });

  card.append(button, slot);
  return card;
}

function emailForm(source: string): HTMLElement {
  const endpoint = ENDPOINT as string;
  const box = el('div', 'w-full');
  const form = el('form', 'flex gap-2');
  const input = el(
    'input',
    'min-w-0 flex-1 rounded-full border border-bone/15 bg-transparent px-4 py-3 text-sm ' +
      'text-bone placeholder:text-bone/30 outline-none focus:border-bone/40',
  );
  input.type = 'email';
  input.name = 'email';
  input.required = true;
  input.autocomplete = 'email';
  input.placeholder = 'you@email.com';

  const submit = el(
    'button',
    'rounded-full bg-bone px-5 py-3 text-sm font-semibold text-ink disabled:opacity-40',
    'Tell me',
  );
  submit.type = 'submit';

  const status = el('div', 'mt-2 min-h-5 text-center text-xs text-bone/40');
  form.append(input, submit);
  box.append(form, status);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!EMAIL_RE.test(email)) {
      status.className = 'mt-2 min-h-5 text-center text-xs text-blood';
      status.textContent = 'That is not an email address.';
      return;
    }
    submit.disabled = true;
    input.disabled = true;
    status.className = 'mt-2 min-h-5 text-center text-xs text-bone/40';
    status.textContent = 'Sending…';

    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, source }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`waitlist endpoint returned ${res.status}`);
        status.className = 'mt-2 min-h-5 text-center text-xs text-bone/60';
        status.textContent = 'Done. You will hear from the dot.';
        form.remove();
        track('waitlist_submitted', { source });
      })
      .catch((err: unknown) => {
        console.warn('dotto: waitlist submit failed —', err);
        submit.disabled = false;
        input.disabled = false;
        status.className = 'mt-2 min-h-5 text-center text-xs text-blood';
        status.textContent = 'That did not go through. Try again.';
        const status_code = err instanceof Error ? Number(/\d{3}/.exec(err.message)?.[0]) : Number.NaN;
        track('waitlist_failed', {
          source,
          status: Number.isFinite(status_code) ? status_code : null,
        });
      });
  });

  input.focus();
  return box;
}
