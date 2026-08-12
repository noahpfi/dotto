// chat crawlers run no JS -> og tags rewritten per dare server-side
export const config = { runtime: 'edge' };

// mirrors src/dare.ts bounds -> hand-edited links get no card
const MAX_TARGET_MS = 2 * 60 * 60 * 1000;
const MAX_LEVEL_ID = 5;

// mirrors formatDuration in src/copy.ts, both target shapes
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function readInt(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && Number.isInteger(value) ? value : null;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Preview {
  readonly title: string;
  readonly description: string;
}

function previewFor(url: URL): Preview | null {
  const targetMs = readInt(url.searchParams, 'd');
  if (targetMs === null || targetMs < 0 || targetMs > MAX_TARGET_MS) return null;
  const levelId = readInt(url.searchParams, 'l');
  if (levelId === null || levelId < 0 || levelId > MAX_LEVEL_ID) return null;

  const day = readInt(url.searchParams, 'day');
  const held = formatDuration(targetMs);
  const prefix = levelId === 0 && day !== null && day > 0 ? `dotto #${day} — ` : '';
  // mirrors shareMessage in src/copy.ts, w=b marks volley back
  const back = url.searchParams.get('w') === 'b';
  const taunt = back
    ? `Your move. Bet you can’t beat my ${held}`
    : `Bet you can’t last longer than my ${held}`;
  return {
    title: `${prefix}${taunt} (avg person lasts 47s)`,
    // WhatsApp truncates descriptions past two lines
    description: 'dotto focus challenge - tap only when the dot goes hollow.',
  };
}

function replaceMeta(html: string, attribute: 'property' | 'name', key: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`, 'i');
  return html.replace(pattern, `$1${escapeAttribute(value)}$2`);
}

export function applyDarePreview(html: string, url: URL, origin: string): string {
  const preview = previewFor(url);
  if (preview === null) return html;
  // image = sender's number drawn by api/og.ts
  const image = `${origin}/api/og${url.search}`;
  let out = replaceMeta(html, 'property', 'og:title', preview.title);
  out = replaceMeta(out, 'property', 'og:description', preview.description);
  out = replaceMeta(out, 'property', 'og:url', `${origin}/d${url.search}`);
  out = replaceMeta(out, 'property', 'og:image', image);
  out = replaceMeta(out, 'property', 'og:image:alt', preview.title);
  out = replaceMeta(out, 'name', 'twitter:title', preview.title);
  out = replaceMeta(out, 'name', 'twitter:image', image);
  return out.replace(/(<title>)[^<]*(<\/title>)/i, `$1${escapeAttribute(preview.title)}$2`);
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // index.html carries no d -> fetch cannot re-enter this rewrite
  const upstream = await fetch(new URL('/index.html', url.origin), {
    headers: { accept: 'text/html' },
  });
  if (!upstream.ok) return Response.redirect(`${url.origin}/`, 302);

  // origin from request -> preview deploys and tunnels advertise own image URL
  const html = applyDarePreview(await upstream.text(), url, url.origin);

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // each dare = distinct URL -> shared cache leaks nothing between visitors
      'cache-control': 'public, max-age=0, s-maxage=300',
    },
  });
}
