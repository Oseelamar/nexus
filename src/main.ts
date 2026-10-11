import './styles.css';
import { ParticleField, type ParticleFieldOptions } from './particles/ParticleField';
import { initSite } from './site';

const host = document.querySelector<HTMLElement>('.hero')!;
const canvas = host.querySelector<HTMLCanvasElement>('.hero__particles')!;
const content = host.querySelector<HTMLElement>('.hero__content')!;
const nav = host.querySelector<HTMLElement>('.nav');

// Debug params for verification, e.g. ?c=1&hold, ?c=0&m=0.5, ?c=2&hold&cursor=420,260
const q = new URLSearchParams(location.search);
const debug: ParticleFieldOptions['debug'] = {};
if (q.has('c')) debug.collection = Number(q.get('c'));
if (q.has('m')) debug.morph = Number(q.get('m'));
if (q.has('hold') || q.has('m')) debug.hold = true;
if (q.has('adv')) debug.advance = Number(q.get('adv'));
if (q.has('cursor')) debug.cursor = q.get('cursor')!.split(',').map(Number) as [number, number];

try {
  const field = new ParticleField({ host, canvas, content, nav, color: '#F0F0EC', debug });
  field.start();
  if (q.has('hud')) {
    const hud = document.body.appendChild(document.createElement('pre'));
    hud.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;color:#0f0;font:12px monospace;z-index:9';
    setInterval(() => (hud.textContent = JSON.stringify(field.stats())), 100);
  }
} catch (err) {
  // Without WebGL2 float textures the hero simply stays black behind the copy.
  console.warn('Particle field disabled:', err);
}

initSite();
