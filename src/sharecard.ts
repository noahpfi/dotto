import { toCanvas } from 'html-to-image';

// rasterises real result screen DOM -> shared image matches screen

// node background transparent
const INK = '#08080a';

// pixelRatio 2 keeps capture under 10MB, some share targets drop larger
const PIXEL_RATIO = 2;

// portrait 4:5 = tallest aspect Instagram, WhatsApp render uncropped
const ASPECT_H_OVER_W = 5 / 4;

// visible viewport cropped to 4:5 from top, null on any failure
export async function captureScreen(node: HTMLElement): Promise<Blob | null> {
  try {
    const full = await toCanvas(node, {
      backgroundColor: INK,
      pixelRatio: PIXEL_RATIO,
      // cache-busted stylesheet read -> no stale inlined copy in long-lived tabs
      cacheBust: true,
    });

    const rect = node.getBoundingClientRect();
    // negative top = node scrolled up
    const sourceY = Math.max(0, Math.round(-rect.top * PIXEL_RATIO));
    const visible = Math.min(Math.round(window.innerHeight * PIXEL_RATIO), full.height - sourceY);
    if (visible <= 0) return null;

    // height capped at 4:5 and visible area -> short windows yield wider frame
    const height = Math.min(Math.round(full.width * ASPECT_H_OVER_W), visible);
    const cropped = document.createElement('canvas');
    cropped.width = full.width;
    cropped.height = height;
    const ctx = cropped.getContext('2d');
    if (ctx === null) return await toBlob(full);
    ctx.drawImage(full, 0, sourceY, full.width, height, 0, 0, full.width, height);
    return await toBlob(cropped);
  } catch (err) {
    console.warn('dotto: could not capture the screen —', err);
    return null;
  }
}

// canvas.toBlob may return null
async function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob !== 'function') return null;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

// filename shown by receiving app
export function shareCardFilename(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug === '' ? 'dotto' : slug}.png`;
}
