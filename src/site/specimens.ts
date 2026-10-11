// Conceptual dot-matrix figures for the four research areas. They extend the
// hero's particle language into still "specimen" plates. Each figure has an idle
// state and a hover state; hovering the research cell eases between them.
// Nothing here depicts data: every caption says the figure is conceptual.

const INK = '240, 240, 236';
const ACCENT = '215, 185, 255';

type Kind = 'shift' | 'emerge' | 'probe' | 'replicate';

// Deterministic per-point randomness, so figures are stable between frames.
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left') {
  ctx.font = '400 10px "Roboto Mono", monospace';
  ctx.textAlign = align;
  ctx.fillStyle = 'rgba(186, 185, 184, 0.75)';
  ctx.fillText(text, x, y);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, r = 1.15, rgb = INK) {
  ctx.fillStyle = `rgba(${rgb}, ${a})`;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const draw: Record<Kind, (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, clock: number) => void> = {
  // Reliability: a regular lattice (conditions a model was evaluated on) that
  // loosens past a boundary (conditions it meets later). Hover widens the gap.
  shift(ctx, w, h, t) {
    const step = 12;
    const top = 22;
    const cols = Math.floor(w / step);
    const rows = Math.floor((h - top) / step);
    const edge = Math.round(cols * 0.56) * step;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * step + step / 2;
        const y = top + j * step + step / 2;
        const past = Math.max(0, (x - edge) / (w - edge));
        const amp = past * step * (0.9 + 1.6 * t);
        const k = i * 131 + j;
        const dx = (hash(k) - 0.5) * 2 * amp;
        const dy = (hash(k + 0.5) - 0.5) * 2 * amp;
        dot(ctx, x + dx, y + dy, past > 0 ? 0.85 - past * (0.4 + 0.2 * t) : 0.85);
      }
    }
    ctx.strokeStyle = 'rgba(240, 240, 236, 0.35)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(edge + 0.5, top - 6);
    ctx.lineTo(edge + 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'EVALUATED', 0, 10);
    label(ctx, 'ENCOUNTERED', edge + 8, 10);
  },

  // Foundations: unorganised points on the left settle into structure on the
  // right, as a stand-in for representations forming. Hover tightens it.
  emerge(ctx, w, h, t) {
    const top = 22;
    const n = Math.round((w * (h - top)) / 120);
    const centers = [0.52, 0.7, 0.86].map((cx, i) => ({ x: cx * w, y: top + (0.3 + 0.38 * ((i * 7) % 3) / 2) * (h - top) }));
    for (let i = 0; i < n; i++) {
      const rx = hash(i) * w;
      const ry = top + hash(i + 0.3) * (h - top);
      const c = centers[i % centers.length];
      const spread = (h - top) * (0.14 - 0.06 * t);
      const ang = hash(i + 0.7) * Math.PI * 2;
      const rad = Math.sqrt(hash(i + 0.9)) * spread;
      const tx = c.x + Math.cos(ang) * rad;
      const ty = c.y + Math.sin(ang) * rad;
      const m = smooth(0.18, 0.72, rx / w) * (0.82 + 0.18 * t);
      dot(ctx, rx + (tx - rx) * m, ry + (ty - ry) * m, 0.45 + 0.45 * m);
    }
    label(ctx, 'UNSTRUCTURED', 0, 10);
    label(ctx, 'STRUCTURED', w, 10, 'right');
  },

  // Interpretability: a field of internal activity with a probe window relating
  // a region of it to the output column. Hover moves the probe.
  probe(ctx, w, h, t) {
    const step = 12;
    const top = 22;
    const fieldW = w * 0.68;
    const cols = Math.floor(fieldW / step);
    const rows = Math.floor((h - top) / step);
    const e = t * t * (3 - 2 * t);
    const pw = step * 5;
    const ph = step * 4;
    const px = step * (2 + Math.round(e * (cols - 9)));
    const py = top + step * (1 + Math.round(e * (rows - 6)));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * step + step / 2;
        const y = top + j * step + step / 2;
        const inside = x > px && x < px + pw && y > py && y < py + ph;
        const a = 0.18 + 0.5 * hash(i * 71 + j * 13);
        dot(ctx, x, y, inside ? 0.95 : a);
      }
    }
    ctx.strokeStyle = 'rgba(240, 240, 236, 0.85)';
    ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
    const ox = w - step * 1.5;
    ctx.strokeStyle = 'rgba(240, 240, 236, 0.3)';
    ctx.beginPath();
    ctx.moveTo(px + pw, py + ph / 2 + 0.5);
    ctx.lineTo(ox - step, py + ph / 2 + 0.5);
    ctx.stroke();
    for (let j = 0; j < rows; j++) {
      const y = top + j * step + step / 2;
      const lit = Math.abs(y - (py + ph / 2)) < step * 1.5;
      dot(ctx, ox, y, lit ? 0.95 : 0.3, 1.6);
    }
    label(ctx, 'INTERNAL', 0, 10);
    label(ctx, 'OUTPUT', w, 10, 'right');
  },

  // Open science: one procedure, run three times independently, agreeing point
  // for point. On hover a single point is traced across all three runs.
  replicate(ctx, w, h, t, clock) {
    const top = 22;
    const gap = 20;
    const pw = (w - gap * 2) / 3;
    const step = 10;
    const cols = Math.floor(pw / step);
    const rows = Math.floor((h - top) / step);
    const lit: number[] = [];
    for (let k = 0; k < cols * rows; k++) if (hash(k * 3.7) > 0.62) lit.push(k);
    const traced = lit[Math.floor(clock / 0.7) % lit.length];
    ['RUN A', 'RUN B', 'RUN C'].forEach((name, p) => {
      const ox = p * (pw + gap);
      for (let k = 0; k < cols * rows; k++) {
        const x = ox + (k % cols) * step + step / 2;
        const y = top + Math.floor(k / cols) * step + step / 2;
        const on = hash(k * 3.7) > 0.62;
        if (t > 0.01 && k === traced) dot(ctx, x, y, t, 2.2, ACCENT);
        else dot(ctx, x, y, on ? 0.85 : 0.14);
      }
      label(ctx, name, ox, 10);
    });
  },
};

export function initSpecimens(reduced: boolean) {
  document.querySelectorAll<HTMLElement>('[data-specimen]').forEach((fig) => {
    const kind = fig.dataset.specimen as Kind;
    const canvas = fig.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    const host = fig.closest<HTMLElement>('.area') ?? fig;
    let w = 0;
    let h = 0;
    let t = 0;
    let target = 0;
    let clock = 0;
    let raf = 0;
    let last = 0;

    const render = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw[kind](ctx, w, h, t, clock);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      clock += dt;
      t += (target - t) * (1 - Math.exp(-dt * 6));
      if (Math.abs(target - t) < 0.002) t = target;
      render();
      // Keep running while easing, or while the replication trace is shown.
      if (t !== target || (kind === 'replicate' && t > 0)) raf = requestAnimationFrame(tick);
      else raf = 0;
    };

    const animateTo = (v: number) => {
      target = v;
      if (reduced) {
        t = v;
        render();
        return;
      }
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    host.addEventListener('pointerenter', () => animateTo(1));
    host.addEventListener('pointerleave', () => animateTo(0));

    new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      render();
    }).observe(canvas);

    // Fonts load after first paint; redraw so the canvas labels use Roboto Mono.
    document.fonts?.ready.then(render);
  });
}
