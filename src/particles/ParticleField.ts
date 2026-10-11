import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  HalfFloatType,
  Matrix4,
  NormalBlending,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type IUniform,
} from 'three';
import { GPUComputationRenderer, type Variable } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { COLLECTIONS, MAX_OBJECTS, objectMatrix, type Collection, type ResolvedObject } from './collections';
import { mulberry32 } from './shapes';
import { offsetShader, pointsFragment, pointsVertex, velocityShader } from './shaders';

export interface ParticleFieldOptions {
  /** Element whose box the canvas covers; pointer events are read from it. */
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Particles stay above this element (the hero's text block). */
  content: HTMLElement;
  /** Optional overlay bar at the top of the host; particles stay below it. */
  nav?: HTMLElement | null;
  color?: string;
  /** Verification hooks (driven from URL params in main.ts). */
  debug?: {
    /** Start on this collection, already assembled. */
    collection?: number;
    /** Freeze a transition toward the next collection at this progress (0..1). */
    morph?: number;
    /** Stop the automatic cycle. */
    hold?: boolean;
    /** Simulated pointer position in host css px. */
    cursor?: [number, number];
    /** Pre-simulate this many seconds at 60fps before the first frame. */
    advance?: number;
  };
}

const CAM_DIST = 10;
const FOV = 35;

// Timing (seconds).
const PERIOD = 5; // a new collection starts forming every PERIOD seconds
const MORPH = 1.9; // travel time of one particle
const STAGGER = 0.55; // spread of departure times

export class ParticleField {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  private gpu: GPUComputationRenderer;
  private velVar: Variable;
  private offVar: Variable;
  private material: ShaderMaterial;
  private shared: Record<string, IUniform>;
  private textures: DataTexture[];
  private resolved: ResolvedObject[][] = [];
  private fromMats = Array.from({ length: MAX_OBJECTS }, () => new Matrix4());
  private toMats = Array.from({ length: MAX_OBJECTS }, () => new Matrix4());

  private current = 0;
  private next = 0;
  private morphClock = 1e3;
  private morphing = false;
  private cycleClock = 0;
  private motionTime = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private visible = true;

  // Pointer state (NDC), smoothed toward the latest event.
  private pointerTarget = new Vector2();
  private pointer = new Vector2();
  private pointerActive = false;
  private pointerKind = 'mouse';
  private cursor = 0;
  private cursorWorld = new Vector3();
  private cursorVel = new Vector3();
  private raycaster = new Raycaster();
  private plane = new Plane(new Vector3(0, 0, 1), 0);
  private tmp = new Vector3();

  private reducedMotion: MediaQueryList;
  private spread = 0;
  private frames = 0;
  private width = 1;
  private height = 1;

