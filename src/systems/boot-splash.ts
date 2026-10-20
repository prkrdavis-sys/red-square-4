const SPLASH_ID = 'boot-splash';

export function dismissBootSplash(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const splash = document.getElementById(SPLASH_ID);
  if (!splash || splash.classList.contains('is-done')) {
    return;
  }
  splash.classList.add('is-done');
  splash.remove();
}
