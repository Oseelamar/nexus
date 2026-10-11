import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { cube, knight, knot, links, type KnotKind, type Rng } from './shapes';

// Placement in the particle zone: fx across the hero width, fy within the zone's
// height (both 0..1), z is world depth (+ toward the camera), size is relative.
export interface Placement {
  fx: number;
  fy: number;
  z: number;
  size: number;
}

export interface ObjectSpec {
  sample: (n: number, rnd: Rng) => Float32Array;
  wide: Placement;
  compact: Placement;
  /** Orientation at time t (seconds). `seed` is a stable per-object random in 0..1. */
  rotate: (t: number, seed: number, out: Quaternion) => Quaternion;
}

export interface Collection {
  name: string;
  objects: ObjectSpec[];
}

const e = new Euler();
const q2 = new Quaternion();

// Links: spin about their own long axis tilt so both rings keep reading as links.
const spinLink = (base: [number, number, number], speed: number) => (t: number, s: number, out: Quaternion) => {
  e.set(base[0] + 0.25 * Math.sin(t * 0.42 + s * 6), base[1] + t * speed, base[2]);
  return out.setFromEuler(e);
};

// Knights: profile faces the camera; yaw sways rather than spinning edge-on.
const swayKnight = (facing: 0 | 1, speed: number) => (t: number, s: number, out: Quaternion) => {
  e.set(0.12 * Math.sin(t * 0.5 + s * 9), facing * Math.PI + 0.75 * Math.sin(t * speed + s * 6.28), 0.06 * Math.sin(t * 0.37 + s * 4));
  return out.setFromEuler(e);
};

// Knots: rotate in their own plane, with a gentle wobble that shows depth.
const turnKnot = (speed: number) => (t: number, s: number, out: Quaternion) => {
  e.set(0.32 * Math.sin(t * 0.33 + s * 6), 0.38 * Math.sin(t * 0.27 + s * 3), t * speed);
  return out.setFromEuler(e);
};

// Cubes: tumble about a tilted axis.
const tumbleCube = (tilt: number, speed: number) => (t: number, s: number, out: Quaternion) => {
  e.set(tilt + 0.6, t * speed + s * 3, tilt);
  out.setFromEuler(e);
  e.set(t * speed * 0.45, 0, 0);
  return out.multiply(q2.setFromEuler(e));
};

const knotOf = (kind: KnotKind) => (n: number, rnd: Rng) => knot(n, rnd, kind);

const P = (fx: number, fy: number, z: number, size: number): Placement => ({ fx, fy, z, size });

// Objects are sorted left→right so particle ranges map to neighbours across
// collections and transitions travel locally instead of across the whole hero.
const byX = (objects: ObjectSpec[]) => objects.sort((a, b) => a.wide.fx - b.wide.fx);

