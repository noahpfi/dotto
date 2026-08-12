import { describe, expect, it } from 'vitest';
import { createFbqShim } from '../src/analytics/pixel';

// fbevents.js drains fbq.queue only once
describe('fbq shim', () => {
  it('buffers calls made before fbevents.js arrives', () => {
    const fbq = createFbqShim();
    fbq('track', 'PageView');
    fbq('trackCustom', 'Engaged');
    expect(fbq.queue).toHaveLength(2);
  });

  it('delegates to callMethod once fbevents.js has loaded', () => {
    const fbq = createFbqShim();
    fbq('track', 'PageView');

    // simulates real script, installs callMethod, drains queue once
    const sent: unknown[][] = [];
    fbq.callMethod = (...args: unknown[]) => void sent.push(args);
    for (const queued of fbq.queue ?? []) fbq.callMethod(...(queued as unknown[]));
    fbq.queue = [];

    // every call from here must reach callMethod
    fbq('trackCustom', 'Engaged');
    fbq('track', 'Lead');

    expect(sent.map((a) => a.join('|'))).toEqual([
      'track|PageView',
      'trackCustom|Engaged',
      'track|Lead',
    ]);
    expect(fbq.queue).toHaveLength(0);
  });

  it('carries the properties Meta’s loader expects', () => {
    const fbq = createFbqShim();
    expect(fbq.loaded).toBe(true);
    expect(fbq.version).toBe('2.0');
    expect(fbq.push).toBe(fbq);
    expect(fbq.queue).toEqual([]);
  });
});
