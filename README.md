# Red Square 4

A Mario-inspired 2D platformer. You are a red square. The baddies are black-and-grey circles with red evil eyes. Eight worlds, thirty-two courses, mini-bosses, and a world boss at the end of each world.

## Play

```bash
npm install
npm run assets   # optional: download Kenney / ansimuz packs
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). On a phone, use the LAN address Vite prints so you can add it to the home screen.

## Online co-op

Choose **Co-op** on the title screen to create a persistent friend code, add
friends, invite an online friend, and select any level the host has unlocked.
Co-op uses Firebase for anonymous player profiles, friends, presence, invites,
and WebRTC signaling; gameplay then travels directly between the two players.
See [`docs/FIREBASE_SOCIAL_SETUP.md`](docs/FIREBASE_SOCIAL_SETUP.md) before
running co-op locally or deploying it.

## Install on a phone

This is a standalone web app. After you open it in **Safari** (iPhone) or **Chrome** (Android), add it to the home screen. Launching that icon opens the game in its own window, without browser chrome.

- **iPhone / iPad:** Safari → Share → Add to Home Screen
- **Android:** Chrome → menu → Add to Home Screen / Install app

Home-screen install needs HTTPS (or localhost). Deploy the `dist` folder, or run `npm run build` then `npm run preview` for a local check.

## Controls

- **Menus:** Tap a button, or Arrows / WASD and Enter. Esc to go back
- **Move:** Arrow keys or A / D
- **Jump:** Up, W, or Space
- **Drop through a platform:** Down or S
- **Touch (phone / tablet):** rotate to landscape. On-screen Left, Right, and Jump appear during play
- **World map:** Tap a course to select, tap it again or Play to start. Arrows / WASD and Enter still work. Main Menu returns to the start screen
- **Pause:** P, Esc, or the Pause button — Resume, Settings, World Map, Main Menu

## Campaign

World map in the Super Mario Bros. 3 style: `1-1` through `8-4`.

| World | Theme |
| --- | --- |
| 1 | Grass |
| 2 | Snow (slippery) |
| 3 | Desert |
| 4 | Deep ocean (floatier jump) |
| 5 | Evil castle (lava) |
| 6 | Rainforest (liana swing) |
| 7 | Beach (tide wall) |
| 8 | Neon Downpour (awning wall-jump and lightning pulse) |

Stages `x-1`–`x-3` end with a 3-stomp mini-boss. Stage `x-4` is a 5-stomp world boss: he poofs away, a victory jingle plays, and the world is cleared.

Progress is saved in the browser. Use **Continue** on the main menu, or **New Game** to wipe unlocks.
