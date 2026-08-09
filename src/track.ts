import type { DottoEventName, PropsFor } from './analytics/events';
import { initPixel, isPixelConfigured, trackPixel } from './analytics/pixel';
import { capturePostHog, initPostHog, isPostHogEnabled } from './analytics/posthog';

const BEACON = import.meta.env['VITE_TRACK_ENDPOINT'] as string | undefined;

// single funnel -> PostHog + optional beacon, only events from analytics/events.ts
export function track<N extends DottoEventName>(name: N, props: PropsFor<N>): void {
  capturePostHog(name, props as Record<string, unknown>);
  sendBeacon(name, props as Record<string, unknown>);

  // Meta gets only fake-door tap, pixel-permitted countries only
  if (name === 'app_intent') trackPixel('Lead');
}

// call once at startup
export function initAnalytics(): void {
  if (isPostHogEnabled()) void initPostHog();
  if (isPixelConfigured()) void initPixel();
}

function sendBeacon(name: string, props: Record<string, unknown>): void {
  if (BEACON === undefined || BEACON === '') return;
  const body = JSON.stringify({ event: name, ts: Date.now(), ...props });
  try {
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(BEACON, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(BEACON, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    }).catch((err: unknown) => console.warn('dotto: beacon failed —', err));
  } catch (err) {
    console.warn('dotto: beacon failed —', err);
  }
}
