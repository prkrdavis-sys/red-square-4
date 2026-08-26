const SPLASH_ID = 'boot-splash';
const REMOVE_MS = 400;

export function dismissBootSplash(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const splash = document.getElementById(SPLASH_ID);
  if (!splash || splash.classList.contains('is-done')) {
    return;
  }
  splash.classList.add('is-done');
  let removed = false;
  const remove = (): void => {
    if (removed) {
      return;
    }
    removed = true;
    splash.remove();
  };
  splash.addEventListener('transitionend', remove, { once: true });
  globalThis.setTimeout(remove, REMOVE_MS);
}
