# Firebase social and co-op setup

This foundation uses:

- Firebase Anonymous Authentication for a stable player UID.
- Cloud Firestore for profiles, friends, invitations, sessions, and WebRTC signaling.
- Realtime Database for disconnect-safe online presence.
- Callable Cloud Functions for every privileged social state transition.

`CoopScene` uses this layer for the friends lobby and hands the resulting
WebRTC data channels to `PlayScene`.

## 1. Install dependencies

The root `package.json` is intentionally unchanged. Add the Firebase Web SDK when
integrating this branch:

```bash
npm install firebase
```

Install backend dependencies separately:

```bash
npm --prefix functions install
```

Install or run the Firebase CLI (`firebase-tools`) separately, for example with
`npx firebase-tools`. It does not need to be a runtime dependency.

## 2. Create and configure the Firebase project

1. Create a Firebase project and register a Web app.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create a Firestore database.
4. Create a Realtime Database in the same project.
5. Select the project locally with `npx firebase-tools use --add`. This creates
   the local `.firebaserc` mapping rather than committing a fake project ID.
6. Copy `.env.firebase.example` to `.env.local` and fill in the Web app values.
7. For reliable play across restrictive home, school, and mobile networks,
   configure `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and
   `VITE_TURN_CREDENTIAL`. Public STUN is used when TURN is omitted, but some
   peer pairs will not be able to connect.

The Firebase Web config is public configuration, not a secret. Access control
comes from Auth, Security Rules, and optional App Check.

## 3. Deploy or emulate

Deploy all backend resources:

```bash
npx firebase-tools deploy --only firestore,database,functions
```

Or run local emulators:

```bash
npx firebase-tools emulators:start
```

Set `VITE_FIREBASE_USE_EMULATORS=true` in `.env.local` while emulating. The
client defaults to `127.0.0.1` and the ports in `firebase.json`.

## 4. Phaser lobby lifecycle

At lobby entry:

1. Call `ensureAnonymousIdentity(displayName?)`.
2. Call `startPresence(identity.uid)` and retain its handle.
3. Subscribe with `observeFriends`, `observePresence`, and
   `observeInvitations`.
4. Send or respond to invitations through the callable wrappers.
5. After acceptance, the host publishes an offer and the guest publishes an
   answer. Each peer publishes ICE candidates under its own UID and observes
   the remote UID's candidates.
6. Unsubscribe listeners and call `presenceHandle.stop()` when the lobby or app
   is intentionally closed. Realtime Database `onDisconnect` handles crashes
   and network loss.

The signaling layer transports WebRTC descriptions and ICE candidates only.
Gameplay inputs, authoritative snapshots, and team events travel directly over
the established WebRTC data channels.

## Production hardening

- Enable Firebase App Check and enforce it for callable Functions after the web
  app is registered.
- Configure billing/budgets before deploying Functions.
- Add scheduled cleanup for expired invitations, closed sessions, and signaling
  subcollections when retention requirements are known.
- Use the Firebase Emulator Suite to add Security Rules integration tests before
  exposing the lobby publicly.
