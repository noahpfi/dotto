import type { DottoEventName, PropsFor } from './analytics/events';
import { initPixel, isPixelConfigured, trackPixel, trackPixelCustom } from './analytics/pixel';
import {
  capturePostHog,
  getSuperProps,
  initPostHog,
  isPostHogEnabled,
  registerSuperProps,
} from './analytics/posthog';

const BEACON = import.meta.env['VITE_TRACK_ENDPOINT'] as string | undefined;

// single funnel -> PostHog + optional beacon, only events from analytics/events.ts
export function track<N extends DottoEventName>(name: N, props: PropsFor<N>): void {
  capturePostHog(name, props as Record<string, unknown>);
  sendBeacon(name, props as Record<string, unknown>);

  // Meta RunStarted = optimisation target, Lead = fake-door tap, pixel countries only
  if (name === 'run_started') trackPixelCustom('RunStarted');
  if (name === 'app_intent') trackPixel('Lead');
}

// attaches props to every later event in both sinks, used for experiment arm
export function setTrackContext(props: Record<string, string | number | boolean>): void {
  registerSuperProps(props);
}

// call once at startup
export function initAnalytics(): void {
  if (isPostHogEnabled()) void initPostHog();
  if (isPixelConfigured()) void initPixel();
}

function sendBeacon(name: string, props: Record<string, unknown>): void {
  if (BEACON === undefined || BEACON === '') return;
  // merges context -> raw copy stays segmentable by experiment arm
  const body = JSON.stringify({ event: name, ts: Date.now(), ...getSuperProps(), ...props });
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
