import '../styles.css';
import '../site/site.css';
import './questions-lab.css';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const QUESTIONS = [
  'Can we predict when AI will fail?',
  'What happens inside a model?',
  'How do we measure genuine capability?',
  'Can alignment keep pace with intelligence?',
];

function onScroll(fn: () => void) {
  let queued = false;
  const run = () => {
    queued = false;
    fn();
  };
  const queue = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  fn();
}

// ------------------------------------------------------------ B — spotlight
// Tabs pick the question; it advances by itself every few seconds until the
// visitor interacts, then stays where they left it.

function initSpotlight() {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.spot__tab')];
  const panel = document.querySelector<HTMLElement>('.spot__stage');
  const q = document.querySelector<HTMLElement>('[data-spot-q]');
  const num = document.querySelector<HTMLElement>('[data-spot-num]');
  const numeral = document.querySelector<HTMLElement>('.spot__numeral');
  const segs = [...document.querySelectorAll<HTMLElement>('.spot__progress span')];
  if (!panel || !q || !num || !numeral) return;

  const DWELL = 6000;
  let index = 0;
  let auto = !reduced;
  let started = performance.now();

  const show = (i: number, focus = false) => {
    if (i === index && !focus) return;
    index = i;
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[i].id);
    if (focus) tabs[i].focus();
    q.classList.add('is-out');
    setTimeout(() => {
      q.textContent = QUESTIONS[i];
      num.textContent = String(i + 1).padStart(2, '0');
      numeral.textContent = String(i + 1);
      q.classList.remove('is-out');
    }, reduced ? 0 : 220);
    started = performance.now();
  };

  const stop = () => {
    auto = false;
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => {
      stop();
      show(i);
    });
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      stop();
      show((index + d + tabs.length) % tabs.length, true);
    });
  });
  panel.parentElement?.addEventListener('pointerenter', stop);

  const tick = (now: number) => {
    const t = auto ? Math.min(1, (now - started) / DWELL) : 1;
    segs.forEach((s, k) => s.style.setProperty('--fill', k < index ? '1' : k === index ? String(t) : '0'));
    if (auto && t >= 1) show((index + 1) % tabs.length);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------ C — read-along
// Each word lights as the paragraph passes through the reading zone.

function initReadAlong() {
  const text = document.querySelector<HTMLElement>('[data-readalong]');
  const track = document.querySelector<HTMLElement>('.readalong__track');
  if (!text || !track) return;
  text.querySelectorAll<HTMLElement>('.ra-q').forEach((q) => {
    const words = q.textContent!.trim().split(/\s+/);
    q.textContent = '';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'ra-w';
      span.textContent = w;
      q.append(span, i < words.length - 1 ? ' ' : '');
    });
  });
  const words = [...text.querySelectorAll<HTMLElement>('.ra-w')];
  if (reduced) {
    words.forEach((w) => w.classList.add('is-lit'));
    track.style.setProperty('--ra', '1');
    return;
  }
  onScroll(() => {
    const r = text.getBoundingClientRect();
    const start = innerHeight * 0.8;
    const end = innerHeight * 0.35;
    const p = Math.min(1, Math.max(0, (start - r.top) / (r.height + start - end)));
    const lit = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
    track.style.setProperty('--ra', p.toFixed(3));
  });
}

// ------------------------------------------------------------ D — track
// The section pins; vertical scroll drives the rail horizontally.

function initTrack() {
  const section = document.querySelector<HTMLElement>('.study-d');
  const rail = section?.querySelector<HTMLElement>('.track__rail');
  const viewport = section?.querySelector<HTMLElement>('.track__viewport');
  if (!section || !rail || !viewport) return;
  const narrow = matchMedia('(max-width: 700px)');
  const apply = () => section.classList.toggle('is-static', reduced || narrow.matches);
  narrow.addEventListener('change', apply);
  apply();
  onScroll(() => {
    if (section.classList.contains('is-static')) return;
    const r = section.getBoundingClientRect();
    const travel = section.offsetHeight - innerHeight;
    const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
    const distance = Math.max(0, rail.scrollWidth - viewport.clientWidth);
    rail.style.transform = `translateX(${-p * distance}px)`;
    section.style.setProperty('--track', p.toFixed(3));
  });
}

initSpotlight();
initReadAlong();
initTrack();
