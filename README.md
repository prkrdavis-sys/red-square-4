# Red Square 4

A Mario-inspired 2D platformer. You are a red square. The baddies are black-and-grey circles with red evil eyes. Five worlds, twenty courses, mini-bosses, and a 3-stomp world boss at the end of each castle.

## Play

```bash
npm install
npm run assets   # optional: download Kenney / ansimuz packs
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Controls

- **Menus:** Arrows / WASD to move, Enter or click to confirm, Esc to go back
- **Move:** Arrow keys or A / D
- **Jump:** Up, W, or Space
- **Drop through a platform:** Down or S
- **Touch (phone / tablet):** rotate to landscape. On-screen Left, Right, and Jump appear during play
- **World map:** Arrows / WASD, Enter to play, Title button or Esc for the main menu
- **Pause:** P, Esc, or the Pause control — Resume, Settings, World Map, Title

## Campaign

World map in the Super Mario Bros. 3 style: `1-1` through `5-4`.

| World | Theme |
| --- | --- |
| 1 | Grass |
| 2 | Snow (slippery) |
| 3 | Desert |
| 4 | Deep ocean (floatier jump) |
| 5 | Evil castle (lava) |

Stages `x-1`–`x-3` end with a 1-stomp mini-boss. Stage `x-4` is a 3-stomp world boss: he poofs away, a victory jingle plays, and the world is cleared.

Progress is saved in the browser. Use **Continue** on the main menu, or **New Game** to wipe unlocks.
