import '../styles.css';
import '../site/site.css';
import './questions-lab.css';
import './method-lab.css';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG = 'http://www.w3.org/2000/svg';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

// One rAF-throttled pass per scroll / resize frame, for every study.
const passes: (() => void)[] = [];
function onFrame(fn: () => void) {
  passes.push(fn);
}
let queued = false;
const queue = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    passes.forEach((f) => f());
  });
};
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', queue);

// ------------------------------------------------------------ A — cycle
// The section pins; scroll turns the dial a quarter per stage. Evaluate lights
// its cut back to Experiment; Refine lights the dashed return that closes the
// loop to Investigate.

function initCycle() {
  const section = document.querySelector<HTMLElement>('.mcyc');
  if (!section) return;
  const svg = section.querySelector<SVGSVGElement>('.mcyc__svg')!;
  const ticks = svg.querySelector('.mcyc__ticks')!;
  const progress = svg.querySelector<SVGCircleElement>('.mcyc__progress')!;
  const head = svg.querySelector<SVGRectElement>('.mcyc__head')!;
  const chord = svg.querySelector<SVGPathElement>('.mcyc__chord')!;
  const ret = svg.querySelector<SVGPathElement>('.mcyc__seg[data-seg="3"]')!;
  const stages = [...section.querySelectorAll<HTMLElement>('.mcyc__stage')];
  const stations = [...section.querySelectorAll<HTMLButtonElement>('.mcyc__station')];
  const num = section.querySelector<HTMLElement>('[data-cyc-num]')!;
  const deg = section.querySelector<HTMLElement>('[data-cyc-deg]')!;
  const n = stages.length;

  // An outer scale: a tick every 5°, longer at each station.
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2 - Math.PI / 2;
    const major = i % 18 === 0;
    const r0 = 40;
    const r1 = major ? 43.5 : 41.5;
    ticks.append(
      el('line', {
        x1: 50 + Math.cos(a) * r0,
        y1: 50 + Math.sin(a) * r0,
        x2: 50 + Math.cos(a) * r1,
        y2: 50 + Math.sin(a) * r1,
        ...(major ? { class: 'is-major' } : {}),
      }),
    );
  }

  // Strokes are drawn in viewBox units; keep them 1 CSS pixel wide.
  const unit = () => svg.style.setProperty('--u', String(100 / Math.max(1, svg.clientWidth)));
  new ResizeObserver(unit).observe(svg);

  const travel = () => section.offsetHeight - innerHeight;

  const render = (p: number) => {
    const beat = p * n;
    const index = Math.min(n - 1, Math.floor(beat));
    progress.style.strokeDasharray = `${(p * 100).toFixed(3)} 100`;
    const a = p * Math.PI * 2 - Math.PI / 2;
    const u = 100 / Math.max(1, svg.clientWidth);
    const s = 7 * u;
    head.setAttribute('width', String(s));
    head.setAttribute('height', String(s));
    head.setAttribute('x', String(-s / 2));
    head.setAttribute('y', String(-s / 2));
    head.setAttribute('transform', `translate(${50 + Math.cos(a) * 36} ${50 + Math.sin(a) * 36}) rotate(${p * 360})`);
    head.style.opacity = p > 0.001 && p < 0.999 ? '1' : '0';
    deg.textContent = `${String(Math.round(p * 360)).padStart(3, '0')}°`;
    num.textContent = String(index + 1).padStart(2, '0');
    stages.forEach((st, k) => {
      st.classList.toggle('is-active', k === index);
      st.classList.toggle('is-past', k < index);
    });
    stations.forEach((st, k) => {
      st.classList.toggle('is-active', k === index);
      st.classList.toggle('is-past', k < index);
    });
    chord.classList.toggle('is-lit', index === 2);
    ret.classList.toggle('is-lit', index === 3);
  };

  if (reduced) {
    section.classList.add('is-static');
    stages.forEach((s) => s.classList.add('is-active'));
    progress.style.strokeDasharray = '100 0';
    head.style.display = 'none';
    stations.forEach((st) => st.classList.add('is-past'));
    return;
  }

  stations.forEach((st, k) =>
    st.addEventListener('click', () => {
      const top = section.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + travel() * ((k + 0.5) / n), behavior: 'smooth' });
    }),
  );

  onFrame(() => {
    const t = travel();
    render(t > 0 ? clamp(-section.getBoundingClientRect().top / t) : 0);
  });
}

