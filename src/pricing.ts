import { geoCountry, whenGeoResolved } from './analytics/geo';

// tap must never start payment, APP_NOT_OUT must stay, per UCPD Art 6
export interface AppPrice {
  // ISO 4217 code, sent to Meta verbatim
  readonly currency: string;
  // sent to Meta as value
  readonly amount: number;
  // exact button label, built without Intl
  readonly display: string;
}

// ends in .99 to match real app prices
const AMOUNT = 3.99;

// Intl would format for browser locale, not visitor country
interface Storefront {
  readonly currency: string;
  readonly format: (amount: string) => string;
}

const USD: Storefront = { currency: 'USD', format: (a) => `$${a}` };

const BY_COUNTRY: ReadonlyMap<string, Storefront> = new Map([
  ['US', USD],
  ['CA', { currency: 'CAD', format: (a) => `CA$${a}` }],
  ['AU', { currency: 'AUD', format: (a) => `A$${a}` }],
  ['NZ', { currency: 'NZD', format: (a) => `NZ$${a}` }],
  ['GB', { currency: 'GBP', format: (a) => `£${a}` }],
  ['CH', { currency: 'CHF', format: (a) => `CHF ${a}` }],
  // non-euro EU members take USD fallback
  ...(
    [
      'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE',
      'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
    ] as const
  ).map((c) => [c, { currency: 'EUR', format: (a: string) => `€${a}` }] as const),
]);

function toPrice(store: Storefront): AppPrice {
  return { currency: store.currency, amount: AMOUNT, display: store.format(AMOUNT.toFixed(2)) };
}

// unmapped storefronts -> USD fallback, same as App Store
export function priceForCountry(country: string | null | undefined): AppPrice {
  if (typeof country !== 'string') return toPrice(USD);
  const code = country.trim().toUpperCase();
  if (code.length !== 2) return toPrice(USD);
  return toPrice(BY_COUNTRY.get(code) ?? USD);
}

// USD fallback until geo lookup resolves
export function currentPrice(): AppPrice {
  return priceForCountry(geoCountry());
}

// resolves once country known -> fallback label can be corrected
export async function whenPriceResolved(): Promise<AppPrice> {
  return priceForCountry((await whenGeoResolved()).country);
}
