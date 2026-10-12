import '../styles.css';
import '../site/site.css';
import './questions-lab.css';
import './method-lab.css';
import { initStack } from '../site/stack';

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

initCycle();
initLedger();
initTrace();
initStack(reduced);
queue();
