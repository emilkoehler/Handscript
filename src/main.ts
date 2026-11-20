import './style.css';
import { ALL_CHARS, CHAR_GROUPS, charLabel } from './charset';
import { HandFont, MAX_VARIANTS, filledVariants, newFont, parseFont, setVariant } from './font';
import { GlyphPad } from './pad';
import { deleteFont, downloadFont, listFonts, saveFont } from './storage';
import { drawStrokes, fitCanvas } from './draw';
import { layoutText } from './render';

const app = document.querySelector<HTMLDivElement>('#app')!;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function progress(font: HandFont): { done: number; total: number } {
  return { done: ALL_CHARS.filter((c) => filledVariants(font, c).length > 0).length, total: ALL_CHARS.length };
}

// ---------- Startseite: Liste der Schriften ----------

async function showHome(): Promise<void> {
  const fonts = await listFonts();
  app.innerHTML = `
    <header class="bar"><h1>Handscript</h1></header>
    <main class="home">
      <section class="card">
        <h2>Neue Handschrift anlegen</h2>
        <p class="muted">Du schreibst jeden Buchstaben ein- bis dreimal mit Stift oder Finger. Daraus setzt Handscript später deine Texte zusammen.</p>
        <form id="new-font" class="row">
          <input id="font-name" placeholder="Name, z. B. Emils Schrift" maxlength="40" />
          <button class="primary" type="submit">Anlegen</button>
        </form>
      </section>
      <section class="card">
        <div class="row between">
          <h2>Meine Schriften</h2>
          <label class="button">Schrift importieren<input id="import" type="file" accept=".json,application/json" hidden /></label>
        </div>
        ${
          fonts.length
            ? `<ul class="fonts">${fonts
                .map((f) => {
                  const p = progress(f);
                  return `<li data-id="${f.id}">
                    <div><strong>${esc(f.name)}</strong><div class="muted">${p.done} von ${p.total} Zeichen</div>
                      <div class="meter"><span style="width:${(100 * p.done) / p.total}%"></span></div></div>
                    <div class="actions">
                      <button data-act="edit" class="primary">Schreiben</button>
                      <button data-act="preview">Vorschau</button>
                      <button data-act="export">Teilen</button>
                      <button data-act="delete" class="danger" aria-label="Löschen">Löschen</button>
                    </div></li>`;
                })
                .join('')}</ul>`
            : '<p class="muted">Noch keine Schrift vorhanden.</p>'
        }
        <p id="import-msg" class="muted"></p>
      </section>
    </main>`;

  app.querySelector<HTMLFormElement>('#new-font')!.onsubmit = async (e) => {
    e.preventDefault();
    const font = newFont(app.querySelector<HTMLInputElement>('#font-name')!.value);
    await saveFont(font);
    showEditor(font);
  };

  app.querySelector<HTMLInputElement>('#import')!.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const msg = app.querySelector('#import-msg')!;
    try {
      const font = parseFont(JSON.parse(await file.text()));
      const existing = fonts.find((f) => f.id === font.id);
      if (existing && !confirm(`„${existing.name}“ ist schon vorhanden. Ersetzen?`)) return;
      await saveFont(font);
      showHome();
    } catch (err) {
      msg.textContent = err instanceof Error ? err.message : 'Import fehlgeschlagen.';
    }
  };

  app.querySelectorAll<HTMLLIElement>('.fonts li').forEach((li) => {
    const font = fonts.find((f) => f.id === li.dataset.id)!;
    li.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.onclick = async () => {
        switch (b.dataset.act) {
          case 'edit':
            return showEditor(font);
          case 'preview':
            return showPreview(font);
          case 'export':
            return downloadFont(font);
          case 'delete':
            if (confirm(`„${font.name}“ wirklich löschen?`)) {
              await deleteFont(font.id);
              showHome();
            }
        }
      };
    });
  });
}

// ---------- Schreibfeld ----------

