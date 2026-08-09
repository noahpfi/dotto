import type { PostHog } from 'posthog-js';

// bannerless per TKG 2021 §165(3) only with memory persistence, no profiles, EU host
const KEY = import.meta.env['VITE_POSTHOG_KEY'] as string | undefined;
const HOST = (import.meta.env['VITE_POSTHOG_HOST'] as string | undefined) ?? 'https://eu.i.posthog.com';

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

export function isPostHogEnabled(): boolean {
  return KEY !== undefined && KEY !== '';
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
      posthog.init(KEY as string, {
        api_host: HOST,
        defaults: '2025-05-24',
        // cookieless_mode always -> posthog-js 1.414.0 permanently opted out
        persistence: 'memory',
        person_profiles: 'never',
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: true,
        disable_surveys: true,
        respect_dnt: true,
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