// ------------------------------------------------------------ B — ledger
// Return paths drawn in the left margin from the live row positions. Hover or
// focus on a stage lights its row, its return path and where that path lands.

function initLedger() {
  const ledger = document.querySelector<HTMLElement>('.ledger');
  if (!ledger) return;
  const svg = ledger.querySelector<SVGSVGElement>('.ledger__returns')!;
  const defs = svg.querySelector('defs')!;
  const rows = [...ledger.querySelectorAll<HTMLElement>('.lrow')];

  const draw = () => {
    svg.replaceChildren(defs);
    const origin = ledger.getBoundingClientRect();
    const inset = parseFloat(getComputedStyle(rows[0]).paddingLeft);
    const yOf = (i: number) => {
      const r = rows[i].querySelector('.lrow__num')!.getBoundingClientRect();
      return r.top + r.height / 2 - origin.top;
    };
    const returns = rows.filter((r) => r.dataset.return !== undefined);
    returns.forEach((row, k) => {
      const from = Number(row.dataset.row);
      const to = Number(row.dataset.return);
      // The longer return runs further out, so the two never cross.
      const x = inset * (k === 0 ? 0.62 : 0.3);
      const y0 = yOf(from);
      const y1 = yOf(to);
      svg.append(
        el('path', {
          d: `M${inset - 8} ${y0} H${x} V${y1} H${inset - 6}`,
          'marker-end': 'url(#led-arrow)',
          'data-from': from,
          'data-to': to,
        }),
      );
    });
  };

  const focus = (index: number | null) => {
    ledger.classList.toggle('is-focused', index !== null);
    const linked = new Set<number>();
    svg.querySelectorAll<SVGPathElement>('path[data-from]').forEach((p) => {
      const from = Number(p.dataset.from);
      const to = Number(p.dataset.to);
      const lit = index !== null && (from === index || to === index);
      p.classList.toggle('is-lit', lit);
      if (lit) {
        linked.add(from);
        linked.add(to);
      }
    });
    rows.forEach((r, i) => {
      r.classList.toggle('is-active', i === index);
      r.classList.toggle('is-lit', linked.has(i) && i !== index);
    });
  };

  rows.forEach((r, i) => {
    r.addEventListener('pointerenter', () => focus(i));
    r.addEventListener('pointerleave', () => focus(null));
    r.addEventListener('focus', () => focus(i));
    r.addEventListener('blur', () => focus(null));
  });
  new ResizeObserver(draw).observe(ledger);
  document.fonts?.ready.then(draw);
}

// ------------------------------------------------------------ C — trace
// A single run of work across the four lanes. It always moves right in time;
// the two dashed segments are the feedback paths, where evidence sends the work
// back (Evaluate → Experiment, Refine → Investigate). Drawn by scroll.

const VISITS = [0, 1, 2, 1, 2, 3, 0, 1, 2, 3];

