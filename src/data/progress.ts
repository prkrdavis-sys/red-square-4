import { ALL_LEVEL_IDS, parseLevelId, type LevelId } from '../config';
import { persistReadClient, persistWriteClient } from './persist';
import { DEFAULT_SKIN_ID, isSkinUnlocked, skinById } from './skins';

const STORAGE_KEY = 'red-square-4-save-v2';
const LEGACY_STORAGE_KEY = 'red-square-4-save-v1';
const REMOTE_PATH = '/__save';
const STARTING_UNLOCKED: LevelId[] = ALL_LEVEL_IDS.filter((id) => parseLevelId(id).stage === 1);

export interface SaveData {
  unlocked: LevelId[];
  cleared: LevelId[];
  lastPlayed: LevelId;
  collectibles: Partial<Record<LevelId, number>>;
  checkpoints: Partial<Record<LevelId, { x: number; y: number }>>;
  creatureCards: string[];
  equippedSkin: string;
}

let memory: SaveData | null = null;

function cloneSave(save: SaveData): SaveData {
  return {
    ...save,
    unlocked: [...save.unlocked],
    cleared: [...save.cleared],
    collectibles: { ...save.collectibles },
    checkpoints: Object.fromEntries(
      Object.entries(save.checkpoints).map(([id, checkpoint]) => [
        id,
        checkpoint ? { ...checkpoint } : checkpoint,
      ]),
    ) as SaveData['checkpoints'],
    creatureCards: [...save.creatureCards],
  };
}

function defaultSave(): SaveData {
  return {
    unlocked: [...STARTING_UNLOCKED],
    cleared: [],
    lastPlayed: '1-1',
    collectibles: {},
    checkpoints: {},
    creatureCards: [],
    equippedSkin: DEFAULT_SKIN_ID,
  };
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
  return uniqueLevels([...STARTING_UNLOCKED, ...extra, ...cleared, ...nextIds]);
}

function fallbackLastPlayed(unlocked: LevelId[], cleared: LevelId[]): LevelId {
  const leftover = unlocked.find((id) => !cleared.includes(id));
  return leftover ?? unlocked[unlocked.length - 1] ?? '1-1';
}

function normalizeSkin(id: string, cleared: LevelId[]): string {
  const skin = skinById(id);
  if (!skin || !isSkinUnlocked(skin, { cleared })) {
    return DEFAULT_SKIN_ID;
  }
  return skin.id;
}

function normalizeSave(save: SaveData): SaveData {
  const cleared = uniqueLevels(save.cleared);
  const unlocked = unlockedFrom(cleared, save.unlocked);
  const lastPlayed = unlocked.includes(save.lastPlayed)
    ? save.lastPlayed
    : fallbackLastPlayed(unlocked, cleared);
  const collectibles: Partial<Record<LevelId, number>> = {};
  for (const id of ALL_LEVEL_IDS) {
    const value = save.collectibles[id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      collectibles[id] = Math.max(0, Math.min(7, Math.floor(value)));
    }
  }
  const checkpoints: Partial<Record<LevelId, { x: number; y: number }>> = {};
  for (const id of ALL_LEVEL_IDS) {
    const checkpoint = save.checkpoints[id];
    if (
      checkpoint &&
      Number.isFinite(checkpoint.x) &&
      Number.isFinite(checkpoint.y) &&
      checkpoint.x >= 0 &&
      checkpoint.y >= 0
    ) {
      checkpoints[id] = { x: checkpoint.x, y: checkpoint.y };
    }
  }
  return {
    unlocked,
    cleared,
    lastPlayed,
    collectibles,
    checkpoints,
    creatureCards: Array.from(new Set(save.creatureCards.filter((card) => typeof card === 'string'))),
    equippedSkin: normalizeSkin(save.equippedSkin, cleared),
  };
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
      : [...STARTING_UNLOCKED];
    const cleared: LevelId[] = Array.isArray(parsed.cleared) ? parsed.cleared.filter(isLevelId) : [];
    const lastPlayed =
      typeof parsed.lastPlayed === 'string' && isLevelId(parsed.lastPlayed)
        ? parsed.lastPlayed
        : fallbackLastPlayed(unlockedFrom(cleared, unlocked), cleared);
    const collectibles =
      parsed.collectibles && typeof parsed.collectibles === 'object'
        ? (parsed.collectibles as Partial<Record<LevelId, number>>)
        : {};
    const checkpoints =
      parsed.checkpoints && typeof parsed.checkpoints === 'object'
        ? (parsed.checkpoints as Partial<Record<LevelId, { x: number; y: number }>>)
        : {};
    const creatureCards = Array.isArray(parsed.creatureCards)
      ? parsed.creatureCards.filter((card): card is string => typeof card === 'string')
      : [];
    const equippedSkin = typeof parsed.equippedSkin === 'string' ? parsed.equippedSkin : DEFAULT_SKIN_ID;
    return normalizeSave({
      unlocked,
      cleared,
      lastPlayed,
      collectibles,
      checkpoints,
      creatureCards,
      equippedSkin,
    });
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
  const collectibles: Partial<Record<LevelId, number>> = {};
  const checkpoints: Partial<Record<LevelId, { x: number; y: number }>> = {};
  for (const id of ALL_LEVEL_IDS) {
    collectibles[id] = (a.collectibles[id] ?? 0) | (b.collectibles[id] ?? 0);
    checkpoints[id] = b.checkpoints[id] ?? a.checkpoints[id];
  }
  return normalizeSave({
    unlocked,
    cleared,
    lastPlayed,
    collectibles,
    checkpoints,
    creatureCards: [...a.creatureCards, ...b.creatureCards],
    equippedSkin: b.equippedSkin === DEFAULT_SKIN_ID ? a.equippedSkin : b.equippedSkin,
  });
}

