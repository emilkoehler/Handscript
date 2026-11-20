// Großes Schreibfeld, auf dem ein Buchstabe gezeichnet wird.
import { LINES, Point, Stroke, UNITS, compactStroke } from './font';
import { drawStrokes, fitCanvas, Transform } from './draw';

const PEN = { width: 12, color: '#1d2a5b' };

export class GlyphPad {
  private ctx!: CanvasRenderingContext2D;
  private t: Transform = { scale: 1, dx: 0, dy: 0 };
  private strokes: Stroke[] = [];
  private current: Point[] | null = null;
  private pointerId: number | null = null;
  /** Sobald ein Stift erkannt wurde, ignorieren wir Finger (Handballen). */
  private penSeen = false;
  private ghost: Stroke[] = [];
  private guideChar = '';

  constructor(
    private canvas: HTMLCanvasElement,
    private onChange: (strokes: Stroke[]) => void,
  ) {
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
    const ro = new ResizeObserver(() => (canvas.isConnected ? this.resize() : ro.disconnect()));
    ro.observe(canvas.parentElement!);
    this.resize();
  }

  load(strokes: Stroke[], ghost: Stroke[], guideChar: string): void {
    this.strokes = strokes.map((s) => s.map((p) => [...p] as Point));
    this.ghost = ghost;
    this.guideChar = guideChar;
    this.current = null;
    this.pointerId = null;
    this.render();
  }

  undo(): void {
    if (!this.strokes.length) return;
    this.strokes.pop();
    this.render();
    this.onChange(this.strokes);
  }

  clear(): void {
    if (!this.strokes.length) return;
    this.strokes = [];
    this.render();
    this.onChange(this.strokes);
  }

  get isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  private resize(): void {
    const box = this.canvas.parentElement!.getBoundingClientRect();
    const size = Math.floor(Math.max(200, Math.min(box.width, window.innerHeight * 0.62)));
    if (this.ctx && Math.abs(size - this.t.scale * UNITS) < 1) return;
    this.ctx = fitCanvas(this.canvas, size, size);
    this.t = { scale: size / UNITS, dx: 0, dy: 0 };
    this.render();
  }

  private toUnits(e: PointerEvent): Point {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * UNITS;
    const y = ((e.clientY - r.top) / r.height) * UNITS;
    // Maus und manche Finger melden keinen Druck: dann mittlerer Druck.
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return [Math.min(UNITS, Math.max(0, x)), Math.min(UNITS, Math.max(0, y)), p];
  }

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'pen') this.penSeen = true;
    if (this.penSeen && e.pointerType === 'touch') return;
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.pointerId = e.pointerId;
    this.current = [this.toUnits(e)];
    this.render();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId || !this.current) return;
    e.preventDefault();
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) this.current.push(this.toUnits(ev));
    this.render();
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId || !this.current) return;
    this.pointerId = null;
    const stroke = compactStroke(this.current);
    this.current = null;
    if (stroke.length) {
      this.strokes.push(stroke);
      this.onChange(this.strokes);
    }
    this.render();
  };

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const size = this.t.scale * UNITS;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(0, 0, size, size);

    // Großer, blasser Vorlagebuchstabe als Orientierung.
    if (this.guideChar && !this.ghost.length) {
      ctx.save();
      ctx.fillStyle = 'rgba(29,42,91,0.07)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `${(LINES.baseline - LINES.ascender) * this.t.scale * 1.05}px Georgia, serif`;
      ctx.fillText(this.guideChar, size / 2, LINES.baseline * this.t.scale);
      ctx.restore();
    }

    // Hilfslinien
    const line = (y: number, color: string, dash: number[]) => {
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.moveTo(0, y * this.t.scale);
      ctx.lineTo(size, y * this.t.scale);
      ctx.stroke();
    };
    line(LINES.ascender, '#c9cde0', [6, 6]);
    line(LINES.xHeight, '#9fb3e6', [6, 6]);
    line(LINES.baseline, '#4b6cc9', []);
    line(LINES.descender, '#c9cde0', [6, 6]);
    ctx.setLineDash([]);

    // Andere Variante desselben Buchstabens blass einblenden (für gleichmäßige Größe).
    if (this.ghost.length) drawStrokes(ctx, this.ghost, this.t, { width: PEN.width, color: 'rgba(29,42,91,0.13)', uniform: true });

    drawStrokes(ctx, this.strokes, this.t, PEN);
    if (this.current) drawStrokes(ctx, [this.current], this.t, PEN);
  }
}
