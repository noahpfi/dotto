import type { PostHog } from 'posthog-js';

// bannerless per TKG 2021 §165(3) only with memory persistence, no profiles, EU host
// blank VITE_POSTHOG_HOST = empty string -> ?? alone would use it as api_host
function env(name: string, fallback: string): string {
  const value = import.meta.env[name] as string | undefined;
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

const KEY = env('VITE_POSTHOG_KEY', '');

// blockers list PostHog domain -> default first-party /ingest
const HOST = env('VITE_POSTHOG_HOST', '/ingest');
// required when proxying -> PostHog in-app links point at dashboard
const UI_HOST = 'https://eu.posthog.com';

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

export function isPostHogEnabled(): boolean {
  return KEY !== '';
}

// idempotent load, resolves null when unconfigured or chunk fails
export function initPostHog(): Promise<PostHog | null> {
  if (loading !== null) return loading;
  if (!isPostHogEnabled()) {
    loading = Promise.resolve(null);
    return loading;
  }

  loading = import('posthog-js')
    .then(({ posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        ui_host: UI_HOST,
        defaults: '2025-05-24',
        // cookieless_mode always -> posthog-js 1.414.0 permanently opted out
        persistence: 'memory',
        person_profiles: 'never',
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: true,
        disable_surveys: true,
        // DNT ignored, tracking stays cookieless, profileless, EU-only
        respect_dnt: false,
      });
      client = posthog;
      if (import.meta.env.DEV) {
        (window as Window & { posthog?: PostHog }).posthog = posthog;
      }
      return posthog;
    })
    .catch((err: unknown) => {
      console.warn('dotto: PostHog failed to load, analytics disabled for this session —', err);
      return null;
    });

  return loading;
}

// fire-and-forget, queued behind dynamic import -> early events survive
export function capturePostHog(name: string, props: Record<string, unknown>): void {
  if (!isPostHogEnabled()) return;
  if (client !== null) {
    client.capture(name, props);
    return;
  }
  void initPostHog().then((ph) => ph?.capture(name, props));
}
