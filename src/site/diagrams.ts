// Method diagram line work, drawn in SVG from the live positions of the HTML
// elements so it stays exact at every breakpoint: a four-stage flow with
// forward connectors and dashed feedback paths; hovering or focusing a stage
// highlights its connections.

const SVG = 'http://www.w3.org/2000/svg';

type Box = { l: number; r: number; t: number; b: number; cx: number; cy: number };

function boxOf(el: Element, origin: DOMRect): Box {
  const r = el.getBoundingClientRect();
  const l = r.left - origin.left;
  const t = r.top - origin.top;
  return { l, r: l + r.width, t, b: t + r.height, cx: l + r.width / 2, cy: t + r.height / 2 };
}

function path(d: string, attrs: Record<string, string> = {}) {
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', d);
  for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
  return p;
}

function onLayout(target: Element, draw: () => void) {
  new ResizeObserver(draw).observe(target);
  document.fonts?.ready.then(draw);
}

// ------------------------------------------------------------ method flow

export function initFlow() {
  const flow = document.querySelector<HTMLElement>('.flow');
  const svg = flow?.querySelector<SVGSVGElement>('.flow__lines');
  if (!flow || !svg) return;
  const defs = svg.querySelector('defs')!;
  const nodes = [...flow.querySelectorAll<HTMLElement>('.node')];
  const ARROW = { 'marker-end': 'url(#flow-arrow)' };

  const draw = () => {
    svg.replaceChildren(defs);
    const origin = flow.getBoundingClientRect();
    const b = nodes.map((n) => boxOf(n, origin));
    const sameRow = (i: number, j: number) => Math.abs(b[i].t - b[j].t) < 4;
    const singleRow = b.every((_, i) => sameRow(0, i));
    const singleCol = b.every((x) => Math.abs(x.l - b[0].l) < 4);
    const add = (d: string, from: number, to: number, feedback = false) =>
      svg.append(
        path(d, { ...ARROW, 'data-from': String(from), 'data-to': String(to), ...(feedback ? { class: 'is-feedback' } : {}) }),
      );

    // Forward sequence.
    for (let i = 0; i < b.length - 1; i++) {
      const a = b[i];
      const c = b[i + 1];
      if (sameRow(i, i + 1)) add(`M${a.r} ${a.cy} H${c.l - 2}`, i, i + 1);
      else if (singleCol) add(`M${a.cx} ${a.b} V${c.t - 2}`, i, i + 1);
      else {
        const midY = (a.b + c.t) / 2 - 6;
        add(`M${a.cx} ${a.b} V${midY} H${c.cx} V${c.t - 2}`, i, i + 1);
      }
    }

    // Feedback: Refine → Investigate, and Evaluate → Experiment.
    const last = b.length - 1;
    if (singleRow) {
      const low = Math.max(...b.map((x) => x.b)) + 40;
      const high = Math.min(...b.map((x) => x.t)) - 36;
      add(`M${b[last].cx} ${b[last].b} V${low} H${b[0].cx} V${b[0].b + 2}`, last, 0, true);
      add(`M${b[2].cx} ${b[2].t} V${high} H${b[1].cx} V${b[1].t - 2}`, 2, 1, true);
    } else if (singleCol) {
      const right = Math.max(...b.map((x) => x.r));
      add(`M${b[last].r} ${b[last].cy} H${right + 40} V${b[0].cy} H${b[0].r + 2}`, last, 0, true);
      add(`M${b[2].r} ${b[2].cy + 10} H${right + 20} V${b[1].cy + 10} H${b[1].r + 2}`, 2, 1, true);
    } else {
      // 2 × 2: Refine (bottom right) loops round the left edge to Investigate;
      // Evaluate (bottom left) rises through the column gutter into Experiment.
      const low = Math.max(...b.map((x) => x.b)) + 32;
      const left = Math.min(...b.map((x) => x.l)) - 24;
      add(`M${b[last].cx} ${b[last].b} V${low} H${left} V${b[0].cy} H${b[0].l - 2}`, last, 0, true);
      const gutterX = (b[2].r + b[1].l) / 2;
      add(`M${b[2].r} ${b[2].t + 16} H${gutterX} V${b[1].b - 16} H${b[1].l - 2}`, 2, 1, true);
    }
  };

  const focus = (index: number | null) => {
    flow.classList.toggle('is-focused', index !== null);
    const linked = new Set<number>(index === null ? [] : [index]);
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
    nodes.forEach((n, i) => {
      n.classList.toggle('is-active', i === index);
      n.classList.toggle('is-lit', index !== null && linked.has(i) && i !== index);
    });
  };

  nodes.forEach((n, i) => {
    n.addEventListener('pointerenter', () => focus(i));
    n.addEventListener('pointerleave', () => focus(null));
    n.addEventListener('focus', () => focus(i));
    n.addEventListener('blur', () => focus(null));
  });
  onLayout(flow, draw);
}
