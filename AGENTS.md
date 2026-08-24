# Red Square 4

Phaser 3 + Vite + TypeScript 2D platformer. Six worlds (`1-1` through `6-4`), Kenney-style art, PWA install.

## Commands

```bash
npm ci
npm test              # Vitest unit tests (levels, combat, HUD, progress)
npm run build         # tsc --noEmit && vite build
npm run dev           # Vite on http://127.0.0.1:5173
npm run test:smoke    # Playwright campaign smoke; needs the dev server
npm run assets        # optional Kenney / ansimuz download; not required
```

Do not commit `public/assets/vendor` or `.red-square-save.json`.

## Layout

| Path | Role |
| --- | --- |
| `src/config.ts` | Themes, enemies, physics constants, level IDs |
| `src/scenes/` | Phaser scenes (boot, title, map, play, settings, skins, credits) |
| `src/entities/` | Player, baddies, bosses, projectiles |
| `src/levels/worlds.ts` | Course specs for every stage |
| `src/levels/grid.ts` | Compiles specs into tile rows |
| `src/levels/arena.ts` | Mini-boss / world-boss arenas |
| `src/systems/` | Audio, HUD, touch, textures, world specials |
| `src/data/` | Save, settings, skins |
| `src/ui/` | Shared menu / boss-fight chrome |
| `scripts/smoke-campaign.mjs` | Playwright smoke across all 24 courses |

Change course layout in `src/levels/worlds.ts` specs. `compileCourse` builds the rows; do not hand-edit compiled tile strings. After level or combat edits, run `npm test` (`src/levels/campaign.test.ts` encodes layout invariants).

Save data key: `red-square-4-save-v2`. Dev server persists to `.red-square-save.json` via `/__save`.

## Conventions

- TypeScript `strict`. Imports stay at the top of the file.
- Switches over unions use a `never` default so new variants fail at compile time.
- Colocate Vitest files as `*.test.ts` next to the code they cover.
- Game canvas is 1280×720, 64px tiles, 12 rows, ground on row 9.

## Cursor Cloud specific instructions

The Cloud environment installs npm deps and Playwright Chromium, then starts Vite on port **5173**.

- No secrets are required.
- After code changes, run `npm test`. Run `npm run build` when TypeScript or bundling could break.
- Verify gameplay, menus, and layout in the browser at `http://127.0.0.1:5173`.
- For campaign entry / canvas / touch smoke: with Vite already running, `npm run test:smoke`.
- Generated textures cover missing Kenney files. Do not run `npm run assets` unless the task is specifically about vendor art.
- `npx tsc --noEmit` is already part of `npm run build`.