function initTrace() {
  const trace = document.querySelector<HTMLElement>('.trace');
  if (!trace) return;
  const svg = trace.querySelector<SVGSVGElement>('.trace__svg')!;
  const defs = svg.querySelector('defs')!;
  const lanes = [...trace.querySelectorAll<HTMLElement>('.lane')];

  type Seg = { pts: [number, number][]; len: number; back: boolean; path: SVGPathElement };
  let segs: Seg[] = [];
  let nodes: SVGRectElement[] = [];
  let notes: SVGTextElement[] = [];
  let total = 0;
  let last = -1;

  const build = () => {
    svg.replaceChildren(defs);
    const origin = trace.getBoundingClientRect();
    const tracks = lanes.map((l) => l.querySelector('.lane__track')!.getBoundingClientRect());
    const y = tracks.map((r) => r.top + r.height / 2 - origin.top);
    const x0 = tracks[0].left - origin.left + 10;
    const x1 = tracks[0].right - origin.left - 30;
    const xs = VISITS.map((_, i) => x0 + ((x1 - x0) * i) / (VISITS.length - 1));

    segs = [];
    notes = [];
    for (let i = 1; i < VISITS.length; i++) {
      const a = VISITS[i - 1];
      const b = VISITS[i];
      const mid = (xs[i - 1] + xs[i]) / 2;
      const pts: [number, number][] = [
        [xs[i - 1], y[a]],
        [mid, y[a]],
        [mid, y[b]],
        [xs[i] - 6, y[b]],
      ];
      const len = pts.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
      const back = b < a;
      const path = el('path', back ? { class: 'is-back' } : {});
      svg.append(path);
      segs.push({ pts, len, back, path });
      if (back) {
        const note = el('text', { x: mid + 8, y: (y[a] + y[b]) / 2 + 3 });
        note.textContent = 'NEW EVIDENCE';
        svg.append(note);
        notes.push(note);
      }
    }
    // A final lead-out: the work continues past the frame of the figure.
    const end = VISITS[VISITS.length - 1];
    const lead: [number, number][] = [
      [xs[xs.length - 1], y[end]],
      [x1 + 26, y[end]],
    ];
    const leadPath = el('path');
    svg.append(leadPath);
    segs.push({ pts: lead, len: lead[1][0] - lead[0][0], back: false, path: leadPath });

    nodes = VISITS.map((lane, i) => {
      const r = el('rect', { x: xs[i] - 3.5, y: y[lane] - 3.5, width: 7, height: 7 });
      svg.append(r);
      return r;
    });
    total = segs.reduce((s, g) => s + g.len, 0);
    last = -1;
    update(true);
  };

  // Partial polyline up to `d` px along the segment.
  const partial = (pts: [number, number][], d: number) => {
    let out = `M${pts[0][0]} ${pts[0][1]}`;
    for (let k = 1; k < pts.length && d > 0; k++) {
      const [ax, ay] = pts[k - 1];
      const [bx, by] = pts[k];
      const l = Math.hypot(bx - ax, by - ay);
      const t = Math.min(1, d / l);
      out += ` L${ax + (bx - ax) * t} ${ay + (by - ay) * t}`;
      d -= l;
    }
    return out;
  };

  const update = (force = false) => {
    if (!segs.length) return;
    const r = trace.getBoundingClientRect();
    const p = reduced ? 1 : clamp((innerHeight * 0.7 - r.top) / (r.height + innerHeight * 0.1));
    const drawn = p * total;
    const key = Math.round(drawn);
    if (!force && key === last) return;
    last = key;

    let acc = 0;
    let reached = 0;
    let noteIndex = 0;
    segs.forEach((s, i) => {
      const d = drawn - acc;
      if (d <= 0) {
        s.path.setAttribute('d', '');
        s.path.removeAttribute('marker-end');
      } else {
        s.path.setAttribute('d', partial(s.pts, d));
        s.path.setAttribute('marker-end', 'url(#tr-arrow)');
        if (d >= s.len && i < VISITS.length - 1) reached = i + 1;
      }
      if (s.back) notes[noteIndex++]?.classList.toggle('is-on', d >= s.len);
      acc += s.len;
    });
    const started = drawn > 0;
    nodes.forEach((n, i) => {
      n.classList.toggle('is-on', started && i <= reached);
      n.classList.toggle('is-current', started && i === reached);
    });
    const visited = new Set(started ? VISITS.slice(0, reached + 1) : []);
    lanes.forEach((l, i) => {
      l.classList.toggle('is-on', visited.has(i));
      l.classList.toggle('is-current', started && VISITS[reached] === i);
    });
  };

  new ResizeObserver(build).observe(trace);
  document.fonts?.ready.then(build);
  onFrame(() => update());
}

// ------------------------------------------------------------ D — stack
// Conceptual dot figures, one per stage, in the research specimens' language.
// Each settles as its plate slides into place. Nothing here depicts data.

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

function initStack() {
  const section = document.querySelector<HTMLElement>('.mstk');
  if (!section) return;
  if (reduced) section.classList.add('is-static');
  const plates = [...section.querySelectorAll<HTMLElement>('.plate')];
  const items = plates.map((plate) => {
    const canvas = plate.querySelector<HTMLCanvasElement>('canvas')!;
    return { plate, canvas, ctx: canvas.getContext('2d')!, fig: FIGS[canvas.dataset.fig!], t: -1, w: 0, h: 0 };
  });

  const size = () => {
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

  const frame = () => {
    items.forEach((it) => {
      const stick = parseFloat(getComputedStyle(it.plate).top) || 0;
      const top = it.plate.getBoundingClientRect().top;
      const t = reduced ? 1 : smooth((innerHeight - top) / Math.max(1, innerHeight - stick) * 1.15 - 0.1);
      if (Math.abs(t - it.t) < 0.002 || !it.w) return;
      it.t = t;
      it.ctx.clearRect(0, 0, it.w, it.h);
      it.fig(it.ctx, it.w, it.h, t);
    });
  };

  new ResizeObserver(size).observe(section);
  document.fonts?.ready.then(size);
  onFrame(frame);
}

initCycle();
initLedger();
initTrace();
initStack();
queue();
