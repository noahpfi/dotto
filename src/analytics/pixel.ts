import { env } from './env';
import { fetchGeoVerdict } from './geo';

// loads only where ePrivacy Art 5(3) requires no prior consent
const PIXEL_ID = env('VITE_META_PIXEL_ID', '');

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let started = false;
let active = false;

export function isPixelConfigured(): boolean {
  return PIXEL_ID !== '';
}

export function isPixelActive(): boolean {
  return active;
}

// standard Meta snippet, byte-compatible -> Meta debugger recognises it
function loadSnippet(): void {
  if (window.fbq !== undefined) return;

  const fbq: Fbq = function (...args: unknown[]) {
    // queues calls until remote script loads + replaces shim
    (fbq.queue ??= []).push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  window._fbq ??= fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.addEventListener('error', () => console.warn('dotto: Meta Pixel script failed to load'));
  document.head.appendChild(script);
}

// gate evaluated once, repeats free, failure = silent no-pixel session
export async function initPixel(): Promise<void> {
  if (started || !isPixelConfigured()) return;
  started = true;

  const verdict = await fetchGeoVerdict();
  if (!verdict.pixel) return;

  loadSnippet();
  window.fbq?.('init', PIXEL_ID);
  window.fbq?.('track', 'PageView');
  active = true;
}

// no-op outside allowed countries
export function trackPixel(event: 'Lead' | 'ViewContent', params: Record<string, unknown> = {}): void {
  if (!active) return;
  window.fbq?.('track', event, params);
}
