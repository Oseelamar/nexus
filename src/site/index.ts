import './site.css';
import { CONTACT_URL, PUBLICATIONS, PUBLICATIONS_URL, type Publication } from './content';
import { initSpecimens } from './specimens';
import { initClosingField } from './closingField';

const ARROW =
  '<svg class="arrow" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 7.5 7.5 2.5M3.25 2.5H7.5V6.75" /></svg>';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function publicationRow(p: Publication, i: number) {
  const num = String(i + 1).padStart(2, '0');
  const tag = p.url ? 'a' : 'div';
  const attrs = p.url ? ` href="${escapeHtml(p.url)}" target="_blank" rel="noopener"` : '';
  return `<li><${tag} class="pub"${attrs}>
    <span class="pub__num">${num}</span>
    <span>
      <span class="pub__title">${escapeHtml(p.title)}${p.url ? ` ${ARROW}` : ''}</span>
      ${p.authors?.length ? `<span class="pub__authors">${escapeHtml(p.authors.join(', '))}</span>` : ''}
      ${p.summary ? `<span class="pub__summary">${escapeHtml(p.summary)}</span>` : ''}
    </span>
    <span class="pub__type">${p.type ? escapeHtml(p.type) : ''}</span>
    <span class="pub__date">${p.date ? escapeHtml(formatDate(p.date)) : ''}</span>
  </${tag}></li>`;
}

function renderPublications() {
  const list = document.querySelector<HTMLElement>('[data-publications]');
  if (!list) return;
  if (PUBLICATIONS.length) {
    list.innerHTML = PUBLICATIONS.map(publicationRow).join('');
  } else {
    list.innerHTML = `<li class="index__empty">
      <h3 class="title">An open record of inquiry.</h3>
      <p class="body">Research outputs will appear here as work becomes available for publication.</p>
      <div class="index__ledger" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    </li>`;
  }
  const cta = document.querySelector<HTMLElement>('[data-publications-cta]');
  if (cta && PUBLICATIONS_URL) {
    cta.innerHTML = `<a class="hero__cta hero__cta--secondary" href="${escapeHtml(PUBLICATIONS_URL)}" target="_blank" rel="noopener">EXPLORE PUBLICATIONS ${ARROW}</a>`;
    cta.hidden = false;
  }
}

function wireContact() {
  if (!CONTACT_URL) return;
  document.querySelectorAll<HTMLAnchorElement>('[data-contact]').forEach((a) => {
    a.href = CONTACT_URL;
    a.hidden = false;
  });
}

function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  els.forEach((el) => io.observe(el));
}

function initQuestionProgress() {
  const list = document.querySelector<HTMLElement>('.questions__list');
  const bar = document.querySelector<HTMLElement>('.questions__progress');
  if (!list || !bar) return;
  let queued = false;
  const update = () => {
    queued = false;
    const r = list.getBoundingClientRect();
    const p = (innerHeight * 0.6 - r.top) / r.height;
    bar.style.setProperty('--progress', String(Math.min(1, Math.max(0, p))));
  };
  addEventListener(
    'scroll',
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

export function initSite() {
  document.documentElement.classList.add('js');
  renderPublications();
  wireContact();
  initReveal();
  initQuestionProgress();
  initSpecimens(reduced);
  const field = document.querySelector<HTMLCanvasElement>('.closing__field');
  if (field) initClosingField(field, reduced);
}
