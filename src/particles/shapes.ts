// Particle shape generators. Each returns `n` points (xyz, packed) sampled from
// the surface of a recognizable 3D form, centered and normalized so the shape's
// bounding sphere has radius 1. Object scale/orientation is applied later by the
// engine through per-object matrices.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type V3 = [number, number, number];

function normalize(pts: Float32Array): Float32Array {
  const n = pts.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  let r = 0;
  for (let i = 0; i < n; i++) {
    const x = (pts[i * 3] -= cx), y = (pts[i * 3 + 1] -= cy), z = (pts[i * 3 + 2] -= cz);
    r = Math.max(r, Math.hypot(x, y, z));
  }
  for (let i = 0; i < pts.length; i++) pts[i] /= r;
  return pts;
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function unit(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Sample a tube of radius `tube` around a closed parametric curve, uniform in arc length. */
function tubeAroundCurve(n: number, rnd: Rng, curve: (t: number) => V3, tube: number): Float32Array {
  const out = new Float32Array(n * 3);
  const eps = 1e-4;
  const speedAt = (t: number) => {
    const a = curve(t - eps), b = curve(t + eps);
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * eps);
  };
  let maxSpeed = 0;
  for (let i = 0; i < 2000; i++) maxSpeed = Math.max(maxSpeed, speedAt((i / 2000) * Math.PI * 2));

  let i = 0;
  while (i < n) {
    const t = rnd() * Math.PI * 2;
    if (rnd() * maxSpeed > speedAt(t)) continue;
    const c = curve(t);
    const a = curve(t - eps), b = curve(t + eps);
    const T = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const ref: V3 = Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const N = unit(cross(T, ref));
    const B = cross(T, N);
    const phi = rnd() * Math.PI * 2;
    const cp = Math.cos(phi) * tube, sp = Math.sin(phi) * tube;
    out[i * 3] = c[0] + N[0] * cp + B[0] * sp;
    out[i * 3 + 1] = c[1] + N[1] * cp + B[1] * sp;
    out[i * 3 + 2] = c[2] + N[2] * cp + B[2] * sp;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// A — interlocking links: two stadium-shaped chain links threaded through each other.

export function links(n: number, rnd: Rng): Float32Array {
  const L = 0.9; // straight length
  const r = 0.42; // end radius
  const tube = 0.12;
  const P = 2 * L + 2 * Math.PI * r;

  // Point + in-plane tangent on a stadium centered at the origin in the XY plane.
  const stadium = (u: number): { c: [number, number]; t: [number, number] } => {
    if (u < L) return { c: [-L / 2 + u, -r], t: [1, 0] };
    u -= L;
    if (u < Math.PI * r) {
      const a = -Math.PI / 2 + u / r;
      return { c: [L / 2 + r * Math.cos(a), r * Math.sin(a)], t: [-Math.sin(a), Math.cos(a)] };
    }
    u -= Math.PI * r;
    if (u < L) return { c: [L / 2 - u, r], t: [-1, 0] };
    u -= L;
    const a = Math.PI / 2 + u / r;
    return { c: [-L / 2 + r * Math.cos(a), r * Math.sin(a)], t: [-Math.sin(a), Math.cos(a)] };
  };

  // Second link lies in the XZ plane; its end loop wraps the first link's end bar.
  const offsetB = L + 1.5 * r;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const { c, t } = stadium(rnd() * P);
    const nx = t[1], ny = -t[0]; // in-plane normal
    const phi = rnd() * Math.PI * 2;
    const a = Math.cos(phi) * tube, b = Math.sin(phi) * tube;
    const x = c[0] + nx * a, y = c[1] + ny * a, z = b;
    if (i % 2 === 0) {
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    } else {
      out[i * 3] = x + offsetB; out[i * 3 + 1] = z; out[i * 3 + 2] = y;
    }
  }
  return normalize(out);
}

// ---------------------------------------------------------------------------
// B — chess knight: turned (lathe) pedestal plus an extruded Staunton head profile.

const KNIGHT_PROFILE: [number, number][] = [
  [-0.45, 0.55], [-0.5, 0.85], [-0.48, 1.15], [-0.4, 1.45], [-0.28, 1.72], [-0.13, 1.93],
  [-0.03, 2.1], [0.03, 2.3], [0.13, 2.09], [0.3, 2.0], [0.5, 1.87], [0.7, 1.67],
  [0.86, 1.47], [0.92, 1.33], [0.84, 1.21], [0.62, 1.19], [0.42, 1.24], [0.26, 1.17],
  [0.22, 1.0], [0.3, 0.8], [0.42, 0.62], [0.45, 0.55],
];

// (y, radius) pairs of the pedestal, bottom to top.
const KNIGHT_BASE: [number, number][] = [
  [0, 0.78], [0.12, 0.78], [0.18, 0.64], [0.28, 0.58], [0.36, 0.68], [0.46, 0.62], [0.58, 0.5],
];

function insidePolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function knight(n: number, rnd: Rng): Float32Array {
  const poly = KNIGHT_PROFILE;
  const halfThickness = (y: number) => 0.27 - 0.07 * Math.min(1, Math.max(0, (y - 0.55) / 1.75));
  const eye: [number, number] = [0.37, 1.7];

  let area = 0, perim = 0;
  const edges: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    area += x0 * y1 - x1 * y0;
    const len = Math.hypot(x1 - x0, y1 - y0);
    perim += len;
    edges.push(perim);
  }
  area = Math.abs(area) / 2;

  const segs: number[] = [];
  let latheArea = 0;
  for (let i = 0; i < KNIGHT_BASE.length - 1; i++) {
    const [y0, r0] = KNIGHT_BASE[i], [y1, r1] = KNIGHT_BASE[i + 1];
    latheArea += Math.PI * (r0 + r1) * Math.hypot(y1 - y0, r1 - r0);
    segs.push(latheArea);
  }
  const discArea = Math.PI * KNIGHT_BASE[0][1] ** 2;

  // Walls get extra weight so the silhouette edge reads crisply.
  const wFace = area * 2, wWall = perim * 0.48 * 1.4, wLathe = latheArea, wDisc = discArea * 0.5;
  const wTotal = wFace + wWall + wLathe + wDisc;

  const out = new Float32Array(n * 3);
  let i = 0;
  while (i < n) {
    const pick = rnd() * wTotal;
    let x: number, y: number, z: number;
    if (pick < wFace) {
      x = -0.52 + rnd() * 1.46;
      y = 0.55 + rnd() * 1.76;
      if (!insidePolygon(x, y, poly)) continue;
      if (Math.hypot(x - eye[0], y - eye[1]) < 0.065) continue;
      z = (rnd() < 0.5 ? -1 : 1) * halfThickness(y);
    } else if (pick < wFace + wWall) {
      const d = rnd() * perim;
      let k = 0;
      while (edges[k] < d) k++;
      const [x0, y0] = poly[k], [x1, y1] = poly[(k + 1) % poly.length];
      const t = rnd();
      x = x0 + (x1 - x0) * t;
      y = y0 + (y1 - y0) * t;
      z = (rnd() * 2 - 1) * halfThickness(y);
    } else if (pick < wFace + wWall + wLathe) {
      const d = rnd() * latheArea;
      let k = 0;
      while (segs[k] < d) k++;
      const [y0, r0] = KNIGHT_BASE[k], [y1, r1] = KNIGHT_BASE[k + 1];
      const t = rnd();
      const rr = r0 + (r1 - r0) * t;
      const a = rnd() * Math.PI * 2;
      x = Math.cos(a) * rr;
      y = y0 + (y1 - y0) * t;
      z = Math.sin(a) * rr;
    } else {
      const rr = Math.sqrt(rnd()) * KNIGHT_BASE[0][1];
      const a = rnd() * Math.PI * 2;
      x = Math.cos(a) * rr;
      y = 0;
      z = Math.sin(a) * rr;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    i++;
  }
  return normalize(out);
}

// ---------------------------------------------------------------------------
// C — mathematical knots.

export type KnotKind = 'trefoil' | 'septafoil' | 'cinquefoil' | 'torus34';

export function knot(n: number, rnd: Rng, kind: KnotKind): Float32Array {
  const torus = (p: number, q: number) => (t: number): V3 => {
    // A wider torus radius keeps the knot's center open so crossings stay legible.
    const rr = 2.5 + Math.cos(q * t);
    return [rr * Math.cos(p * t), rr * Math.sin(p * t), -1.2 * Math.sin(q * t)];
  };
  switch (kind) {
    case 'trefoil':
      return normalize(tubeAroundCurve(n, rnd, torus(2, 3), 0.36));
    case 'cinquefoil':
      return normalize(tubeAroundCurve(n, rnd, torus(2, 5), 0.3));
    case 'torus34':
      return normalize(tubeAroundCurve(n, rnd, torus(3, 4), 0.26));
    case 'septafoil':
      return normalize(tubeAroundCurve(n, rnd, torus(2, 7), 0.26));
  }
}

// ---------------------------------------------------------------------------
// D — geometric cube: faces plus dense, crisp edges.

export function cube(n: number, rnd: Rng): Float32Array {
  const out = new Float32Array(n * 3);
  const h = 0.5;
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (rnd() < 0.5) {
      // face
      const face = Math.floor(rnd() * 6);
      const u = (rnd() * 2 - 1) * h, v = (rnd() * 2 - 1) * h;
      const s = face % 2 === 0 ? h : -h;
      const axis = face >> 1;
      [x, y, z] = axis === 0 ? [s, u, v] : axis === 1 ? [u, s, v] : [u, v, s];
    } else {
      // edge
      const e = Math.floor(rnd() * 12);
      const t = (rnd() * 2 - 1) * h;
      const a = e & 1 ? h : -h, b = e & 2 ? h : -h;
      const axis = e >> 2;
      [x, y, z] = axis === 0 ? [t, a, b] : axis === 1 ? [a, t, b] : [a, b, t];
      const j = 0.008;
      x += (rnd() * 2 - 1) * j; y += (rnd() * 2 - 1) * j; z += (rnd() * 2 - 1) * j;
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return normalize(out);
}
