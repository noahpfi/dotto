// test/geo.test.ts asserts allow-list matches src/analytics/geo.ts
export const config = { runtime: 'edge' };

const ALLOWED = new Set(['US', 'CA', 'AU']);

export default function handler(request: Request): Response {
  const raw = request.headers.get('x-vercel-ip-country');
  const country = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  // missing header -> fail closed
  const pixel = country.length === 2 && ALLOWED.has(country);

  return new Response(JSON.stringify({ country: country === '' ? null : country, pixel }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      // uncached -> one visitor's verdict never served to another
      'cache-control': 'private, no-store, max-age=0',
      vary: 'x-vercel-ip-country',
    },
  });
}
