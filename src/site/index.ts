import './site.css';
import { CONTACT_URL } from './content';
import { initSpecimens } from './specimens';
import { initClosingField } from './closingField';
import { initFlow } from './diagrams';
import { initQuestions } from './questions';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

export function initSite() {
  document.documentElement.classList.add('js');
  wireContact();
  initReveal();
  initSpecimens(reduced);
  initQuestions(reduced);
  initFlow();
  const field = document.querySelector<HTMLCanvasElement>('.closing__field');
  if (field) initClosingField(field, reduced);
}
