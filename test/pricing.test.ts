import { describe, expect, it } from 'vitest';
import { priceForCountry } from '../src/pricing';
import { PIXEL_ALLOWED_COUNTRIES } from '../src/analytics/geo';

// amount + currency go to Meta as Lead value and every app_intent -> wrong entry misreports price
describe('app price by country', () => {
  it('shows the local currency in each storefront it prices', () => {
    expect(priceForCountry('US')).toEqual({ currency: 'USD', amount: 3.99, display: '$3.99' });
    expect(priceForCountry('CA')).toEqual({ currency: 'CAD', amount: 3.99, display: 'CA$3.99' });
    expect(priceForCountry('AU')).toEqual({ currency: 'AUD', amount: 3.99, display: 'A$3.99' });
    expect(priceForCountry('NZ')).toEqual({ currency: 'NZD', amount: 3.99, display: 'NZ$3.99' });
    expect(priceForCountry('GB')).toEqual({ currency: 'GBP', amount: 3.99, display: '£3.99' });
    expect(priceForCountry('CH')).toEqual({ currency: 'CHF', amount: 3.99, display: 'CHF 3.99' });
    expect(priceForCountry('AT')).toEqual({ currency: 'EUR', amount: 3.99, display: '€3.99' });
  });

  it('charges one flat number in every currency', () => {
    // one price, no FX tiering -> intent rate comparable across storefronts
    for (const c of ['US', 'CA', 'AU', 'NZ', 'GB', 'CH', 'DE', 'FR', 'XX', 'JP']) {
      expect(priceForCountry(c).amount).toBe(3.99);
    }
  });

  it('prices every country the ads run in', () => {
    // USD fallback in campaign country = silent measurement error
    const expected: Record<string, string> = { US: 'USD', CA: 'CAD', AU: 'AUD' };
    for (const country of PIXEL_ALLOWED_COUNTRIES) {
      expect(priceForCountry(country).currency).toBe(expected[country]);
    }
  });

  it('gives the whole euro area one price', () => {
    const euro = ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE',
                  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];
    for (const c of euro) expect(priceForCountry(c)).toEqual(priceForCountry('DE'));
  });

  it('falls back to USD for unpriced storefronts', () => {
    // flat 3.99 in non-euro currency would be off roughly fourfold
    for (const c of ['PL', 'SE', 'DK', 'CZ', 'HU', 'RO', 'BG', 'JP', 'BR', 'IN']) {
      expect(priceForCountry(c).currency).toBe('USD');
    }
  });

  it('returns a price for garbage input', () => {
    for (const bad of [null, undefined, '', ' ', 'U', 'USA', '12', 'us us']) {
      expect(priceForCountry(bad as string | null)).toEqual(priceForCountry('US'));
    }
  });

  it('normalises case and whitespace', () => {
    expect(priceForCountry(' ca ')).toEqual(priceForCountry('CA'));
    expect(priceForCountry('gb')).toEqual(priceForCountry('GB'));
  });

  it('always displays the exact number it reports', () => {
    // displayed string and tracked amount from same source -> Meta and player see same price
    for (const c of ['US', 'CA', 'AU', 'NZ', 'GB', 'CH', 'DE', 'XX']) {
      const { amount, currency, display } = priceForCountry(c);
      expect(currency).toMatch(/^[A-Z]{3}$/);
      expect(display).toContain(amount.toFixed(2));
      expect(display).not.toMatch(/undefined|NaN/);
    }
  });
});
