// The drawing in index.html that shows while the town loads. Fade it, then take it out of the page.
export function dismissLoader(doc: Document = document): void {
  const el = doc.querySelector<HTMLElement>('.lc-loading');
  if (!el || el.dataset.state === 'done') return;
  el.dataset.state = 'done';
  if (doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) return el.remove();
  el.addEventListener('transitionend', () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 600);
}
