export const GAME_FONT_FAMILY = 'Nunito';
export const UI_FONT_WAIT_MS = 400;

export async function waitForUiFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) {
    return;
  }
  try {
    await Promise.race([
      document.fonts.load(`600 18px "${GAME_FONT_FAMILY}"`),
      new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, UI_FONT_WAIT_MS);
      }),
    ]);
  } catch {
    return;
  }
}
