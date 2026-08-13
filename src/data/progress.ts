import { ALL_LEVEL_IDS, type LevelId } from '../config';
import { persistReadClient, persistWriteClient } from './persist';

const STORAGE_KEY = 'red-square-4-save-v1';
const REMOTE_PATH = '/__save';

export interface SaveData {
  unlocked: LevelId[];
  cleared: LevelId[];
  lastPlayed: LevelId;
}

let memory: SaveData | null = null;

function defaultSave(): SaveData {
  return { unlocked: ['1-1'], cleared: [], lastPlayed: '1-1' };
}

function isLevelId(value: string): value is LevelId {
  return (ALL_LEVEL_IDS as string[]).includes(value);
}

function uniqueLevels(ids: LevelId[]): LevelId[] {
  return ALL_LEVEL_IDS.filter((id) => ids.includes(id));
}

function furtherLevel(a: LevelId, b: LevelId): LevelId {
  return ALL_LEVEL_IDS.indexOf(a) >= ALL_LEVEL_IDS.indexOf(b) ? a : b;
}

export function nextLevelId(id: LevelId): LevelId | undefined {
  const index = ALL_LEVEL_IDS.indexOf(id);
  if (index < 0 || index >= ALL_LEVEL_IDS.length - 1) {
    return undefined;
  }
  return ALL_LEVEL_IDS[index + 1];
}

function unlockedFrom(cleared: LevelId[], extra: LevelId[]): LevelId[] {
  const nextIds = cleared.flatMap((id) => {
    const next = nextLevelId(id);
    return next ? [next] : [];
  });
  return uniqueLevels(['1-1', ...extra, ...cleared, ...nextIds]);
}

function fallbackLastPlayed(unlocked: LevelId[], cleared: LevelId[]): LevelId {
  const leftover = unlocked.find((id) => !cleared.includes(id));
  return leftover ?? unlocked[unlocked.length - 1] ?? '1-1';
}

function normalizeSave(save: SaveData): SaveData {
  const cleared = uniqueLevels(save.cleared);
  const unlocked = unlockedFrom(cleared, save.unlocked);
  const lastPlayed = unlocked.includes(save.lastPlayed)
    ? save.lastPlayed
    : fallbackLastPlayed(unlocked, cleared);
  return { unlocked, cleared, lastPlayed };
}

function parseSave(raw: string | null | undefined): SaveData | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const unlocked: LevelId[] = Array.isArray(parsed.unlocked)
      ? parsed.unlocked.filter(isLevelId)
      : ['1-1'];
    const cleared: LevelId[] = Array.isArray(parsed.cleared) ? parsed.cleared.filter(isLevelId) : [];
    const lastPlayed =
      typeof parsed.lastPlayed === 'string' && isLevelId(parsed.lastPlayed)
        ? parsed.lastPlayed
        : fallbackLastPlayed(unlockedFrom(cleared, unlocked), cleared);
    return normalizeSave({ unlocked, cleared, lastPlayed });
  } catch {
    return null;
  }
}

function unionSave(a: SaveData, b: SaveData): SaveData {
  const cleared = uniqueLevels([...a.cleared, ...b.cleared]);
  const unlocked = unlockedFrom(cleared, [...a.unlocked, ...b.unlocked]);
  const lastPlayed = furtherLevel(
    unlocked.includes(a.lastPlayed) ? a.lastPlayed : fallbackLastPlayed(unlocked, cleared),
    unlocked.includes(b.lastPlayed) ? b.lastPlayed : fallbackLastPlayed(unlocked, cleared),
  );
  return { unlocked, cleared, lastPlayed };
}

function savesEqual(a: SaveData | null, b: SaveData | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function readClientSave(): SaveData | null {
  const { local, cookie } = persistReadClient(STORAGE_KEY);
  const fromLocal = parseSave(local);
  const fromCookie = parseSave(cookie);
  if (fromLocal && fromCookie) {
    return unionSave(fromLocal, fromCookie);
  }
  return fromLocal ?? fromCookie;
}

function persistRemote(raw: string): void {
  try {
    void fetch(REMOTE_PATH, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
      keepalive: true,
    });
  } catch {
    return;
  }
}

async function fetchRemoteSave(): Promise<SaveData | null> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(REMOTE_PATH, { cache: 'no-store', signal: ctrl.signal });
    window.clearTimeout(timer);
    if (!res.ok) {
      return null;
    }
    return parseSave(await res.text());
  } catch {
    return null;
  }
}

export function loadSave(): SaveData {
  if (memory) {
    return { ...memory, unlocked: [...memory.unlocked], cleared: [...memory.cleared] };
  }
  const save = normalizeSave(readClientSave() ?? defaultSave());
  memory = save;
  return { ...save, unlocked: [...save.unlocked], cleared: [...save.cleared] };
}

export function writeSave(save: SaveData): void {
  const next = normalizeSave(save);
  memory = next;
  const raw = JSON.stringify(next);
  persistWriteClient(STORAGE_KEY, raw);
  persistRemote(raw);
}

export async function hydrateSave(): Promise<SaveData> {
  try {
    const local = readClientSave() ?? defaultSave();
    const remote = await fetchRemoteSave();
    const merged = normalizeSave(remote ? unionSave(local, remote) : local);
    memory = merged;
    const raw = JSON.stringify(merged);
    persistWriteClient(STORAGE_KEY, raw);
    if (!savesEqual(remote, merged)) {
      persistRemote(raw);
    }
    return loadSave();
  } catch {
    memory = normalizeSave(readClientSave() ?? defaultSave());
    return loadSave();
  }
}

export function resetSave(): SaveData {
  const save = defaultSave();
  writeSave(save);
  return save;
}

export function resumeLevelId(save: SaveData = loadSave()): LevelId {
  if (save.unlocked.includes(save.lastPlayed)) {
    return save.lastPlayed;
  }
  return fallbackLastPlayed(save.unlocked, save.cleared);
}

export function setLastPlayed(id: LevelId): SaveData {
  const save = loadSave();
  if (save.lastPlayed === id) {
    return save;
  }
  save.lastPlayed = id;
  writeSave(save);
  return save;
}

export function markCleared(id: LevelId): SaveData {
  const save = loadSave();
  if (!save.cleared.includes(id)) {
    save.cleared.push(id);
  }
  const next = nextLevelId(id);
  if (next && !save.unlocked.includes(next)) {
    save.unlocked.push(next);
  }
  save.lastPlayed = next ?? id;
  writeSave(save);
  return save;
}

export function isUnlocked(id: LevelId): boolean {
  return loadSave().unlocked.includes(id);
}

export const session = {
  lives: 3,
};

export function resetSessionLives(): void {
  session.lives = 3;
}
