// Screen router: exactly one <section data-screen> is visible at a time.
// Modals (menu, settings) are native <dialog>s layered on top.

export function showScreen(name) {
  for (const s of document.querySelectorAll('section[data-screen]')) s.hidden = s.dataset.screen !== name;
  document.documentElement.dataset.activeScreen = name;
  window.scrollTo({ top: 0 });
  const heading = document.querySelector(`[data-screen="${name}"] h1`);
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

export function screenRoot(name) {
  return document.querySelector(`[data-screen="${name}"]`);
}