function showEditor(font: HandFont, startChar?: string): void {
  let ch = startChar ?? ALL_CHARS.find((c) => !filledVariants(font, c).length) ?? ALL_CHARS[0];
  let variant = 0;
  let saveTimer: number | undefined;

  app.innerHTML = `
    <header class="bar">
      <button id="back" class="ghost">‹ Zurück</button>
      <h1>${esc(font.name)}</h1>
      <button id="to-preview" class="ghost">Vorschau ›</button>
    </header>
    <main class="editor">
      <section class="writer">
        <div class="row between">
          <div class="current"><span id="cur-char"></span><span id="cur-label" class="muted"></span></div>
          <div class="variants" id="variants"></div>
        </div>
        <div class="pad-wrap"><canvas id="pad" aria-label="Schreibfeld"></canvas></div>
        <p class="muted hint">Schreib den Buchstaben so, dass er auf der blauen Grundlinie steht. Kleinbuchstaben reichen bis zur gestrichelten Mittellinie.</p>
        <div class="row tools">
          <button id="undo">Rückgängig</button>
          <button id="clear">Leeren</button>
          <span class="spacer"></span>
          <button id="prev">‹</button>
          <button id="next" class="primary">Weiter ›</button>
        </div>
      </section>
      <section class="overview card">
        <div class="row between"><h2>Alle Zeichen</h2><span id="progress" class="muted"></span></div>
        <div id="grid"></div>
      </section>
    </main>`;

  const pad = new GlyphPad(app.querySelector('#pad')!, (strokes) => {
    setVariant(font, ch, variant, strokes);
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveFont(font), 300);
    updateHeader();
    updateCell(ch);
  });

  const grid = app.querySelector<HTMLDivElement>('#grid')!;
  grid.innerHTML = CHAR_GROUPS.map(
    (g) => `<h3>${g.name}</h3><div class="cells">${g.chars
      .map((c) => `<button class="cell" data-ch="${esc(c)}" title="${esc(charLabel(c))}"><canvas></canvas><span>${esc(c)}</span><i></i></button>`)
      .join('')}</div>`,
  ).join('');
  grid.querySelectorAll<HTMLButtonElement>('.cell').forEach((b) => (b.onclick = () => select(b.dataset.ch!, 0)));

  function updateCell(c: string): void {
    const cell = grid.querySelector<HTMLButtonElement>(`.cell[data-ch="${CSS.escape(c)}"]`);
    if (!cell) return;
    const vs = filledVariants(font, c);
    cell.classList.toggle('done', vs.length > 0);
    cell.classList.toggle('active', c === ch);
    cell.querySelector('i')!.textContent = vs.length ? '•'.repeat(vs.length) : '';
    const canvas = cell.querySelector('canvas')!;
    const ctx = fitCanvas(canvas, 44, 44);
    ctx.clearRect(0, 0, 44, 44);
    if (vs.length) drawStrokes(ctx, vs[0].strokes, { scale: 44 / 1000, dx: 0, dy: 0 }, { width: 22, color: '#1d2a5b' });
  }

  function updateHeader(): void {
    app.querySelector('#cur-char')!.textContent = ch;
    const label = charLabel(ch);
    app.querySelector('#cur-label')!.textContent = label !== ch ? label : /\p{Lu}/u.test(ch) ? 'groß' : '';
    const slots = font.glyphs[ch] ?? [];
    app.querySelector('#variants')!.innerHTML = Array.from({ length: MAX_VARIANTS }, (_, i) => {
      const filled = (slots[i]?.strokes.length ?? 0) > 0;
      return `<button data-v="${i}" class="${i === variant ? 'active' : ''} ${filled ? 'filled' : ''}">${i + 1}</button>`;
    }).join('');
    app.querySelectorAll<HTMLButtonElement>('#variants button').forEach((b) => (b.onclick = () => select(ch, Number(b.dataset.v))));
    const p = progress(font);
    app.querySelector('#progress')!.textContent = `${p.done} / ${p.total}`;
  }

  function select(c: string, v: number): void {
    const prev = ch;
    ch = c;
    variant = v;
    const strokes = font.glyphs[ch]?.[variant]?.strokes ?? [];
    const other = filledVariants(font, ch).find((x) => x !== font.glyphs[ch]?.[variant]);
    pad.load(strokes, other?.strokes ?? [], ch);
    updateHeader();
    updateCell(prev);
    updateCell(ch);
  }

  function step(dir: 1 | -1): void {
    if (dir === 1 && !pad.isEmpty && variant < MAX_VARIANTS - 1) return select(ch, variant + 1);
    const i = ALL_CHARS.indexOf(ch);
    const next = ALL_CHARS[(i + dir + ALL_CHARS.length) % ALL_CHARS.length];
    select(next, 0);
  }

  const flush = () => {
    clearTimeout(saveTimer);
    return saveFont(font);
  };
  app.querySelector<HTMLButtonElement>('#undo')!.onclick = () => pad.undo();
  app.querySelector<HTMLButtonElement>('#clear')!.onclick = () => pad.clear();
  app.querySelector<HTMLButtonElement>('#next')!.onclick = () => step(1);
  app.querySelector<HTMLButtonElement>('#prev')!.onclick = () => step(-1);
  app.querySelector<HTMLButtonElement>('#back')!.onclick = async () => {
    await flush();
    showHome();
  };
  app.querySelector<HTMLButtonElement>('#to-preview')!.onclick = async () => {
    await flush();
    showPreview(font);
  };

  ALL_CHARS.forEach(updateCell);
  select(ch, 0);
}

