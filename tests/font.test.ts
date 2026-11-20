import { describe, expect, it } from 'vitest';
import { bbox, compactStroke, filledVariants, newFont, parseFont, setVariant } from '../src/font';
import { layoutText } from '../src/render';

describe('font', () => {
  it('stores and trims variants', () => {
    const f = newFont('Test');
    setVariant(f, 'a', 1, [[[1, 2, 0.5]]]);
    expect(f.glyphs.a.length).toBe(2);
    expect(filledVariants(f, 'a').length).toBe(1);
    setVariant(f, 'a', 1, []);
    expect(f.glyphs.a).toBeUndefined();
  });

  it('compacts strokes', () => {
    expect(compactStroke([[1.2, 2.4, 0.333], [1.4, 2.2, 0.5], [5, 5, 1]])).toEqual([[1, 2, 0.33], [5, 5, 1]]);
  });

  it('computes bbox', () => {
    expect(bbox([[[10, 20, 0.5], [30, 5, 0.5]]])).toEqual({ minX: 10, minY: 5, maxX: 30, maxY: 20 });
    expect(bbox([])).toBeNull();
  });

  it('round-trips export and rejects foreign files', () => {
    const f = newFont('Emil');
    setVariant(f, 'ß', 0, [[[100, 200, 0.4], [2000, -5, 3]]]);
    const back = parseFont(JSON.parse(JSON.stringify(f)));
    expect(back.name).toBe('Emil');
    expect(back.glyphs['ß'][0].strokes[0][1]).toEqual([1000, 0, 1]);
    expect(() => parseFont({ hello: 1 })).toThrow();
  });
});

describe('layout', () => {
  it('wraps words and reports missing chars', () => {
    const f = newFont('x');
    setVariant(f, 'a', 0, [[[400, 500, 0.5], [600, 700, 0.5]]]);
    const l = layoutText(f, 'aaa aaa b', 800);
    expect(l.glyphs.length).toBe(6);
    expect(l.missing).toEqual(['b']);
    const lines = new Set(l.glyphs.map((g) => g.y));
    expect(lines.size).toBe(2);
  });
});
