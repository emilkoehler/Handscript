// Zeichnet gespeicherte Striche auf ein Canvas.
import { Stroke } from './font';

export interface Transform {
  /** Pixel pro Einheit */
  scale: number;
  dx: number;
  dy: number;
}

export interface PenStyle {
  /** Stiftdicke in Einheiten (bei Druck 0.5) */
  width: number;
  color: string;
  /** Gleichmäßige Linie ohne Druck (für blasse Hilfsdarstellungen) */
  uniform?: boolean;
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, t: Transform, pen: PenStyle): void {
  if (!s.length) return;
  ctx.strokeStyle = pen.color;
  ctx.fillStyle = pen.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const X = (x: number) => x * t.scale + t.dx;
  const Y = (y: number) => y * t.scale + t.dy;
  const W = (p: number) => Math.max(0.6, pen.width * t.scale * (0.55 + 0.9 * p));

  if (s.length === 1) {
    const [x, y, p] = s[0];
    ctx.beginPath();
    ctx.arc(X(x), Y(y), W(p) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (pen.uniform) {
    ctx.beginPath();
    ctx.lineWidth = W(0.5);
    ctx.moveTo(X(s[0][0]), Y(s[0][1]));
    for (let i = 1; i < s.length - 1; i++) {
      const [x0, y0] = s[i];
      const [x1, y1] = s[i + 1];
      ctx.quadraticCurveTo(X(x0), Y(y0), X((x0 + x1) / 2), Y((y0 + y1) / 2));
    }
    const last = s[s.length - 1];
    ctx.lineTo(X(last[0]), Y(last[1]));
    ctx.stroke();
    return;
  }
  // Geglättete Linie: Kurven durch die Mittelpunkte zwischen den Punkten.
  let px = X(s[0][0]);
  let py = Y(s[0][1]);
  for (let i = 1; i < s.length; i++) {
    const [x0, y0] = s[i - 1];
    const [x1, y1, p1] = s[i];
    const mx = X((x0 + x1) / 2);
    const my = Y((y0 + y1) / 2);
    ctx.beginPath();
    ctx.lineWidth = W((s[i - 1][2] + p1) / 2);
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(X(x0), Y(y0), mx, my);
    if (i === s.length - 1) ctx.lineTo(X(x1), Y(y1));
    ctx.stroke();
    px = mx;
    py = my;
  }
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], t: Transform, pen: PenStyle): void {
  for (const s of strokes) drawStroke(ctx, s, t, pen);
}

/** Canvas auf scharfe Darstellung bei hoher Pixeldichte einstellen. */
export function fitCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): CanvasRenderingContext2D {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