  constructor(private opts: ParticleFieldOptions) {
    const small = matchMedia('(max-width: 767px)').matches;
    // Texture dimensions = particle count. Reduced on small screens.
    const texW = small ? 128 : 256;
    const texH = small ? 112 : 160;
    const count = texW * texH;

    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    this.renderer = new WebGLRenderer({ canvas: opts.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 1);
    this.camera.position.set(0, 0, CAM_DIST);

    // --- Collection textures: local point (xyz) + object index (w) per particle.
    const rnd = mulberry32(7);
    this.textures = COLLECTIONS.map((c) => this.buildCollectionTexture(c, texW, texH, rnd));

    const seedData = new Float32Array(count * 4);
    for (let i = 0; i < seedData.length; i++) seedData[i] = rnd();
    const seedTex = this.dataTexture(seedData, texW, texH);

    this.shared = {
      uFrom: { value: this.textures[0] },
      uTo: { value: this.textures[0] },
      uSeed: { value: seedTex },
      uFromM: { value: this.fromMats },
      uToM: { value: this.toMats },
      uMorph: { value: 1e3 },
      uMorphDur: { value: MORPH },
      uStagger: { value: STAGGER },
      uSpread: { value: 0.32 },
    };

    // --- GPU simulation of per-particle displacement.
    this.gpu = new GPUComputationRenderer(texW, texH, this.renderer);
    this.gpu.setDataType(HalfFloatType);
    const off0 = this.gpu.createTexture();
    const vel0 = this.gpu.createTexture();
    // Start scattered so the first collection assembles on load.
    const dbg = opts.debug ?? {};
    const startSpread = this.reducedMotion.matches || dbg.collection !== undefined ? 0 : 1;
    const od = off0.image.data as unknown as Float32Array;
    for (let i = 0; i < count; i++) {
      od[i * 4] = (rnd() * 2 - 1) * 2.4 * startSpread;
      od[i * 4 + 1] = (rnd() * 2 - 1) * 1.2 * startSpread;
      od[i * 4 + 2] = (rnd() * 2 - 1) * 1.5 * startSpread;
      od[i * 4 + 3] = 1;
    }
    this.velVar = this.gpu.addVariable('tVel', velocityShader, vel0);
    this.offVar = this.gpu.addVariable('tOff', offsetShader, off0);
    this.gpu.setVariableDependencies(this.velVar, [this.velVar, this.offVar]);
    this.gpu.setVariableDependencies(this.offVar, [this.velVar, this.offVar]);

    Object.assign(this.velVar.material.uniforms, this.shared, {
      uDt: { value: 1 / 60 },
      uRayO: { value: new Vector3() },
      uRayD: { value: new Vector3(0, 0, -1) },
      uCursor: { value: 0 },
      uCursorVel: { value: new Vector3() },
      uRadius: { value: 0.5 },
      uPush: { value: 12 },
      uDrag: { value: 2.2 },
      uStiff: { value: 15 },
      uDamp: { value: 6.6 },
    });
    this.offVar.material.uniforms.uDt = { value: 1 / 60 };

    const err = this.gpu.init();
    if (err) throw new Error(err);

    // --- Render pass.
    const refs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      refs[i * 2] = ((i % texW) + 0.5) / texW;
      refs[i * 2 + 1] = (Math.floor(i / texW) + 0.5) / texH;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aRef', new BufferAttribute(refs, 2));

    const color = hexToVec3(opts.color ?? '#F0F0EC');
    this.material = new ShaderMaterial({
      uniforms: {
        ...this.shared,
        uOff: { value: null },
        uSize: { value: small ? 1.55 : 1.6 },
        uPixelRatio: { value: 1 },
        uCamDist: { value: CAM_DIST },
        uColor: { value: color },
      },
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
    });
    const points = new Points(geo, this.material);
    points.frustumCulled = false;
    this.scene.add(points);

    if (dbg.collection !== undefined) {
      this.current = this.next = dbg.collection % COLLECTIONS.length;
      this.shared.uFrom.value = this.shared.uTo.value = this.textures[this.current];
    }
    if (dbg.morph !== undefined) {
      this.next = (this.current + 1) % COLLECTIONS.length;
      this.morphing = true;
      this.shared.uTo.value = this.textures[this.next];
    }

    this.bindEvents();
    this.resize();
    this.updateMatrices();
  }

  start() {
    if (this.running) return;
    const adv = this.opts.debug?.advance ?? 0;
    for (let i = 0; i < adv * 60; i++) this.step(1 / 60);
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (!this.visible) {
        this.last = now;
        return;
      }
      const dt = Math.min(Math.max((now - this.last) / 1000, 0), 1 / 30);
      this.last = now;
      this.step(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Debug snapshot of the animation state. */
  stats() {
    return { t: +this.motionTime.toFixed(2), frames: this.frames, cursor: +this.cursor.toFixed(2), visible: this.visible, current: this.current };
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  // -------------------------------------------------------------------------

  private buildCollectionTexture(c: Collection, w: number, h: number, rnd: () => number): DataTexture {
    const count = w * h;
    const data = new Float32Array(count * 4);
    // Particles per object follow its visual size, so density reads evenly.
    const weights = c.objects.map((o) => o.wide.size ** 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let start = 0;
    c.objects.forEach((obj, k) => {
      const n = k === c.objects.length - 1 ? count - start : Math.round((weights[k] / total) * count);
      const pts = obj.sample(n, rnd);
      for (let i = 0; i < n; i++) {
        const j = (start + i) * 4;
        data[j] = pts[i * 3];
        data[j + 1] = pts[i * 3 + 1];
        data[j + 2] = pts[i * 3 + 2];
        data[j + 3] = k;
      }
      start += n;
    });
    return this.dataTexture(data, w, h);
  }

  private dataTexture(data: Float32Array, w: number, h: number) {
    const t = new DataTexture(data, w, h, RGBAFormat, FloatType);
    t.needsUpdate = true;
    return t;
  }

  private bindEvents() {
    const host = this.opts.host;
    const toNdc = (e: PointerEvent) => {
      const r = this.opts.canvas.getBoundingClientRect();
      this.pointerTarget.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    host.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && !this.pointerActive) return;
      toNdc(e);
      if (!this.pointerActive || this.pointerKind !== e.pointerType) this.pointer.copy(this.pointerTarget);
      this.pointerKind = e.pointerType;
      this.pointerActive = true;
    });
    host.addEventListener('pointerdown', (e) => {
      toNdc(e);
      this.pointer.copy(this.pointerTarget);
      this.pointerKind = e.pointerType;
      this.pointerActive = true;
    });
    const end = (e: PointerEvent) => {
      if (e.type === 'pointerleave' || e.pointerType === 'touch') this.pointerActive = false;
    };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
    host.addEventListener('pointerleave', end);

    new ResizeObserver(() => this.resize()).observe(host);

    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting && document.visibilityState === 'visible';
    }).observe(host);
    document.addEventListener('visibilitychange', () => {
      const r = host.getBoundingClientRect();
      this.visible = document.visibilityState === 'visible' && r.bottom > 0 && r.top < innerHeight;
    });
  }

  private resize() {
    const w = this.opts.host.clientWidth;
    const h = this.opts.host.clientHeight;
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.material.uniforms.uPixelRatio.value = dpr;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Particle zone: from just below the top edge to just above the text block.
    const contentTop = this.opts.content.offsetTop;
    const nav = this.opts.nav;
    const zoneTop = Math.max(Math.min(48, h * 0.05), nav ? nav.offsetTop + nav.offsetHeight + 8 : 0);
    const zoneBottom = contentTop - Math.min(36, h * 0.04);
    const zoneH = Math.max(120, zoneBottom - zoneTop);
    const compact = w / zoneH < 1.5;
    const base = compact ? Math.min(w * 0.36, zoneH * 0.32) : Math.min(zoneH * 0.46, w * 0.17);

    // Cursor radius ≈ 95 css px at depth 0 (smaller on phones).
    const worldPerPx0 = (2 * Math.tan((FOV * Math.PI) / 360) * CAM_DIST) / h;
    this.velVar.material.uniforms.uRadius.value = (compact ? 80 : 115) * worldPerPx0;
    this.spread = 40 * worldPerPx0;

    // Keep object centres inside the page frame lines (CSS --frame) so shapes
    // don't straddle them.
    const frame = parseFloat(getComputedStyle(this.opts.host).getPropertyValue('--frame')) || 0;
    const zoneLeft = frame ? frame + (compact ? 12 : 40) : 0;

    this.resolved = COLLECTIONS.map((c) =>
      c.objects.map((o, k) => {
        const pl = compact ? o.compact : o.wide;
        const px = zoneLeft + pl.fx * (w - 2 * zoneLeft);
        const py = zoneTop + pl.fy * zoneH;
        const position = this.screenToWorld(px, py, pl.z);
        const worldPerPx = (2 * Math.tan((FOV * Math.PI) / 360) * (CAM_DIST - pl.z)) / h;
        const scale = (base * pl.size * 0.5) * worldPerPx;
        return { position, scale, seed: fract(Math.sin((k + 1) * 12.9898 + c.name.length * 78.233) * 43758.5453) };
      }),
    );
  }

  private screenToWorld(px: number, py: number, z: number): Vector3 {
    const ndc = new Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    const t = (z - origin.z) / direction.z;
    return origin.clone().addScaledVector(direction, t);
  }

  private updateMatrices() {
    if (!this.resolved.length) return; // not laid out yet (zero-size host)
    const t = this.reducedMotion.matches ? 0 : this.motionTime;
    const from = COLLECTIONS[this.current];
    from.objects.forEach((o, k) => objectMatrix(o, this.resolved[this.current][k], t, this.fromMats[k]));
    const toIdx = this.morphing ? this.next : this.current;
    COLLECTIONS[toIdx].objects.forEach((o, k) => objectMatrix(o, this.resolved[toIdx][k], t, this.toMats[k]));
  }

  private step(dt: number) {
    if (!this.resolved.length) return;
    const reduced = this.reducedMotion.matches;
    this.motionTime += dt;
    this.frames++;

    // --- Collection cycle.
    const dbg = this.opts.debug ?? {};
    if (dbg.cursor && this.width > 1) {
      this.pointerTarget.set((dbg.cursor[0] / this.width) * 2 - 1, -(dbg.cursor[1] / this.height) * 2 + 1);
      this.pointerActive = true;
    }
    if (dbg.morph !== undefined) this.morphClock = dbg.morph * (MORPH + STAGGER) - dt;
    if (!dbg.hold) this.cycleClock += dt;
    if (!this.morphing && this.cycleClock >= (reduced ? PERIOD * 1.6 : PERIOD)) {
      this.cycleClock = 0;
      this.morphing = true;
      this.next = (this.current + 1) % COLLECTIONS.length;
      this.morphClock = 0;
      this.shared.uTo.value = this.textures[this.next];
    }
    if (this.morphing) {
      this.morphClock += dt;
      if (this.morphClock >= MORPH + STAGGER) {
        this.morphing = false;
        this.current = this.next;
        this.shared.uFrom.value = this.textures[this.current];
        this.shared.uTo.value = this.textures[this.current];
        this.morphClock = 1e3;
      }
    }
    this.shared.uMorph.value = this.morphClock;
    this.shared.uSpread.value = reduced ? 0 : this.spread;
    this.updateMatrices();

    // --- Cursor.
    const u = this.velVar.material.uniforms;
    const wantCursor = this.pointerActive && !reduced ? 1 : 0;
    this.cursor += (wantCursor - this.cursor) * (1 - Math.exp(-dt * (wantCursor ? 5 : 2.5)));
    this.pointer.lerp(this.pointerTarget, 1 - Math.exp(-dt * 16));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    u.uRayO.value.copy(this.raycaster.ray.origin);
    u.uRayD.value.copy(this.raycaster.ray.direction);
    if (this.raycaster.ray.intersectPlane(this.plane, this.tmp)) {
      const v = this.tmp.clone().sub(this.cursorWorld).divideScalar(Math.max(dt, 1e-3));
      if (v.length() > 8) v.setLength(8);
      this.cursorVel.lerp(v, 1 - Math.exp(-dt * 10));
      this.cursorWorld.copy(this.tmp);
    }
    u.uCursor.value = this.cursor;
    u.uCursorVel.value.copy(this.cursorVel);

    // --- Simulate + draw.
    u.uDt.value = dt;
    this.offVar.material.uniforms.uDt.value = dt;
    this.gpu.compute();
    this.material.uniforms.uOff.value = this.gpu.getCurrentRenderTarget(this.offVar).texture;
    this.renderer.render(this.scene, this.camera);
  }
}

function fract(x: number) {
  return x - Math.floor(x);
}

function hexToVec3(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  // Raw sRGB values: the shader writes them straight to the canvas.
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