// ---------- Vorschau ----------

function showPreview(font: HandFont): void {
  app.innerHTML = `
    <header class="bar">
      <button id="back" class="ghost">‹ Zurück</button>
      <h1>Vorschau</h1>
      <button id="edit" class="ghost">Schreiben ›</button>
    </header>
    <main class="preview">
      <textarea id="text" rows="4">Hallo! Das ist meine eigene Handschrift.</textarea>
      <label class="row">Größe <input id="size" type="range" min="16" max="60" value="30" /></label>
      <p id="missing" class="muted"></p>
      <div class="paper"><canvas id="out"></canvas></div>
    </main>`;

  const text = app.querySelector<HTMLTextAreaElement>('#text')!;
  const size = app.querySelector<HTMLInputElement>('#size')!;
  const canvas = app.querySelector<HTMLCanvasElement>('#out')!;
  const paper = app.querySelector<HTMLDivElement>('.paper')!;

  const observer = new ResizeObserver(() => render());
  const render = () => {
    if (!canvas.isConnected) return observer.disconnect();
    const cssW = paper.clientWidth - 32;
    const scale = Number(size.value) / 520; // Pixel pro Einheit (≈ Höhe eines Großbuchstabens)
    const layout = layoutText(font, text.value, cssW / scale);
    const cssH = Math.max(80, layout.height * scale + 20);
    const ctx = fitCanvas(canvas, cssW, cssH);
    ctx.clearRect(0, 0, cssW, cssH);
    for (const g of layout.glyphs)
      drawStrokes(ctx, g.strokes, { scale, dx: g.x * scale, dy: g.y * scale }, { width: Math.max(14, 1.6 / scale), color: '#1d2a5b' });
    const miss = layout.missing.filter((c) => c.trim());
    app.querySelector('#missing')!.textContent = miss.length
      ? `Noch nicht geschrieben: ${miss.join(' ')}`
      : '';
  };
  text.oninput = render;
  size.oninput = render;
  observer.observe(paper);

  app.querySelector<HTMLButtonElement>('#back')!.onclick = () => showHome();
  app.querySelector<HTMLButtonElement>('#edit')!.onclick = () => showEditor(font);
}

showHome();
