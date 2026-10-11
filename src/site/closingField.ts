// The closing statement's dot field: a still lattice of the hero's particles that
// parts around the cursor (or a finger) and settles back, echoing the hero's
// interaction at a smaller, quieter scale. It never moves on its own.

export function initClosingField(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext('2d')!;
  const SPACING = 16;
  const RADIUS = 110;
  const PUSH = 1400;
  const STIFF = 26;
  const DAMP = 9;

  let w = 0;
  let h = 0;
  let xs = new Float32Array(0);
  let ys = new Float32Array(0);
  let ox = new Float32Array(0);
  let oy = new Float32Array(0);
  let vx = new Float32Array(0);
  let vy = new Float32Array(0);
  let alpha = new Float32Array(0);
  let pointer: { x: number; y: number } | null = null;
  let raf = 0;
  let last = 0;
  let visible = false;

  const layout = () => {
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = Math.floor(w / SPACING);
    const rows = Math.floor(h / SPACING);
    const n = cols * rows;
    const offX = (w - (cols - 1) * SPACING) / 2;
    const offY = (h - (rows - 1) * SPACING) / 2;
    xs = new Float32Array(n);
    ys = new Float32Array(n);
    ox = new Float32Array(n);
    oy = new Float32Array(n);
    vx = new Float32Array(n);
    vy = new Float32Array(n);
    alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r2 = Math.floor(i / cols);
      xs[i] = offX + c * SPACING;
      ys[i] = offY + r2 * SPACING;
      // Densest along a central horizon, fading toward the edges and the title below.
      const fy = ys[i] / h;
      const fx = Math.abs(xs[i] / w - 0.5) * 2;
      alpha[i] = Math.max(0, 0.9 - Math.abs(fy - 0.5) * 1.45) * (1 - fx * fx * 0.7);
    }
    paint();
  };

  const paint = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgb(240, 240, 236)';
    for (let i = 0; i < xs.length; i++) {
      const a = alpha[i];
      if (a < 0.02) continue;
      const d = Math.hypot(ox[i], oy[i]);
      ctx.globalAlpha = Math.min(1, a + d / 60);
      ctx.fillRect(xs[i] + ox[i] - 1, ys[i] + oy[i] - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  };

  const step = (now: number) => {
    const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
    last = now;
    let energy = 0;
    for (let i = 0; i < xs.length; i++) {
      let ax = -ox[i] * STIFF - vx[i] * DAMP;
      let ay = -oy[i] * STIFF - vy[i] * DAMP;
      if (pointer) {
        const dx = xs[i] + ox[i] - pointer.x;
        const dy = ys[i] + oy[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < RADIUS * RADIUS * 4) {
          const f = Math.exp(-d2 / (RADIUS * RADIUS)) * PUSH;
          const inv = 1 / (Math.sqrt(d2) + 0.001);
          ax += dx * inv * f;
          ay += dy * inv * f;
        }
      }
      vx[i] += ax * dt;
      vy[i] += ay * dt;
      ox[i] += vx[i] * dt;
      oy[i] += vy[i] * dt;
      energy += Math.abs(ox[i]) + Math.abs(oy[i]) + Math.abs(vx[i]) + Math.abs(vy[i]);
    }
    paint();
    if (visible && (pointer || energy / xs.length > 0.005)) raf = requestAnimationFrame(step);
    else raf = 0;
  };

  const wake = () => {
    if (reduced || raf || !visible) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
  };

  const toLocal = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointermove', (e) => {
    pointer = toLocal(e);
    wake();
  });
  canvas.addEventListener('pointerdown', (e) => {
    pointer = toLocal(e);
    wake();
  });
  const release = () => {
    pointer = null;
    wake();
  };
  canvas.addEventListener('pointerleave', release);
  canvas.addEventListener('pointerup', (e) => e.pointerType === 'touch' && release());
  canvas.addEventListener('pointercancel', release);

  new ResizeObserver(layout).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  }).observe(canvas);
}
