import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTheme } from '../context/ThemeContext';

// Colour maths in OKLab (Björn Ottosson's matrices). Kept local: it is only used here.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const [lr, lg, lb] = [r, g, b].map(v => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}

function oklchToRgb(L: number, C: number, hueDeg: number): [number, number, number] {
  const h = (hueDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map(v => Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)) as [number, number, number];
}

const luminance = ([r, g, b]: [number, number, number]) =>
  0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);
const contrast = (x: number, y: number) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
const hex = (rgb: [number, number, number]) => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;

const INK_DARK: [number, number, number] = [0x16, 0x17, 0x1d];
const INK_LIGHT: [number, number, number] = [0xff, 0xff, 0xff];

export interface EventAccent {
  color: string;
  ink: string;
}

/** Dominant saturated hue of the image, or null when the photo is too grey. */
function dominantHue(image: HTMLImageElement): { hue: number; chroma: number } | null {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const bins = Array.from({ length: 24 }, () => ({ weight: 0, x: 0, y: 0, chroma: 0, n: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const [L, a, b] = rgbToOklab(data[i], data[i + 1], data[i + 2]);
    const C = Math.hypot(a, b);
    if (C < 0.05 || L < 0.2 || L > 0.95) continue;
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    const bin = bins[Math.floor((((hue % 360) + 360) % 360) / 15)];
    bin.weight += C;
    bin.x += a / C;
    bin.y += b / C;
    bin.chroma += C;
    bin.n += 1;
  }
  const best = bins.reduce((top, bin) => (bin.weight > top.weight ? bin : top));
  // Fewer than ~3% of pixels: the photo has no colour worth borrowing.
  if (best.n < size * size * 0.03) return null;
  return { hue: (Math.atan2(best.y, best.x) * 180) / Math.PI, chroma: best.chroma / best.n };
}

function accentFrom(hue: number, chroma: number, mode: 'light' | 'dark'): EventAccent | null {
  const rgb = oklchToRgb(mode === 'dark' ? 0.72 : 0.62, Math.min(chroma, 0.17), hue);
  const lum = luminance(rgb);
  const onDark = contrast(lum, luminance(INK_DARK));
  const onLight = contrast(lum, luminance(INK_LIGHT));
  if (Math.max(onDark, onLight) < 4.5) return null;
  return { color: hex(rgb), ink: hex(onDark >= onLight ? INK_DARK : INK_LIGHT) };
}

const cache = new Map<string, { hue: number; chroma: number } | null>();

function cacheKey(src: string) {
  return `sms_accent:${src}`;
}

/**
 * Accent colour borrowed from the event photo. Returns null until computed,
 * or when the photo has no usable colour; the CSS token then falls back.
 */
export function useEventAccent(imageUrl: string | undefined): EventAccent | null {
  const { resolved } = useTheme();
  const [sample, setSample] = useState<{ hue: number; chroma: number } | null>(() => {
    if (!imageUrl) return null;
    if (cache.has(imageUrl)) return cache.get(imageUrl) ?? null;
    try {
      const stored = sessionStorage.getItem(cacheKey(imageUrl));
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!imageUrl || cache.has(imageUrl)) {
      if (imageUrl) setSample(cache.get(imageUrl) ?? null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      let result: { hue: number; chroma: number } | null = null;
      try {
        result = dominantHue(image);
      } catch {
        // A tainted canvas (cross-origin image without CORS) cannot be read.
      }
      cache.set(imageUrl, result);
      try {
        sessionStorage.setItem(cacheKey(imageUrl), JSON.stringify(result));
      } catch {
        // Storage unavailable: the in-memory cache still covers this visit.
      }
      if (!cancelled) setSample(result);
    };
    image.onerror = () => cache.set(imageUrl, null);
    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return sample ? accentFrom(sample.hue, sample.chroma, resolved) : null;
}

/** Inline style that scopes the accent tokens to one subtree. */
export function accentStyle(accent: EventAccent | null): CSSProperties | undefined {
  if (!accent) return undefined;
  return { '--event-accent': accent.color, '--event-accent-ink': accent.ink } as CSSProperties;
}
