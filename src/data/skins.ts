import { ALL_LEVEL_IDS, type LevelId } from '../config';
import type { SaveData } from './progress';

export interface HeroPalette {
  ink: number;
  body: number;
  shade: number;
  gloss: number;
  boot: number;
  bootSole: number;
}

export type Accessory =
  | 'none'
  | 'cap'
  | 'visor'
  | 'cape'
  | 'crown'
  | 'horns'
  | 'scarf'
  | 'antenna'
  | 'halo'
  | 'bandana';

export interface SkinDef {
  id: string;
  name: string;
  /** Level that unlocks this skin, or undefined for the always-available default. */
  level?: LevelId;
  palette: HeroPalette;
  accessory: Accessory;
}

export const DEFAULT_SKIN_ID = 'classic';

export const CLASSIC_PALETTE: HeroPalette = {
  ink: 0x1a0808,
  body: 0xff3d42,
  shade: 0xc41c28,
  gloss: 0xff9aa0,
  boot: 0x2a1814,
  bootSole: 0x140808,
};

interface SkinSeed {
  name: string;
  body: number;
  shade: number;
  gloss: number;
  ink: number;
  boot: number;
  accessory: Accessory;
}

/** One seed per level, ordered to match ALL_LEVEL_IDS, tinted after each world's biome. */
const LEVEL_SKINS: SkinSeed[] = [
  { name: 'Meadow Sprout', body: 0x54c04a, shade: 0x2f7a2c, gloss: 0xa9e79f, ink: 0x102a0e, boot: 0x2a3a18, accessory: 'cap' },
  { name: 'Acorn Scout', body: 0xc8863c, shade: 0x8a5220, gloss: 0xf0c68a, ink: 0x2a1a08, boot: 0x3a2a14, accessory: 'bandana' },
  { name: 'Beetle Shell', body: 0xd94b4b, shade: 0x8e2626, gloss: 0xf4a0a0, ink: 0x2a0c0c, boot: 0x1c1414, accessory: 'antenna' },
  { name: 'Bramble King', body: 0x3f8f5a, shade: 0x225736, gloss: 0x9fdcb4, ink: 0x0e2416, boot: 0x24361f, accessory: 'crown' },
  { name: 'Powder Hare', body: 0xeaf2ff, shade: 0xa8bcd8, gloss: 0xffffff, ink: 0x1c2634, boot: 0x33415a, accessory: 'scarf' },
  { name: 'Finch Flurry', body: 0x8fd0f0, shade: 0x4b8fb4, gloss: 0xd6f1ff, ink: 0x102838, boot: 0x1e3c50, accessory: 'cap' },
  { name: 'Frost Mole', body: 0x6f7fa8, shade: 0x424e70, gloss: 0xb6c4e4, ink: 0x131a2c, boot: 0x232a44, accessory: 'visor' },
  { name: 'Glacier Crown', body: 0x9fe4e8, shade: 0x4f9aa4, gloss: 0xe0fbff, ink: 0x0f2a30, boot: 0x1d4048, accessory: 'crown' },
  { name: 'Dune Runner', body: 0xf0c264, shade: 0xb0842c, gloss: 0xffe8ac, ink: 0x3a2608, boot: 0x4a3212, accessory: 'bandana' },
  { name: 'Cactus Imp', body: 0x77b04a, shade: 0x476e26, gloss: 0xc0e79a, ink: 0x1c2c0c, boot: 0x2c3a16, accessory: 'horns' },
  { name: 'Sandwyrm Hide', body: 0xd08a5a, shade: 0x8e5630, gloss: 0xf4c49c, ink: 0x2e1a0c, boot: 0x3c2614, accessory: 'scarf' },
  { name: 'Sunken Pharaoh', body: 0xe8d060, shade: 0xa8912c, gloss: 0xfff2a8, ink: 0x322a06, boot: 0x443814, accessory: 'crown' },
  { name: 'Reef Crab', body: 0xf0714f, shade: 0xa8402a, gloss: 0xffb49c, ink: 0x2e0e08, boot: 0x3c1a12, accessory: 'antenna' },
  { name: 'Archerfish', body: 0x3fa8d8, shade: 0x216d94, gloss: 0x9fdff6, ink: 0x08222e, boot: 0x123844, accessory: 'visor' },
  { name: 'Angler Glow', body: 0x8a5ad0, shade: 0x543492, gloss: 0xc8a8f4, ink: 0x1c0e34, boot: 0x281848, accessory: 'antenna' },
  { name: 'Tide Sovereign', body: 0x2f7fa0, shade: 0x1a5068, gloss: 0x9ad4e8, ink: 0x081e28, boot: 0x123240, accessory: 'cape' },
  { name: 'Clockwork Hound', body: 0xb08040, shade: 0x74501e, gloss: 0xe8c488, ink: 0x281a08, boot: 0x342414, accessory: 'visor' },
  { name: 'Gargoyle Page', body: 0x707888, shade: 0x434a58, gloss: 0xb4bcc8, ink: 0x14181e, boot: 0x22262e, accessory: 'horns' },
  { name: 'Wall Mimic', body: 0x8a6a4a, shade: 0x584028, gloss: 0xc8a882, ink: 0x201408, boot: 0x2c1e10, accessory: 'cap' },
  { name: 'Dread Champion', body: 0x2a2230, shade: 0x14101c, gloss: 0x7a6a90, ink: 0x000000, boot: 0x1c1626, accessory: 'halo' },
  { name: 'Howler Ape', body: 0x6a4a28, shade: 0x3e2a14, gloss: 0xc4a070, ink: 0x1a1008, boot: 0x2a1c10, accessory: 'bandana' },
  { name: 'Dart Mosquito', body: 0x8ab03a, shade: 0x4a6a1c, gloss: 0xd4e878, ink: 0x1c2808, boot: 0x2c3a14, accessory: 'antenna' },
  { name: 'Coil Serpent', body: 0x2a6a48, shade: 0x164830, gloss: 0x7ac4a0, ink: 0x0c1c14, boot: 0x1a2c20, accessory: 'scarf' },
  { name: 'Canopy Crown', body: 0x1e4a28, shade: 0x0e2a18, gloss: 0x6ad08a, ink: 0x08140c, boot: 0x142418, accessory: 'crown' },
];