function savesEqual(a: SaveData | null, b: SaveData | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function readClientSave(): SaveData | null {
  const { local, cookie } = persistReadClient(STORAGE_KEY);
  const legacy = persistReadClient(LEGACY_STORAGE_KEY);
  const fromLocal = parseSave(local) ?? parseSave(legacy.local);
  const fromCookie = parseSave(cookie) ?? parseSave(legacy.cookie);
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
    return cloneSave(memory);
  }
  const save = normalizeSave(readClientSave() ?? defaultSave());
  memory = save;
  return cloneSave(save);
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
  const nextIsGatedBoss = next ? parseLevelId(next).stage === 4 && worldCollectibleCount(save, parseLevelId(next).world) < 5 : false;
  if (next && !nextIsGatedBoss && !save.unlocked.includes(next)) {
    save.unlocked.push(next);
  }
  delete save.checkpoints[id];
  save.lastPlayed = next && !nextIsGatedBoss ? next : id;
  writeSave(save);
  return save;
}

export function setEquippedSkin(id: string): SaveData {
  const save = loadSave();
  save.equippedSkin = id;
  writeSave(save);
  return loadSave();
}

export function isUnlocked(id: LevelId): boolean {
  return loadSave().unlocked.includes(id);
}

export function hasCampaignProgress(save: SaveData = loadSave()): boolean {
  return save.cleared.length > 0 || save.unlocked.some((id) => parseLevelId(id).stage !== 1);
}

export function collectibleMask(id: LevelId, save: SaveData = loadSave()): number {
  return save.collectibles[id] ?? 0;
}

export function levelCollectibleCount(id: LevelId, save: SaveData = loadSave()): number {
  const mask = collectibleMask(id, save);
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

export function worldCollectibleCount(save: SaveData, world: number): number {
  let total = 0;
  for (let stage = 1; stage <= 4; stage += 1) {
    total += levelCollectibleCount(`${world}-${stage}` as LevelId, save);
  }
  return total;
}

function unlockBossIfEligible(save: SaveData, world: number): void {
  const stageThree = `${world}-3` as LevelId;
  const boss = `${world}-4` as LevelId;
  if (
    save.cleared.includes(stageThree) &&
    worldCollectibleCount(save, world) >= 5 &&
    !save.unlocked.includes(boss)
  ) {
    save.unlocked.push(boss);
    save.lastPlayed = boss;
  }
}

export function collectMemory(id: LevelId, index: number): SaveData {
  if (index < 0 || index > 2) {
    return loadSave();
  }
  const save = loadSave();
  const bit = 1 << index;
  save.collectibles[id] = (save.collectibles[id] ?? 0) | bit;
  const { world } = parseLevelId(id);
  const total = worldCollectibleCount(save, world);
  for (const threshold of [3, 6, 9, 12]) {
    const card = `world-${world}-memories-${threshold}`;
    if (total >= threshold && !save.creatureCards.includes(card)) {
      save.creatureCards.push(card);
      if (threshold === 6 || threshold === 12) {
        session.lives += 1;
      }
    }
  }
  unlockBossIfEligible(save, world);
  writeSave(save);
  return save;
}

export function setCheckpoint(id: LevelId, x: number, y: number): SaveData {
  const save = loadSave();
  save.checkpoints[id] = { x, y };
  writeSave(save);
  return save;
}

export function getCheckpoint(id: LevelId): { x: number; y: number } | undefined {
  const checkpoint = loadSave().checkpoints[id];
  return checkpoint ? { ...checkpoint } : undefined;
}

export function clearCheckpoint(id: LevelId): SaveData {
  const save = loadSave();
  delete save.checkpoints[id];
  writeSave(save);
  return save;
}

export const session = {
  lives: 3,
};

export function resetSessionLives(): void {
  session.lives = 3;
}
