const STORAGE_KEY = 'red-square-4-settings-v1';

export function isClassicMode(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as { classic?: unknown };
    return parsed.classic === true;
  } catch {
    return false;
  }
}
