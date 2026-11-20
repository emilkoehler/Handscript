// Setzt Text aus den gezeichneten Buchstaben zusammen.
// Schritt 1: einfache Vorschau. Natürliche Schwankungen und Papier kommen in Schritt 2 und 3.
import { HandFont, LINES, Stroke, bbox, filledVariants } from './font';

export interface PlacedGlyph {
  ch: string;
  strokes: Stroke[];
  /** Verschiebung in Einheiten */
  x: number;
  y: number;
}

export interface Layout {
  glyphs: PlacedGlyph[];
  missing: string[];
  width: number;
  height: number;
}

export const LETTER_GAP = 50;
export const SPACE_WIDTH = 320;
export const LINE_HEIGHT = 820;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Measured {
  ch: string;
  strokes: Stroke[];
  minX: number;
  advance: number;
}

function measureChar(font: HandFont, ch: string, rand: () => number): Measured | null {
  const variants = filledVariants(font, ch);
  if (!variants.length) return null;
  const v = variants[Math.floor(rand() * variants.length)];
  const b = bbox(v.strokes)!;
  return { ch, strokes: v.strokes, minX: b.minX, advance: b.maxX - b.minX + LETTER_GAP };
}

/** Bricht Text auf `maxWidth` Einheiten um und platziert jeden Buchstaben. */
export function layoutText(font: HandFont, text: string, maxWidth: number, seed = 1): Layout {
  const rand = mulberry32(seed);
  const glyphs: PlacedGlyph[] = [];
  const missing = new Set<string>();
  let line = 0;
  let x = 0;
  let widest = 0;

  const top = (l: number) => l * LINE_HEIGHT - LINES.ascender + 40;

  for (const paragraph of text.split('\n')) {
    for (const word of paragraph.split(/ +/)) {
      if (!word) continue;
      const measured: Measured[] = [];
      for (const ch of word) {
        const m = measureChar(font, ch, rand);
        if (m) measured.push(m);
        else missing.add(ch);
      }
      const wordWidth = measured.reduce((s, m) => s + m.advance, 0);
      if (x > 0 && x + wordWidth > maxWidth) {
        line++;
        x = 0;
      }
      for (const m of measured) {
        // Sehr lange Wörter notfalls mitten im Wort umbrechen.
        if (x > 0 && x + m.advance > maxWidth) {
          line++;
          x = 0;
        }
        glyphs.push({ ch: m.ch, strokes: m.strokes, x: x - m.minX, y: top(line) });
        x += m.advance;
      }
      widest = Math.max(widest, x);
      x += SPACE_WIDTH;
    }
    line++;
    x = 0;
  }
  return {
    glyphs,
    missing: [...missing],
    width: Math.min(maxWidth, widest),
    height: Math.max(1, line) * LINE_HEIGHT,
  };
}
