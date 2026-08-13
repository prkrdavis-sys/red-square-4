const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5;

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function readCookie(key: string): string | null {
  try {
    const prefix = `${encodeURIComponent(key)}=`;
    for (const part of document.cookie.split(';')) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

function writeCookie(key: string, value: string): void {
  try {
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    return;
  }
}

export function persistReadClient(key: string): { local: string | null; cookie: string | null } {
  return { local: readLocal(key), cookie: readCookie(key) };
}

export function persistWriteClient(key: string, value: string): void {
  writeLocal(key, value);
  writeCookie(key, value);
}