// Each collection has a hierarchy: one or two large focal objects near the camera,
// a few medium ones, and small ones pushed back in depth. `size` is the on-screen
// diameter relative to the zone; z (depth) drives particle size and brightness.
// Placements were checked for clearance at 1440×900 and 390×844.
export const COLLECTIONS: Collection[] = [
  {
    name: 'links',
    objects: byX([
      { sample: links, wide: P(0.36, 0.45, 1.0, 1.75), compact: P(0.42, 0.42, 0.8, 1.5), rotate: spinLink([0.5, 0, 0.35], 0.2) },
      { sample: links, wide: P(0.7, 0.36, 0.2, 1.25), compact: P(0.78, 0.2, 0.2, 1.05), rotate: spinLink([-0.3, 1.2, -0.5], -0.26) },
      { sample: links, wide: P(0.11, 0.4, -0.4, 1.15), compact: P(0.16, 0.1, -0.2, 0.95), rotate: spinLink([0.9, 2.1, 0.2], 0.24) },
      { sample: links, wide: P(0.55, 0.8, -1.8, 0.8), compact: P(0.78, 0.62, -1.2, 0.8), rotate: spinLink([-0.6, 0.6, -0.9], -0.32) },
      { sample: links, wide: P(0.9, 0.72, -1.2, 0.85), compact: P(0.25, 0.82, -1.4, 0.7), rotate: spinLink([0.2, 1.6, 0.8], 0.3) },
      { sample: links, wide: P(0.2, 0.85, -2.2, 0.75), compact: P(0.66, 0.9, -2.0, 0.6), rotate: spinLink([1.1, 0.4, -0.3], -0.28) },
    ]),
  },
  {
    name: 'knights',
    objects: byX([
      { sample: knight, wide: P(0.62, 0.48, 1.0, 1.7), compact: P(0.6, 0.45, 0.8, 1.5), rotate: swayKnight(0, 0.26) },
      { sample: knight, wide: P(0.32, 0.42, 0.3, 1.2), compact: P(0.2, 0.25, 0.2, 1.05), rotate: swayKnight(1, 0.29) },
      { sample: knight, wide: P(0.88, 0.5, -0.3, 1.15), compact: P(0.85, 0.1, -0.4, 0.9), rotate: swayKnight(1, 0.33) },
      { sample: knight, wide: P(0.1, 0.62, -1.0, 0.9), compact: P(0.18, 0.72, -1.0, 0.8), rotate: swayKnight(0, 0.38) },
      { sample: knight, wide: P(0.45, 0.86, -2.0, 0.7), compact: P(0.5, 0.9, -2.0, 0.6), rotate: swayKnight(0, 0.41) },
      { sample: knight, wide: P(0.2, 0.15, -2.4, 0.65), compact: P(0.85, 0.8, -1.6, 0.65), rotate: swayKnight(1, 0.35) },
    ]),
  },
  {
    name: 'knots',
    objects: byX([
      { sample: knotOf('trefoil'), wide: P(0.24, 0.5, 0.9, 1.6), compact: P(0.36, 0.38, 0.8, 1.45), rotate: turnKnot(0.2) },
      { sample: knotOf('cinquefoil'), wide: P(0.74, 0.42, 0.5, 1.4), compact: P(0.78, 0.6, 0.3, 1.1), rotate: turnKnot(-0.22) },
      { sample: knotOf('septafoil'), wide: P(0.5, 0.3, -0.6, 1.0), compact: P(0.82, 0.12, -0.6, 0.8), rotate: turnKnot(0.24) },
      { sample: knotOf('trefoil'), wide: P(0.53, 0.82, -1.8, 0.7), compact: P(0.2, 0.85, -1.4, 0.75), rotate: turnKnot(-0.3) },
      { sample: knotOf('torus34'), wide: P(0.93, 0.78, -1.4, 0.75), compact: P(0.55, 0.9, -1.8, 0.6), rotate: turnKnot(0.32) },
      { sample: knotOf('trefoil'), wide: P(0.06, 0.18, -2.2, 0.6), compact: P(0.1, 0.08, -2.2, 0.5), rotate: turnKnot(-0.27) },
    ]),
  },
  {
    name: 'cubes',
    objects: byX([
      { sample: cube, wide: P(0.5, 0.48, 1.1, 1.45), compact: P(0.5, 0.42, 0.8, 1.35), rotate: tumbleCube(0.3, 0.18) },
      { sample: cube, wide: P(0.22, 0.38, 0.3, 1.1), compact: P(0.16, 0.18, 0.1, 0.9), rotate: tumbleCube(-0.4, -0.24) },
      { sample: cube, wide: P(0.8, 0.36, 0.0, 1.15), compact: P(0.84, 0.16, 0.0, 0.85), rotate: tumbleCube(0.7, 0.21) },
      { sample: cube, wide: P(0.07, 0.72, -1.2, 0.7), compact: P(0.14, 0.68, -1.2, 0.65), rotate: tumbleCube(-0.2, 0.27) },
      { sample: cube, wide: P(0.35, 0.82, -2.0, 0.6), compact: P(0.86, 0.62, -1.4, 0.65), rotate: tumbleCube(0.5, -0.31) },
      { sample: cube, wide: P(0.66, 0.85, -1.6, 0.62), compact: P(0.36, 0.9, -2.0, 0.5), rotate: tumbleCube(-0.6, 0.29) },
      { sample: cube, wide: P(0.95, 0.75, -2.4, 0.55), compact: P(0.7, 0.88, -2.2, 0.5), rotate: tumbleCube(0.1, -0.26) },
    ]),
  },
];

export const MAX_OBJECTS = Math.max(...COLLECTIONS.map((c) => c.objects.length));

/** Base transform of one object resolved for the current viewport. */
export interface ResolvedObject {
  position: Vector3;
  scale: number;
  seed: number;
}

const q = new Quaternion();
const p = new Vector3();
const sv = new Vector3();

/** World matrix of an object at time t: resolved base + float + rotation. */
export function objectMatrix(spec: ObjectSpec, base: ResolvedObject, t: number, out: Matrix4): Matrix4 {
  const s = base.seed;
  // Restrained drift; proportional to size so focal objects don't swing further.
  const amp = base.scale * 0.05;
  p.set(
    base.position.x + amp * Math.sin(t * 0.31 + s * 11),
    base.position.y + amp * 1.3 * Math.sin(t * 0.43 + s * 7),
    base.position.z + amp * 2 * Math.sin(t * 0.23 + s * 5),
  );
  spec.rotate(t, s, q);
  sv.setScalar(base.scale);
  return out.compose(p, q, sv);
}
