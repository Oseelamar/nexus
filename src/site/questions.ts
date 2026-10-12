// Open Questions: a scroll-driven spotlight. The section pins for one screen
// while scrolling advances through the four questions; after the fourth the
// page releases and carries on. The rail shows where you are and doubles as a
// shortcut that scrolls to a question.

export function initQuestions(reduced: boolean) {
  const section = document.querySelector<HTMLElement>('.pinq');
  if (!section) return;
  if (reduced) {
    section.classList.add('is-static');
    return;
  }
  const qs = [...section.querySelectorAll<HTMLElement>('.spot__q')];
  const tabs = [...section.querySelectorAll<HTMLButtonElement>('.spot__tab')];
  const segs = [...section.querySelectorAll<HTMLElement>('.spot__progress span')];
  const num = section.querySelector<HTMLElement>('[data-spot-num]')!;
  const numeral = section.querySelector<HTMLElement>('.spot__numeral')!;
  const n = qs.length;
  let current = -1;

  const travel = () => section.offsetHeight - innerHeight;

  const update = () => {
    const p = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / Math.max(1, travel())));
    const beat = p * n;
    segs.forEach((s, k) => s.style.setProperty('--fill', String(Math.min(1, Math.max(0, beat - k)))));
    const index = Math.min(n - 1, Math.floor(beat));
    if (index === current) return;
    current = index;
    qs.forEach((q, k) => {
      q.classList.toggle('is-active', k === index);
      q.classList.toggle('is-past', k < index);
    });
    tabs.forEach((t, k) => (k === index ? t.setAttribute('aria-current', 'step') : t.removeAttribute('aria-current')));
    num.textContent = String(index + 1).padStart(2, '0');
    numeral.textContent = String(index + 1);
  };

  tabs.forEach((t, k) => {
    t.addEventListener('click', () => {
      const top = section.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + travel() * ((k + 0.05) / n), behavior: 'smooth' });
    });
  });

  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}
