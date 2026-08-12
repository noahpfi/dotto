import { describe, expect, it } from 'vitest';
import { PRODUCTION_HOSTS, environmentFor } from '../src/analytics/posthog';

// every event carries env -> test traffic filterable from dashboards
describe('environmentFor', () => {
  it('counts the live domain and its www form as production', () => {
    for (const host of PRODUCTION_HOSTS) expect(environmentFor(host)).toBe('production');
    expect(PRODUCTION_HOSTS).toContain('trydotto.live');
  });

  it('counts every development surface as dev', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '192.168.0.205',
      'somebody-ken-investigations-pumps.trycloudflare.com',
      'dotto-git-main-noah.vercel.app',
      'dotto.vercel.app',
    ]) {
      expect(environmentFor(host), host).toBe('dev');
    }
  });

  it('counts an unknown host as dev', () => {
    // anything but live domain, incl missing host = dev
    for (const host of [null, undefined, '', ' ', 'trydotto.live.evil.com', 'nottrydotto.live']) {
      expect(environmentFor(host), String(host)).toBe('dev');
    }
  });

  it('ignores case and stray whitespace', () => {
    expect(environmentFor(' TryDotto.Live ')).toBe('production');
    expect(environmentFor('WWW.TRYDOTTO.LIVE')).toBe('production');
  });
});
