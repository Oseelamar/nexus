// Method: four stage plates that stack as you scroll. Each carries a
// conceptual dot figure in the research specimens' language that settles as
// its plate slides into place. Nothing here depicts data.

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

const INK = '240, 240, 236';
const ACCENT = '215, 185, 255';

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, rgb = INK, r = 1.15) {
  ctx.fillStyle = `rgba(${rgb}, ${a})`;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left') {
  ctx.font = '400 10px "Roboto Mono", monospace';
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(186, 185, 184, 0.75)';
  ctx.fillText(text, x, y);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Fig = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

const FIGS: Record<string, Fig> = {
  // Define the question: a frame narrows from the whole field to one region.
  investigate(ctx, w, h, t) {
    const top = 22;
    const step = 14;
    const cols = Math.floor(w / step);
    const rows = Math.floor((h - top) / step);
    const fx = Math.round(cols * 0.62) * step;
    const fy = top + Math.round(rows * 0.38) * step;
    const fw = step * 6;
    const fh = step * 5;
    const bx = lerp(0, fx - step / 2, t);
    const by = lerp(top, fy - step / 2, t);
    const bw = lerp(cols * step, fw, t);
    const bh = lerp(rows * step, fh, t);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * step + step / 2;
        const y = top + j * step + step / 2;
        const inside = x > bx && x < bx + bw && y > by && y < by + bh;
        dot(ctx, x, y, inside ? lerp(0.5, 0.95, t) : lerp(0.5, 0.16, t), inside && t > 0.6 ? ACCENT : INK);
      }
    }
    ctx.strokeStyle = `rgba(${ACCENT}, ${0.35 + 0.65 * t})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(bx) + 0.5, Math.round(by) + 0.5, Math.round(bw), Math.round(bh));
    tag(ctx, 'FIELD', 0, 10);
    tag(ctx, 'QUESTION', Math.round(bx), Math.max(10, Math.round(by) - 8));
  },

  // Test the hypothesis: identical setups; one condition changes per run.
  experiment(ctx, w, h, t) {
    const top = 22;
    const gap = 24;
    const pw = (w - gap * 2) / 3;
    const step = 11;
    const labels = ['CONTROL', 'VARIANT A', 'VARIANT B'];
    for (let p = 0; p < 3; p++) {
      const ox = p * (pw + gap);
      const cols = Math.floor(pw / step);
      const rows = Math.floor((h - top - 14) / step);
      const band0 = Math.floor(rows * 0.4);
      const band1 = Math.floor(rows * 0.62);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const inBand = j >= band0 && j < band1;
          const amp = inBand ? p * 3.4 * t : 0;
          const k = p * 997 + i * 131 + j;
          const x = ox + i * step + step / 2 + (hash(k) - 0.5) * 2 * amp;
          const y = top + j * step + step / 2 + (hash(k + 0.5) - 0.5) * 2 * amp;
          dot(ctx, x, y, inBand && p > 0 ? 0.55 + 0.4 * t : 0.6, inBand && p > 0 ? ACCENT : INK);
        }
      }
      tag(ctx, labels[p], ox, 10);
      ctx.fillStyle = 'rgba(240, 240, 236, 0.18)';
      if (p > 0) ctx.fillRect(Math.round(ox) - Math.round(gap / 2), top, 1, h - top - 14);
    }
  },

  // Examine the evidence: scattered observations settle into a distribution on
  // a measured scale.
  evaluate(ctx, w, h, t) {
    const top = 22;
    const base = h - 22;
    const bins = 15;
    const bw = w / bins;
    const step = 9;
    let id = 0;
    for (let b = 0; b < bins; b++) {
      const c = (b - (bins - 1) / 2) / (bins / 4.4);
      const count = Math.max(1, Math.round(Math.exp(-c * c) * ((base - top - 10) / step)));
      for (let k = 0; k < count; k++) {
        id++;
        const tx = b * bw + bw / 2;
        const ty = base - 6 - k * step;
        const sx = hash(id) * w;
        const sy = top + hash(id + 0.4) * (base - top - 10);
        const d = smooth(t * 1.25 - hash(id + 0.8) * 0.25);
        const centre = Math.abs(b - (bins - 1) / 2) < 1.5;
        dot(ctx, lerp(sx, tx, d), lerp(sy, ty, d), 0.85, centre && d > 0.95 ? ACCENT : INK);
      }
    }
    ctx.fillStyle = 'rgba(240, 240, 236, 0.35)';
    ctx.fillRect(0, base, w, 1);
    for (let b = 0; b <= bins; b++) ctx.fillRect(Math.round(b * bw), base, 1, b % 5 === 0 ? 7 : 4);
    tag(ctx, 'OBSERVATIONS', 0, 10);
    tag(ctx, 'SCALE', w, h - 2, 'right');
  },

  // Revise what we know: the earlier estimate stays as a ghost while the
  // revised one moves to where the evidence points.
  refine(ctx, w, h, t) {
    const top = 22;
    const step = 12;
    const cols = Math.floor(w / step);
    const rows = Math.floor((h - top) / step);
    const ax = cols * 0.3;
    const ay = rows * 0.42;
    const bx = cols * 0.66;
    const by = rows * 0.55;
    const r0 = Math.min(cols, rows) * 0.3;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * step + step / 2;
        const y = top + j * step + step / 2;
        dot(ctx, x, y, 0.12);
      }
    }
    const offX = (bx - ax) * step * smooth(t);
    const offY = (by - ay) * step * smooth(t);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const d = Math.hypot(i - ax, j - ay);
        if (d > r0) continue;
        const x = i * step + step / 2;
        const y = top + j * step + step / 2;
        dot(ctx, x, y, 0.35 + 0.25 * (1 - t));
        const tight = 1 - 0.18 * t;
        dot(ctx, ax * step + step / 2 + (x - ax * step - step / 2) * tight + offX, ay * step + top + step / 2 + (y - top - ay * step - step / 2) * tight + offY, 0.4 + 0.55 * t, ACCENT);
      }
    }
    ctx.strokeStyle = `rgba(${ACCENT}, ${0.5 * t})`;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(ax * step + step / 2, top + ay * step + step / 2);
    ctx.lineTo(ax * step + step / 2 + offX, top + ay * step + step / 2 + offY);
    ctx.stroke();
    ctx.setLineDash([]);
    tag(ctx, 'PREVIOUS', Math.max(0, (ax - r0) * step), Math.max(10, top + (ay - r0) * step - 8));
    if (t > 0.5) tag(ctx, 'REVISED', w, 10, 'right');
  },
};

export function initStack(reduced: boolean) {
  const section = document.querySelector<HTMLElement>('.mstack');
  const stack = section?.querySelector<HTMLElement>('.stack');
  if (!section || !stack) return;
  const items = [...stack.querySelectorAll<HTMLElement>('.plate')].map((plate) => {
    const canvas = plate.querySelector<HTMLCanvasElement>('canvas')!;
    const body = plate.querySelector<HTMLElement>('.plate__body')!;
    return { plate, body, canvas, ctx: canvas.getContext('2d')!, fig: FIGS[canvas.dataset.fig!], t: -1, w: 0, h: 0 };
  });
  const n = items.length;

  const paint = (it: (typeof items)[number], t: number) => {
    if (!it.w || Math.abs(t - it.t) < 0.002) return;
    it.t = t;
    it.ctx.clearRect(0, 0, it.w, it.h);
    it.fig(it.ctx, it.w, it.h, t);
  };

  // On phones the heading scrolls off before the plates pin, so the plates
  // get the whole screen. `lead` is everything above the plates in the pin.
  const narrow = matchMedia('(max-width: 700px)');
  let lead = 0;
  const measure = () => {
    lead = narrow.matches && !reduced ? Math.round(stack.offsetTop) : 0;
    section.style.setProperty('--lead', `${lead}px`);
  };

  const size = () => {
    measure();
    const dpr = Math.min(2, devicePixelRatio || 1);
    items.forEach((it) => {
      const r = it.canvas.getBoundingClientRect();
      it.w = Math.round(r.width);
      it.h = Math.round(r.height);
      it.canvas.width = it.w * dpr;
      it.canvas.height = it.h * dpr;
      it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      it.t = -1;
    });
    frame();
  };

  // Scroll is split into beats: plate k arrives over beat k - 1 → k, with a
  // short hold at the end before the section releases.
  const BEATS = n - 1 + 0.4;

  const frame = () => {
    if (reduced) {
      items.forEach((it) => paint(it, 1));
      return;
    }
    const rect = section.getBoundingClientRect();
    // The pin sticks once the section has scrolled by `lead` (phones only).
    const travel = section.offsetHeight - innerHeight - lead;
    const beat = (travel > 0 ? Math.min(1, Math.max(0, (-rect.top - lead) / travel)) : 0) * BEATS;
    const stageH = stack.clientHeight;
    const tab = parseFloat(getComputedStyle(section).getPropertyValue('--tab')) || 0;
    const arrive = items.map((_, k) => (k === 0 ? 1 : smooth(beat - (k - 1))));

    items.forEach((it, k) => {
      const y = k === 0 ? 0 : stageH + 8 - (stageH + 8 - k * tab) * arrive[k];
      it.plate.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      // Covered by the next plate: the content fades, leaving the strip.
      const cover = k < n - 1 ? smooth(arrive[k + 1] * 1.6 - 0.2) : 0;
      it.body.style.opacity = String(1 - cover);
      // The first figure settles as the section scrolls into view.
      const t = k === 0 ? smooth((innerHeight - rect.top) / innerHeight - 0.15) : smooth(arrive[k] * 1.2 - 0.1);
      paint(it, t);
    });
  };

  if (reduced) section.classList.add('is-static');
  new ResizeObserver(size).observe(stack);
  document.fonts?.ready.then(size);
  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      frame();
    });
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
}
