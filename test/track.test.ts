import { beforeEach, describe, expect, it, vi } from 'vitest';

// guards product-to-Meta event mapping, incl Lead price value
const trackPixel = vi.fn();
const trackPixelCustom = vi.fn();
const capturePostHog = vi.fn();

vi.mock('../src/analytics/pixel', () => ({
  trackPixel,
  trackPixelCustom,
  initPixel: vi.fn(),
  isPixelConfigured: () => false,
}));

vi.mock('../src/analytics/posthog', () => ({
  capturePostHog,
  initPostHog: vi.fn(),
  isPostHogEnabled: () => false,
  registerSuperProps: vi.fn(),
  getSuperProps: () => ({}),
}));

const { track } = await import('../src/track');

beforeEach(() => {
  trackPixel.mockClear();
  trackPixelCustom.mockClear();
  capturePostHog.mockClear();
});

describe('product event to Meta event mapping', () => {
  it('sends the fake-door tap as a Lead with the shown price', () => {
    track('app_intent', {
      source: 'result-fail',
      survived_ms: 12000,
      predicted_ms: 60000,
      price: 3.99,
      currency: 'CAD',
    });
    expect(trackPixel).toHaveBeenCalledWith('Lead', { value: 3.99, currency: 'CAD' });
  });

  it('passes the currency through untouched', () => {
    track('app_intent', {
      source: 'home',
      survived_ms: null,
      predicted_ms: null,
      price: 3.99,
      currency: 'EUR',
    });
    expect(trackPixel).toHaveBeenCalledWith('Lead', { value: 3.99, currency: 'EUR' });
  });

  it('sends a started run as RunStarted without a Lead', () => {
    track('run_started', {
      level_id: 1,
      target_ms: 60000,
      predicted_ms: null,
      is_prediction_run: false,
      attempt_number: 1,
      daily_day: null,
      dare_chain: null,
    });
    expect(trackPixelCustom).toHaveBeenCalledWith('RunStarted');
    expect(trackPixel).not.toHaveBeenCalled();
  });

  it('sends nothing to Meta for unmapped events', () => {
    track('home_viewed', {
      unlocked_level: 1,
      attempts: 0,
      returning: false,
      daily_streak: 0,
      daily_played: false,
    });
    expect(trackPixel).not.toHaveBeenCalled();
    expect(trackPixelCustom).not.toHaveBeenCalled();
  });

  it('always mirrors the event into PostHog', () => {
    track('share_completed', {
      source: 'result-pass',
      method: 'clipboard',
      direction: 'onward',
      chain: 2,
    });
    expect(capturePostHog).toHaveBeenCalledWith('share_completed', {
      source: 'result-pass',
      method: 'clipboard',
      direction: 'onward',
      chain: 2,
    });
  });
});
