import * as pdfjsLib from 'pdfjs-dist';
import { SPINE_PALETTE } from '../types/library';

export interface AutoColorResult {
  color: string;
  textColor: string;
  label: string;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Pick a harmonious color from the Zen spine palette based on title/name */
export function pickHarmoniousColor(seedText: string): AutoColorResult {
  const clean = seedText.trim().toLowerCase() || 'zens-library';
  const idx = hashString(clean) % SPINE_PALETTE.length;
  const opt = SPINE_PALETTE[idx];
  return {
    color: opt.color,
    textColor: opt.textColor,
    label: `Auto • ${opt.finish}`,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function getReadableTextColor(r: number, g: number, b: number): string {
  // Perceived luminance (WCAG)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.58 ? '#2C2621' : '#FAF6EE';
}

/**
 * Sample the dominant non-white cover tone from page 1 of a PDF.
 * Falls back to pickHarmoniousColor if the cover is mostly blank/white or fails to parse.
 */
export async function detectAutoBookColor(file: File, fallbackTitle: string): Promise<AutoColorResult> {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return pickHarmoniousColor(fallbackTitle || file.name);
  }

  try {
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 0.25 });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(16, Math.floor(viewport.width));
    canvas.height = Math.max(16, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      doc.destroy();
      return pickHarmoniousColor(fallbackTitle || file.name);
    }

    await page.render({ canvasContext: ctx, viewport }).promise;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    doc.destroy();

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let weightSum = 0;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Skip near-white page margins and pure black body text
      if (lum > 0.9 || lum < 0.08) continue;

      const weight = 0.5 + sat * 2.5;
      rSum += r * weight;
      gSum += g * weight;
      bSum += b * weight;
      weightSum += weight;
    }

    if (weightSum < 15) {
      return pickHarmoniousColor(fallbackTitle || file.name);
    }

    const rAvg = rSum / weightSum;
    const gAvg = gSum / weightSum;
    const bAvg = bSum / weightSum;

    return {
      color: rgbToHex(rAvg, gAvg, bAvg),
      textColor: getReadableTextColor(rAvg, gAvg, bAvg),
      label: 'Auto • Cover Color',
    };
  } catch {
    return pickHarmoniousColor(fallbackTitle || file.name);
  }
}
