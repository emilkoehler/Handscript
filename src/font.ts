// Datenmodell für eine Handschrift.
//
// Jeder Buchstabe wird als Vektor-Striche gespeichert, nicht als Bild.
// So können wir später Stiftdicke, Farbe und Größe frei wählen.
//
// Koordinaten liegen in einem Raster von 0..1000 (UNITS) pro Seite des
// Schreibfelds. Die Hilfslinien liegen fest an diesen Positionen:
export const UNITS = 1000;
export const LINES = {
  ascender: 200, // Oberkante von Großbuchstaben und l, k, h …
  xHeight: 480, // Oberkante von a, c, e …
  baseline: 720, // Grundlinie
  descender: 920, // Unterlänge von g, p, y …
} as const;

/** Ein Punkt: x, y (0..1000) und Stiftdruck (0..1). */
export type Point = [number, number, number];
export type Stroke = Point[];

export interface GlyphVariant {
  strokes: Stroke[];
}

export interface HandFont {
  format: 'handscript-font';
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Zeichen → bis zu MAX_VARIANTS Varianten */
  glyphs: Record<string, GlyphVariant[]>;
}

export const MAX_VARIANTS = 3;

export function newFont(name: string): HandFont {
  const now = new Date().toISOString();
  return {
    format: 'handscript-font',
    version: 1,
    id: randomId(),
    name: name.trim() || 'Meine Handschrift',
    createdAt: now,
    updatedAt: now,
    glyphs: {},
  };
}

export function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Varianten eines Zeichens, die tatsächlich Striche enthalten. */
export function filledVariants(font: HandFont, ch: string): GlyphVariant[] {
  return (font.glyphs[ch] ?? []).filter((v) => v && v.strokes.length > 0);
}

export function setVariant(font: HandFont, ch: string, index: number, strokes: Stroke[]): void {
  const list = font.glyphs[ch] ? [...font.glyphs[ch]] : [];
  while (list.length <= index) list.push({ strokes: [] });
  list[index] = { strokes };
  // Leere Varianten am Ende entfernen, damit die Datei schlank bleibt.
  while (list.length && list[list.length - 1].strokes.length === 0) list.pop();
  if (list.length) font.glyphs[ch] = list;
  else delete font.glyphs[ch];
  font.updatedAt = new Date().toISOString();
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(strokes: Stroke[]): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes)
    for (const [x, y] of s) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

/** Rundet Punkte, damit gespeicherte Schriften klein bleiben. */
export function compactStroke(points: Point[]): Stroke {
  const out: Stroke = [];
  for (const [x, y, p] of points) {
    const q: Point = [Math.round(x), Math.round(y), Math.round(p * 100) / 100];
    const last = out[out.length - 1];
    if (last && last[0] === q[0] && last[1] === q[1]) continue;
    out.push(q);
  }
  return out;
}

/** Prüft eine importierte Datei und gibt eine saubere Schrift zurück. */
export function parseFont(json: unknown): HandFont {
  if (!json || typeof json !== 'object') throw new Error('Keine gültige Schriftdatei.');
  const f = json as Partial<HandFont>;
  if (f.format !== 'handscript-font') throw new Error('Diese Datei ist keine Handscript-Schrift.');
  if (f.version !== 1) throw new Error('Diese Schriftversion wird nicht unterstützt.');
  if (!f.glyphs || typeof f.glyphs !== 'object') throw new Error('Die Schrift enthält keine Buchstaben.');

  const glyphs: Record<string, GlyphVariant[]> = {};
  for (const [ch, variants] of Object.entries(f.glyphs)) {
    if (!Array.isArray(variants)) continue;
    const clean = variants.slice(0, MAX_VARIANTS).map((v) => ({
      strokes: Array.isArray(v?.strokes)
        ? v.strokes
            .filter(Array.isArray)
            .map((s) =>
              s
                .filter((p: unknown) => Array.isArray(p) && p.length >= 2 && p.every((n) => typeof n === 'number' && isFinite(n)))
                .map((p: number[]) => [clamp(p[0]), clamp(p[1]), Math.min(1, Math.max(0, p[2] ?? 0.5))] as Point),
            )
            .filter((s) => s.length > 0)
        : [],
    }));
    if (clean.some((v) => v.strokes.length)) glyphs[ch] = clean;
  }
  const now = new Date().toISOString();
  return {
    format: 'handscript-font',
    version: 1,
    id: typeof f.id === 'string' && f.id ? f.id : randomId(),
    name: typeof f.name === 'string' && f.name.trim() ? f.name.trim() : 'Importierte Schrift',
    createdAt: typeof f.createdAt === 'string' ? f.createdAt : now,
    updatedAt: typeof f.updatedAt === 'string' ? f.updatedAt : now,
    glyphs,
  };
}

function clamp(n: number): number {
  return Math.min(UNITS, Math.max(0, n));
}