function skinIdForLevel(level: LevelId): string {
  return `level-${level}`;
}

export const SKINS: SkinDef[] = [
  {
    id: DEFAULT_SKIN_ID,
    name: 'Red Square',
    palette: CLASSIC_PALETTE,
    accessory: 'none',
  },
  ...ALL_LEVEL_IDS.map((level, index) => {
    const seed = LEVEL_SKINS[index];
    if (!seed) {
      throw new Error(`Missing skin seed for ${level}`);
    }
    return {
      id: skinIdForLevel(level),
      name: seed.name,
      level,
      palette: {
        ink: seed.ink,
        body: seed.body,
        shade: seed.shade,
        gloss: seed.gloss,
        boot: seed.boot,
        bootSole: seed.ink,
      },
      accessory: seed.accessory,
    } satisfies SkinDef;
  }),
];

export function skinById(id: string): SkinDef | undefined {
  return SKINS.find((skin) => skin.id === id);
}

export function skinForLevel(level: LevelId): SkinDef | undefined {
  return skinById(skinIdForLevel(level));
}

export function isSkinUnlocked(skin: SkinDef, save: Pick<SaveData, 'cleared'>): boolean {
  return !skin.level || save.cleared.includes(skin.level);
}

export function unlockedSkinIds(save: Pick<SaveData, 'cleared'>): string[] {
  return SKINS.filter((skin) => isSkinUnlocked(skin, save)).map((skin) => skin.id);
}
