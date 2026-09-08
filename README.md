# Extra Mile Hub — Customer Service Week 2026

A single-page, hand-drawn/gamified activities hub for the "We Go the Extra Mile" campaign. Static site — plain HTML/CSS/JS, no framework, no bundler. Backed by real Firestore as of the Firebase swap (see "Firebase backend" below) — previously ran on browser-local mock data while the look and feel was still being iterated on.

## Run locally

```bash
npm install   # no dependencies to install — completes instantly
npm run build # optional: validates every local asset reference + JS syntax, see build.js
npx serve .
```

No compile step. `npm run build` isn't required to run the site locally or in dev — it's a pre-deploy sanity check (see "Deploy to Vercel" below) — but running it costs nothing since there's nothing to install.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New… → Project → Import** the repo.
3. Leave every setting on its default and click **Deploy**. Vercel detects the `package.json`, runs `npm install` (installs nothing — zero dependencies) then the build command from `vercel.json` (`npm run build` — validates asset references and JS syntax, doesn't move or transform any files), and serves the repo root as static output per `vercel.json`'s `outputDirectory` — which is exactly the site, unchanged. Nothing to fill in, nothing to override.

**Environment variables:** still none, even after the Firebase swap. The Firebase web config in `js/firebase-config.js` is hardcoded directly in that file rather than injected via env vars — see the comment there for why that's the right call (it's not a secret; Vercel env vars would just be a slower, extra-indirection way to end up with the exact same values in the client bundle either way). Leave Vercel's environment variables screen empty.

**`vercel.json`** — this one's here because the zero-config assumption in an earlier pass turned out to be wrong in practice, not just theory: once `package.json` has a `build` script, Vercel runs it through `@vercel/static-build`, which needs an explicit output directory rather than defaulting to the repo root — without one, the deploy built "successfully" but had nothing to serve, which is exactly the 404 that surfaced after the first real deploy. `vercel.json` now pins both settings explicitly:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "."
}
```
`.` is the repo root itself — the same place `npm run build` already validates, so what gets served is still guaranteed to be exactly the site, not a separate build artifact that could drift from it. No routing rewrites, headers, or redirects were added — this app still has no client-side routing to account for (every activity/leaderboard/bingo view is an in-place modal over the same `index.html` — see "Architecture" below), so there was nothing else for `vercel.json` to need.

**Root-path serving:** the app needs no adjustment for being served from a domain root (Vercel's default) — every `<script src>`/`<link href>` in `index.html` is a path relative to that file (`js/app.js`, `css/sketch.css`, etc.), not an absolute `/`-rooted or hardcoded-localhost path, and `data/ms-products.js`'s image paths follow the same convention. `build.js` step 1 exists specifically to catch a broken/absolute reference like that before it ever reaches a deploy.

**If you still get a 404 after adding `vercel.json` and redeploying:** that's a different cause than the one above, and I can't see your Vercel dashboard or GitHub repo to diagnose it directly — check, in this order: (1) the Vercel deploy's **Build Logs** actually show `npm run build` succeeding, not erroring silently; (2) the GitHub repo you connected actually contains every file in this project (`index.html`, `css/`, `js/`, `data/`, `assets/`, `package.json`, `vercel.json`) — a partial push is the other common cause of this exact error; (3) you're opening the deployment's real production/preview URL from the Vercel dashboard, not a stale or mistyped one.

## Firebase backend

Everything (users, submissions, votes, scores) lives in real Firestore now, via `js/firestore-db.js`, behind the exact same `Store.*` interface (`js/store.js`) the old mock layer sat behind — no caller (`js/games.js`, `js/app.js`, etc.) needed to change shape, only the db-layer calls inside `js/store.js` itself gained `await` (Firestore reads/writes are genuine network calls; the old `localStorage`-backed mock ones weren't).

**Project**: `csw-2026` (config in `js/firebase-config.js` — see the comment there for why those values are fine to have in the client bundle, not secret). **Collections**: `users`, `hyperlinkRaceEntries`, `snapJudgementEntries`, `triviaEntries` (+ a `days` subcollection per user — Race Day Trivia's daily entries), `photoFinishEntries` (+ a `votes` subcollection per entry), `nominations`, `minigameEntries`. Security rules live in `firestore.rules` — intentionally open (document-ID-shape checks only, no real auth), matching this project's stated low-friction/non-secure posture; deploy with `firebase deploy --only firestore:rules` or paste the file into Firebase Console → Firestore → Rules.

**✅ Verified live against the real project.** The Firestore database was created (Console → Build → Firestore Database → Create database, Production mode, Native mode) and `firestore.rules` deployed, then the whole flow was exercised end-to-end against `csw-2026` for real — not just code review:
- Login/account creation: `Store.getOrCreateUser` writes a real `users/{code}` doc (PIN hash, cursor glyph, bingo map, easter-egg state, etc.), confirmed via a direct read of the same doc.
- Race Day Trivia: played a full round through the actual UI, submitted, and confirmed `triviaEntries/{code}/days/{dayId}` was created with the right score breakdown — this is also what caught a real bug (see below) before it could bite a real user.
- Cumulative scoring: confirmed the parent `users/{code}` doc's `totalScore`, `triviaTotalScore`, and `bingo.triviaMon` all updated correctly off the back of that one trivia submission.

Along the way, one real bug was caught and fixed: `firestore.rules` only had a `match` block for `triviaEntries/{code}` as a flat document, not for its `days/{dayId}` subcollection (added when Race Day Trivia became daily/cumulative in Polish pass #17) — a `match` on a parent doc doesn't implicitly cover a subcollection, so every trivia submission would have failed with permission-denied until a nested `match /days/{dayId} {...}` block was added. Re-deploy `firestore.rules` if you're setting this project up fresh, so that fix is included.

**Local mock mode still exists, just unwired** — `js/mock-db.js` is untouched and still in the repo (not loaded by `index.html` anymore) in case a `localStorage`-only mode is ever useful again (e.g. an offline demo); swap `index.html`'s script tags back to restore it. Its old caveats (state is per-browser, doesn't survive a storage wipe) no longer apply now that Firestore is live — data is genuinely shared and persistent once the step above is done.

**The old "Reset" button is gone.** It used to wipe the *entire* mock database for quick testing — safe against a throwaway `localStorage` blob, but it would now be a real, destructive, everyone's-data button against a shared project, so it wasn't carried over rather than risk it getting clicked for real. The preview strip's day-jump controls and "Real" (clear the date override) are unaffected; logging out still works via the player badge's own ✕.

## Architecture: one continuous page

Everything — login, the race track, the five activities, the bingo card, the leaderboard, the finish-line celebration, and the secret leaderboard — lives on `index.html` as one canvas. Nothing navigates to a new URL; activities and the bingo card open as an in-place modal (`js/app.js`'s `openActivityModal` / `openBingoModal`), and closing it re-renders the same canvas with fresh state. There's no nav bar — just a small pinned player badge (avatar showing the first letter of the short login, + a restyled exit control) since there's nothing else to navigate to. The mascot itself is pinned in the bottom-right corner as a fixed companion (not riding along the track) and is also the easter-egg's click target.

```
index.html                 the whole app: login overlay + hub canvas
css/
  tokens.css                brand colors/type/spacing (unchanged, reused as-is)
  sketch.css                 the hand-drawn visual system — cards, buttons, track,
                              ambient background, cursor trail, all animations
js/
  firebase-config.js         Firebase project config + SDK init (ES module — see there)
  firestore-db.js             the real Firestore data layer (ES module) — same interface
                              mock-db.js had, so store.js's shape never had to change
  mock-db.js                 the old localStorage-backed mock store — unused, kept for
                              reference/rollback (index.html no longer loads it)
  store.js                   the stable data interface (see below) — talks to FirestoreDB
  auth.js                    4-letter code session handling
  state.js                   derives dashboard/bingo view-state from a user record
  icons.js                   hand-drawn/sketch-style SVG icons
  mascot.js                  mascot rendering + idle animation + easter-egg trigger
  minigame.js                the "Mile Dash" mini-game (canvas) + its own modal
  games.js                   the five activities, each rendered into a modal
  cursor.js                  custom cursor + spark trail
  ambient.js                 background grid parallax + floating decorations
  app.js                     orchestration: login, hub render, generic modal system,
                              leaderboard, secret leaderboard, finish-line overlay
data/
  schedule.js                 Mon–Fri unlock schedule + the "jump to day" preview override
  trivia-questions.js         the real daily question bank (TRIVIA_BY_DAY)
assets/mascot/                the mascot artwork (kept exactly as generated — do not touch)
firestore.rules               deploy this to the csw-2026 Firebase project — see "Firebase
                              backend" above
```

## Backend: Firestore (real, not mock)

`js/store.js` is the **only** thing the UI talks to (`Store.getOrCreateUser`, `Store.submitEntry`, `Store.getLeaderboard`, etc.) — the exact same interface it always had. Its internals now call `js/firestore-db.js`, a real Firestore adapter, instead of the old localStorage-backed `js/mock-db.js` (still in the repo, just unwired — see "Firebase backend" above for why). Verified live end-to-end against the real project — see "Firebase backend" above.

## Visual system

- **Cards** (`.sketch-card`): asymmetric border-radius + a faint offset duplicate border (`::before`) to fake a re-inked hand-drawn line, a per-card random rotation via `--hover-rot`, and a hard offset drop-shadow (`filter: drop-shadow(...)`) for a pinned/cut-out sticker feel. `.interactive` cards wiggle on hover; `.locked` cards shake instead.
- **Background** (`js/ambient.js` + `#bgLayer` in `sketch.css`): a faint grid layer that parallaxes a few px with the mouse, plus procedurally-placed drifting clouds, twinkling sparkles, floating checkered-flag confetti bits, and faded skid marks — all idle-animating, `pointer-events: none`.
- **Cursor** (`js/cursor.js`): the OS cursor is hidden (`cursor: none` globally); a small checkered-flag glyph follows the mouse and spawns fading gold/brick spark particles as it moves.
- **Mascot idle animation**: a `.mascot-bob` wrapper handles a gentle up/down bob; the `<img>` itself gets a periodic quick vertical squash to read as a blink. Both are pure CSS (`@keyframes mascotBob` / `mascotBlink`), no JS needed once mounted.
- **Typography**: Archivo Black for headers (unchanged), Inter for body copy (unchanged), plus **Patrick Hand** added for playful hand-lettered accents (speech bubbles, day tags, small captions).
- Colors/tokens are **unchanged** from the original brand system (`css/tokens.css`) — only the components built on top of them changed.

## The easter egg — how it works, and what was broken before

Click the mascot riding the race track **7 times within ~4.5 seconds**. A dashed ring appears around it after the 3rd click as a "getting warmer" hint; on the 7th, a reveal modal ("You Found It!") opens straight into the *Mile Dash* mini-game (arrow keys / A-D to dodge cones and collect coins, 30 seconds). Finishing logs a score to the mock data layer and permanently flags that user's `easterEgg.found`, which is what gates the secret leaderboard — reachable only via the "Secret Leaderboard 🤫" button at the end of the mini-game, and never linked anywhere in the normal UI.

**Two real bugs were found and fixed this pass** (confirmed via direct in-browser testing, not just code review):

1. **`window.Mascot` / `window.Minigame` were never actually defined.** Both modules were declared as top-level `const Mascot = (() => {...})()` — that creates a binding in script scope, but *not* a `window` property. The trigger code checked `if (window.Minigame) { window.Minigame.open(...) }`, which was always `false`, so the reveal silently no-op'd. Every module now explicitly does `window.X = X` at the end of its file.
2. **The day-marker row was silently eating clicks aimed at the mascot.** `.track-markers` sits right after `.track-road` in the DOM and both are `position: relative` — per CSS stacking rules, later same-level positioned siblings paint (and hit-test) above earlier ones, so the empty flex gaps in `.track-markers` covered the mascot's clickable area even though the mascot rendered visually on top. Fixed with `pointer-events: none` on `.track-markers` (it's decorative only) plus an explicit `z-index` on `.track-mascot` as a second line of defense.

## Polish pass — what changed

- **Login copy**: "short login" is now the correct internal term used throughout; the hint example is a generic "ABCD", not a real code.
- **Hub header**: now mirrors the login screen exactly — "Customer Service Week 2026" over "We Go the Extra Mile". Each day's date (`DD/MM`) sits under its label right on the track (`data/schedule.js`'s `formatShortDate`).
- **Bingo card**: no longer inline on the page — a "🎯 Bingo Card" button opens it as a modal (`App.openBingoModal`).
- **Mascot**: moved off the track into a fixed bottom-right corner (`.track-mascot` is now `position: fixed`, not positioned along a `%` of the road). Watch out if you touch this again — `.eggable` (added by the easter-egg wiring) sets `position: relative`, which by source order would otherwise silently override the `fixed` positioning back to `relative`; the fix is the `#trackMascot.eggable` override in `sketch.css`, not a reason to remove `.eggable`'s own positioning (the egg's hint ring needs *a* positioned ancestor).
- **Track day states**: past days are now green (`.track-marker.past`) only if that day's activity was actually completed, and red (`.track-marker.missed`) otherwise. Today keeps its yellow pulse.
- **Mini-game**: player is a 🏎️ emoji, coins are 🪙, obstacles are 🚧, lives are three ❤️ in an HTML overlay row (not canvas text). A full pre-game explainer covers controls, coin value, obstacle cost, lives, and the goal before "Start Engines".
- **Mini-game trigger bug, fixed for real this time**: clicking the mascot well past the 7-click threshold used to flicker the popup open-then-closed. The actual cause: the reveal opens via an `async` chain (an `await` inside `revealEasterEgg`), so the modal backdrop — `position: fixed; inset: 0`, covering the whole viewport — lands in the DOM just before the browser dispatches the *next* rapid click, and that click hits the backdrop directly, triggering its click-outside-to-close handler. Fixed with a ~700ms grace period on the backdrop's close-on-click-outside handler (`minigame.js`), plus a `Minigame.isOpen()` guard so the mascot ignores clicks entirely while the game/reveal modal is already open. Verified with 12 real rapid clicks against a live browser, not just code inspection.
- **Player badge**: single circular avatar (first letter of the short login only, full code moved to a tooltip) + a restyled circular "✕" exit button matching the hand-drawn theme, replacing the old plain-text pair.

## Polish pass #2 — what changed

- **Header**: "Customer Service Week 2026" now properly stacks above "We Go the Extra Mile" (`.hub-hero`, `display:flex;flex-direction:column`) — it used to sit beside it on the same line because both elements were `display:inline-block`. Top padding on `.canvas-main` and the gap in `.hub-hero` were both opened up so the page doesn't feel cramped into the top half of the viewport.
- **Timeline**: extra bottom padding so the day label/date aren't glued to the edge; weekday names are spelled out in full ("Monday", not "Mon" — only the small letter badge inside each circle stays abbreviated to a single initial).
- **"0/5 days" counter**: removed entirely (`#progressPill` is gone from the DOM — don't reintroduce a reference to it).
- **Leaderboard / Bingo Card buttons**: moved out of the flow between the track and the activity cards into a fixed bottom-left `.utility-dock`, so the track leads straight into "This Week's Activities" with nothing in between. Their icon and label are now separate `<span>`s so `.doodle-btn`'s `gap` actually applies between them (a bare emoji+text string doesn't get flex `gap`).
- **Mini-game — lives**: reverted back to ❤️ emoji (the hand-drawn wheel icon from the previous pass is removed from `icons.js` — it's no longer used anywhere).
- **Mini-game — difficulty ramp**: fall speed (`BASE_FALL_SPEED` → `MAX_FALL_SPEED`) and spawn frequency (`BASE_SPAWN_MS` → `MIN_SPAWN_MS`) both lerp with `elapsed / GAME_MS`, so the last few seconds are visibly faster/denser than the first few (`minigame.js`).
- **Mini-game — scoring**: final score is coin-score × a multiplier based on lives remaining at game end (`LIFE_MULTIPLIERS = {3: 1.0, 2: 0.7, 1: 0.4, 0: 0.2}`), not just raw coins. The "Race Complete" screen shows the breakdown (e.g. "120 coin pts × 0.7 (2 lives left) = 84"). Tune the multiplier values in `minigame.js` if the balance feels off.
- **New: cursor picker**. A gear button next to the player badge's avatar opens a small popover (`js/cursor-picker.js`) with 6 racing-themed cursor options (🏎️ 🏁 ⚡ ⭐ 🏆 🔥). Selecting one calls `Cursor.setGlyph` immediately and persists via `Store.setCursorGlyph` on the user's mock record (`cursorGlyph` field), so it's ready for the eventual Firestore swap without changing callers. Default is now 🏎️ (was the checkered flag 🏁).

**Testing note**: the mini-game's `requestAnimationFrame` loop is throttled by the browser when its tab isn't focused/visible, which made it hard to fully exercise the difficulty ramp and lower scoring multipliers under browser automation in a background tab. The wall-clock timer (`Date.now()`-based) and the `1.0×`/3-lives scoring path were confirmed live; the formula for the other multiplier tiers is straightforward arithmetic and was verified by code review. Worth a manual sanity check in a normal, focused browser tab.

## Polish pass #3 — what changed

- **Header title**: `.hub-hero__title` bumped from 40px to 48px.
- **Cursor picker moved into the avatar**: the separate gear button is gone. Clicking the avatar circle (`#avatarBtn`, now a `<button>` not a `<div>`) opens the same picker; the avatar showed the active cursor glyph in this pass, then reverted to a constant icon in pass #4 below (the code is still available on hover via the button's `title`).
- **Fixed a real staleness bug while wiring this up**: `showHub()` used to call `Cursor.setGlyph(currentUser.cursorGlyph || '🏎️')` on every re-render, including re-renders (like the preview day-jump buttons) that don't refresh `currentUser` from the store first. Since picking a cursor writes straight to `MockDB`/`Store` and never touches `App`'s in-memory `currentUser`, that stale read would silently snap the cursor back to whatever glyph was active *before* the player's most recent pick, the next time anything re-rendered the hub. Fixed by reading the glyph fresh from `MockDB.getDoc('users', currentUser.code)` on every `showHub()` call instead of trusting `currentUser` — worth remembering if you add more per-user settings that can change without a full `refreshUser()`. This read stays in place in pass #4 below even though the avatar itself no longer displays the glyph.

## Polish pass #4 — what changed

- **Avatar reverted to a constant icon**: the avatar no longer shows the active cursor glyph — it's always a plain hand-drawn pointer icon (`Icons.cursor`), signaling "click to change your cursor" regardless of what's actually selected. `cursor-picker.js` no longer touches `#avatarBtn`'s content on selection.
- **Leaderboard tabs**: were already identically padded/sized (verified via `getBoundingClientRect` before touching anything — this was not a padding bug). The real problem was `flex-wrap` leaving the 5th-odd tab alone on its own line, reading as "bigger" by isolation. Switched `#lbTabs` to a fixed 3-column grid (`.lb-tabs`) with `width: 100%` buttons, so every tab is now identically sized (183px wide in a 640px modal) in a balanced 3+2 layout.
- **Leaderboard "Current Leader" chip**: was three stacked, independently-centered block elements (image, tag, name). Restructured into a horizontal `.lb-champion` flex row (mascot + text block, vertically centered, fixed gap) — see `renderLeaderboard` in `app.js`.
- **Header title**: bumped again — `.hub-hero .doodle-tag` to 26px (was the shared 18px base) and `.hub-hero__title` to 64px (was 48px). The eyebrow tag is sized via a `.hub-hero .doodle-tag` scoped rule rather than changing the shared `.doodle-tag` class, which is also used for every activity/game modal's day-tag ("Monday · Recognition" etc.) — don't bump that base size for a hub-only request.

  **Correction, pass #5**: the `.hub-hero__title` part of this never actually applied — see below.

## Polish pass #5 — what changed

- **Header title, actually fixed this time**: `.hub-hero__title { font-size: ... }` had been silently losing to the base `.sketch-title` rule (also `font-size: 30px`, further down the file) every single pass since it was introduced — both are single-class selectors, so it came down to source order, and `.sketch-title` sits later in `sketch.css` and won every time. The title had been rendering at 30px through three separate "increase the title" requests, which is exactly why it kept looking unchanged. Fixed with a compound selector, `.sketch-title.hub-hero__title { font-size: 36px; }` (specificity 0,0,2,0), which outranks the base rule outright regardless of order — confirmed via `getComputedStyle` before and after, not just visually. Current size (36px) is deliberately just above `.activities-title`'s 30px per the "slightly larger than This Week's Activities" spec — this is not the 64px pass #4 described attempting, since that number was never real.
- **Leaderboard tabs**: removed the 🏆 emoji from "Combined Overall" (it was adding a real, if tiny, 1px height inconsistency vs. the other tabs — confirmed via `getBoundingClientRect`, all 5 tabs are now pixel-identical at 183×36). In its place, `.lb-tabs button[data-key="combined"]` gets a constant soft gold `box-shadow` glow (not tied to `.is-selected`/active state) so it still reads as the primary category at a glance.
- **Leaderboard "Current Leader" chip**: mascot image 56px → 72px, `.lb-champion .doodle-tag` (the "Current Leader" label) 18px → 20px, `.lb-champion__name` 22px → 28px, gap 16px → 20px — scaled together rather than just the image.

**A pattern worth internalizing**: two separate bugs across passes #4 and #5 (mascot z-index/position, and now this title font-size) came from the same root cause — a scoped override class sharing specificity with a more general base class, decided by source order instead of intent. When adding a one-off size/position override to an element that already carries a shared utility class (`.sketch-title`, `.track-mascot`, etc.), default to a compound selector (`.base-class.override-class`) rather than a bare new class name, and confirm the computed style actually changed rather than trusting the diff.

## Polish pass #6 — mini-game: survival format, not a 30s timer

`js/minigame.js`'s core loop changed from a fixed-duration race to an endless survival run:

- **End condition**: the `elapsed >= GAME_MS ||` clause is gone from the end check — the *only* way a run ends now is `lives <= 0`. `GAME_MS` itself is removed from the file entirely.
- **Difficulty ramp**: `fallSpeed` and `spawnInterval` now scale with elapsed *survival* time (`elapsedSeconds`) instead of a 0–1 progress fraction toward a 30s cap. `fallSpeed` is deliberately **uncapped** — `BASE_FALL_SPEED + elapsedSeconds * FALL_SPEED_RAMP_PER_SEC`, climbing forever the longer a run lasts. `spawnInterval` ramps down at the same per-second rate the old curve used (so the opening ~30s of a run feels identical to before) but is floored at `MIN_SPAWN_MS`, since a spawn interval can't sensibly hit zero.
- **Scoring**: `LIFE_MULTIPLIERS` is gone. Every run now ends at 0 lives by definition, so a lives-remaining multiplier was meaningless — final score is now just raw coins (`score`, unchanged accumulation of `COIN_VALUE` per coin). A separate `coinsCollected` counter was added purely for the end-screen copy ("`N` coins collected · survived `Ns`") — it's always `score / COIN_VALUE` but reads more naturally as a count than back-deriving it from points.
- **HUD**: the countdown ("Time: 30" → "Time: 0") became a stopwatch ("Time: 0s" → counts up). This is display-only, not part of scoring — kept it because knowing how long you've survived is useful mid-run feedback, not because survival time factors into the score (it deliberately doesn't, per the "purely coins" requirement).
- **Copy**: pre-game explainer no longer mentions a 30-second window or "score is lower the fewer lives you have left" — rewritten around "survive as long as you can." The end-screen heading changed from "Race Complete!" (implied finishing a timed race) to "Game Over!" (fits a lives-exhausted ending).

**Testing note**: same `requestAnimationFrame`-throttles-in-a-background-tab limitation as previous passes made it impractical to reliably force a live lives-loss under browser automation (obstacles need real elapsed frames to fall into the player's row, and the tab isn't focused). What *was* confirmed live: the game no longer ends at the old 30s mark (let a run sit well past 60 real seconds with all 3 lives and it kept going), and the explainer/HUD copy is correct. The end-condition change itself is a one-line removal from previously-working, unchanged collision/lives-decrement code — worth a manual playthrough in a normal focused tab to watch a full run to game over, but low risk.

## Polish pass #7 — PIN login, mini-game timer fix, mini-game scoring

- **4-digit PIN added to login**. `js/auth.js` gained `isValidPin` and `hashPin` (SHA-256 via the browser's native `crypto.subtle` — no library, works in any secure context including `http://localhost`). The PIN is hashed *before* it's ever handed to `store.js`/`MockDB` — nothing downstream of `Auth.hashPin` ever sees plaintext. `store.js` gained `createUser(code, pinHash)`, `setPinHash(code, pinHash)`, and `touchLastSeen(code)`, replacing `getOrCreateUser` in the login submit flow (that function still exists and is still used for the session-resume path in `App.init()`, where re-checking a PIN each page load would be the wrong UX). Login logic: no existing record → create one with this PIN; existing record with no `pinHash` (a user from before this feature) → adopt this PIN rather than lock them out; existing record with a matching hash → in; matching fails → inline "Incorrect PIN for this login." and nothing proceeds.
- **A real bug this surfaced**: `showLogin()` resets the code/PIN inputs and the error message on every call, but was never resetting the submit button's `disabled`/text state — so logging out after a *successful* login (button left disabled, reading "Starting…" from the prior submit) landed you back on a login screen with a dead button. Fixed by resetting `submitBtn.disabled`/`textContent` in `showLogin()` too. Caught this live by actually logging out and screenshotting, not just testing a single submit.
- **Mini-game timer visibility**: the survival-time HUD span was flush against the modal's own right padding, which put it directly under `.modal-close` (`position:absolute; top:16px; right:16px; width:34px`) — the two genuinely overlapped in both x and y. Rather than touching `.modal-close` (shared by every modal in the app), added `padding-right: 44px` to just the mini-game's HUD row (`minigame.js`'s `startGame()`), confirmed via `getBoundingClientRect()` to leave 28px of clear space between the time text and the button.
- **Mini-game scoring**: added a modest time-survived penalty on top of the coins-collected score — `finalScore = max(0, coins×COIN_VALUE − round(elapsedSeconds × TIME_PENALTY_PER_SEC))`, with `TIME_PENALTY_PER_SEC = 1.5`. This tier rewards efficiency (same coins, faster run scores higher) without letting it override total coins collected — verified against both example cases in the request: 10 coins/20s (70) beats 10 coins/30s (55) on equal coins, and 15 coins/30s (105) still beats 10 coins/15s (77) despite the shorter run's speed advantage. The end screen now shows the breakdown ("`X` coin pts − `Y` time penalty = `Z`").

## Polish pass #8 — PIN reset flow, activity reorder/themes/rules

### PIN reset ("Forgot your PIN?")

A link on the login screen opens a step-through modal: enter your short login → enter one digit that was part of your PIN (any position) → set a new PIN. Genuine tension worth flagging: the PIN itself is hashed as a whole (SHA-256 of the 4-digit string, 10,000 possible values — a real hash), but "was digit X anywhere in your PIN?" can't be answered from that hash alone — hashing is one-way and mixes the whole input. The workaround (`Auth.hashPinDigits`, `store.js`) hashes each *unique digit* separately and stores that small set. This satisfies "not stored in plaintext" literally, but — documented plainly in the code, not glossed over — a hash of one of only 10 possible digits is trivially reversible via a 10-entry lookup table, so it's not meaningfully more secure than storing the digits directly. That's an acceptable tradeoff for a tool the project has been explicit about being low-friction/non-secure from the start, not something to treat as real protection if this pattern ever gets reused somewhere that matters.

- `store.js`: `createUser`/`setPin` now also take `pinDigitHashes`; new `resetPin` (sets new PIN + clears attempt tracking) and `registerFailedPinReset` (increments `pinResetAttempts`, sets `pinResetLockedUntil` once `maxAttempts` — 5 — is hit).
- Lockout is 5 minutes, checked *before* the digit is even evaluated on every attempt (re-fetches the user record each time, so a lock triggered by a concurrent attempt is still caught). Verified live: 5 fast-forwarded failed attempts → next reset attempt is blocked immediately with a "try again in about 5 minutes" message, without evaluating the digit at all.
- A successful reset does not auto-login — it closes the modal, pre-fills the short login field, clears/focuses the PIN field, and shows a toast, so the normal login path (with its own hash comparison) is still the one source of truth for "is this a valid session."

### Activity cards — corrected day/theme/order + rules

`data/schedule.js` is now the *only* place day/theme copy lives — game modal headers (`games.js`) read `day.label`/`day.theme` passed in from `app.js`'s `openActivityModal` rather than hardcoding their own copy, which is exactly the kind of drift that made the old headers stale in the first place.

| Day | Theme | Activity |
|---|---|---|
| Monday | On Your Marks | Who Went The Extra Mile? (open all week) |
| Tuesday | Picking Up The Pace | Hyperlink Race |
| Wednesday | The Halfway Mile | Photo Finish |
| Thursday | The Final Stretch | Snap Judgement |
| Friday | Crossing the Finish Line | Race Day Trivia |

- **"Open all week"**: a schedule entry can carry `openAllWeek: true` + `closesAfter: <date>`. `state.js`'s `computeDashboardDays` now derives `tileState` from `closesAfter` (defaulting to the day's own date, i.e. unchanged behavior for the other four) instead of a hardcoded "only active on its own day" check — the nomination tile stays green/active Monday through Friday and only turns "missed" if the whole week passes with nothing submitted. Verified live by jumping the preview clock to Wednesday: Monday's nomination card still read "Play now →" while Tuesday's (day-gated) Hyperlink Race had already flipped to "Time's up".
- **One submission per user, actually enforced everywhere**: Photo Finish already had an early `Store.hasSubmitted` guard; Hyperlink Race, Snap Judgement, Race Day Trivia, and the nomination did not — meaning re-clicking a completed tile (which stays visually "interactive," not "locked") could resubmit and re-increment `totalScore` indefinitely. Added the same guard to all four.
- **Modal header layout**: `.doodle-tag` + `.sketch-title` are both `display:inline-block`, so without a forcing container they sit side by side on one line rather than stacking — the same underlying issue as the hub-header bug from an earlier pass, here inside every game modal. Fixed once, generically, via a shared `.game-modal-header { display:flex; flex-direction:column }` wrapper (`modalHeader()` helper in `games.js`) used by all five activities, rather than a one-off fix per modal.
- **Photo Finish**: added a required image upload alongside the caption (`<input type="file">` → client-side resize/re-encode to a capped JPEG data URL via canvas, so entries don't bloat the mock localStorage-backed store — see `fileToResizedDataUrl`). Submit stays disabled until both a photo and a caption are present. Voting already prevented self-votes and enforced one vote per user (`e.code === user.code` disables the button; `Store.voteForPhoto` also rejects it server-side) — verified this still holds with the image-bearing entries.

Snap Judgement's and Race Day Trivia's actual game mechanics (question bank, image, scoring formulas) are deliberately untouched this pass — only their day/theme/order/header, per the request.

## Polish pass #9 — velocity-scaled cursor trail, timeline calendar popover

### Velocity-based cursor trail

`cursor.js`'s `onMove` now tracks real cursor speed (CSS px/ms) between consecutive `mousemove` events, smoothed with a simple low-pass filter (`smoothedSpeed = smoothedSpeed*0.65 + instSpeed*0.35`) so one jittery event can't spike or starve the trail. That speed drives three things — spawn frequency (interval ramps 90ms → 16ms as speed increases), particles per spawn (1 → 3), and particle opacity (0.32 → 0.90) — all linearly interpolated between `MIN_SPEED` (below which nothing spawns at all — "holding still") and `SPEED_FOR_MAX_DENSITY` (at/above which density and opacity cap out). Particle color, shape, and size are untouched (`spawnParticle` itself is unchanged); only how often and how strongly they appear varies. The CSS side just added a `--p-opacity` custom property, set per-particle at spawn time and read by the existing `particleFade` keyframe's `0%` opacity instead of a fixed `0.9`.

Verification note: this environment's Browser pane reports `document.hidden = true` while backgrounded (confirmed via `tabs_context`), and Chrome does not deliver `mousemove` DOM events to a hidden/occluded tab's JS at all (it still updates CSS `:hover` and lets screenshots render, which is why the popover work below *could* be verified live but this couldn't) — every synthetic hover/drag attempt through the automation tools produced zero real `mousemove` events, confirmed by a raw listener that logged nothing regardless of movement speed or distance. So instead of a live in-browser check, the exact spawn/opacity/interval math was extracted and traced headlessly in Node against four speed profiles (holding still, 0.15 px/ms, 1 px/ms, 3 px/ms) — see the trace: 0 particles at rest, 10 sparse/faint particles (opacity 0.35) for the slow drift, 14 at medium speed (opacity 0.58), 45 dense/full-opacity (0.90) for the fast flick. The math behaves as specified; only the live-pane observation is blocked by the tool environment, not the code.

### Weekly calendar popover on the timeline

Hovering a `.track-marker` on the timeline now shows a small popover: day + date, theme, activity name, and status (Locked / Active today (or "Open all week" for the nomination) / Completed ✓ / Missed). It's built by a new `dayPopoverHTML(d)` helper in `app.js`, called from `renderTrack()` with the exact same `d` (`{ day, activity, tileState }`) that already drives the marker itself and the activity board — so there's no separate list to keep in sync; editing a day's label/theme/activity name in `data/schedule.js` flows through automatically.

Shown/hidden via pure CSS `:hover` (`.track-marker:hover .track-marker-popover { opacity: 1 }`), not JS show/hide bookkeeping — it disappears the instant the pointer leaves, and there's nothing persisted on the hub view when not hovering. `.track-markers` has `pointer-events: none` (so its empty flex gaps don't swallow clicks meant for the mascot underneath — see the existing comment there); `.track-marker` opts back into `pointer-events: auto` so just the marker circle (and its popover) is hoverable, leaving that click-passthrough behavior intact. Verified live across all four states by setting the preview date to Wednesday with one activity pre-submitted: Monday showed "Completed ✓", Tuesday (day-gated, unsubmitted, past its date) showed "Missed", Wednesday showed "Active today", Thursday showed "Locked" — each with the correct day/theme/activity text pulled straight from `data/schedule.js`.

## Polish pass #10 — build-out for four activities

Hyperlink Race is untouched this pass (feedback to come later). Everything below was verified live end-to-end (nomination → Recognition Wall, Photo Finish upload → Gallery, Trivia's full 8-question round with the new scoring, all 8 Snap Judgement rounds through final scoring).

A shared plumbing change made two of these possible: `app.js`'s `openActivityModal` used to hand every activity a single `done()` callback that refreshes hub state, closes the modal, and toasts. That's still exactly right for Hyperlink Race/Snap Judgement/Trivia (`ctx.done()`), but Photo Finish and the nomination now need to show a post-submit view *inside* the still-open modal — so they got a second callback, `ctx.refresh()`, which updates hub state in the background without closing anything. All five activity functions' signatures changed from `(body, user, day, done)` to `(body, user, day, ctx)` accordingly.

**Who Went The Extra Mile? (nomination):** added a 12-emoji picker (`NOMINATION_EMOJIS` — 🏆⭐🔥🎉👏🥇🚀💪🙌🎯🏅✨, one required selection) and made the colleague's name a real first-and-last-name requirement (splits on whitespace, rejects a single word). On submit, instead of closing the modal it calls `ctx.refresh()` then renders a **Recognition Wall** in place — every nomination's emoji, nominee name, and reason, via a new `Store.getNominations()`. Landed on "Recognition Wall" as the name since "Recognition" is already one of the app's own pillars (see the trivia question bank). Someone who already submitted sees the wall immediately, same as everyone else who has.

**Photo Finish:** the native `<input type="file">` is now visually hidden with a `<label class="doodle-btn">` standing in as the themed "Choose a Photo" trigger (a standard accessible pattern — the label's `for` still delegates the real click to the input), and it updates to "Photo Selected ✓" once a file's chosen. Submitting no longer closes the modal — it calls `ctx.refresh()` and then **re-invokes `photoFinish()` on the same body**, which naturally re-renders as "already submitted" with a fresh Gallery that now includes the new entry, in place. Added a rules line at the top of the Gallery ("one vote, total — and you can't vote for your own entry") — the actual enforcement (self-vote disabled, one vote via `Store.voteForPhoto`) was already correct from an earlier pass.

**Race Day Trivia:** added a pre-game explainer (goal, base points for correct answers, how the speed bonus works, and that a wrong answer earns no speed bonus) before the first question. Scoring reworked: base points per correct answer, *plus* a speed bonus computed from one aggregate pace across the whole round (`totalElapsedSec / questions.length`, scaled between a par pace and a "too slow for any bonus" pace) rather than independent per-question bonuses — matching the ask that total time to finish the whole round factors in, not just per-question timing. The bonus is paid out proportional to `correctCount`, so answering fast while wrong earns nothing extra. Results screen shows the base/bonus breakdown, not just the total.

**Snap Judgement (the larger rework):**
- Free-text guessing replaced with a `<select>` dropdown of the full 33-product `MS_PRODUCTS` list (`data/ms-products.js`, alphabetized) — answers are checked with strict equality against the round's product, so there's no fuzzy-matching to get wrong.
- The game is now a fixed 8-round sequence (`SNAP_ROUNDS` in the same data file — product name + image path per round). Image paths are placeholders; each round's `<img>` has an `onerror` fallback to a "📸 Screenshot coming soon" card (still blurred at the current reveal level) so the game is fully playable before the real screenshots exist — swap the `image` paths in `data/ms-products.js` once they're in hand, nothing else needs to change.
- Reveal-level UI redesigned per the request into a horizontal progress bar (`.reveal-track`) with tick marks and a flag marker sliding to the current level's position, replacing the old text-only "Reveal level N / 4" line (the label's kept too, just alongside the bar now). **Caveat:** no reference screenshot actually came through in this session — I built my best interpretation of "horizontal bar with a marker at the current position" from the written description rather than an image. Happy to adjust the visual once you can point me at the actual reference.
- Added a pre-game explainer (goal, 8 rounds, dropdown mechanic, how scoring works) before round 1.
- Scoring now blends three factors, mirroring the mini-game's multi-factor approach but tuned to these inputs: base points per correct guess, a reveal-level bonus per correct guess (less revealed → bigger bonus, `SJ_REVEAL_BONUS_BY_LEVEL`), and one aggregate speed bonus from total time across all 8 rounds (same aggregate-pace approach as Trivia's rework, paid out proportional to correct guesses). The results screen breaks out all three components.

## Polish pass #11 — Snap Judgement's 8 real rounds, minus the actual image files

The round order/products were pinned to what was provided: Excel, Internet Explorer, Edge, Copilot, Teams, Outlook, SharePoint, PowerPoint (`SNAP_ROUNDS` in `data/ms-products.js`), replacing pass #10's placeholder line-up. Each round's `image` now points at `assets/snap-judgement/<product>.jpg` (kebab-case, e.g. `internet-explorer.jpg`) — that folder already existed, empty, in the project scaffold, so the naming/location was matched to it rather than the `assets/snap/` guess from pass #10.

**The screenshot files themselves are not saved to the project.** I can see the 8 images attached to the chat message well enough to match each one to its product name and ordering, but this environment gives me no way to pull the raw bytes of a pasted chat image onto disk — there's no tool that exposes attachment content as a file, only as something I can look at. So the code is fully wired up and ready (round order, product labels, file paths, the existing "Screenshot coming soon" fallback covers it in the meantime), but the eight actual `.jpg` files under `assets/snap-judgement/` still need to get there some other way — dragging them into the project folder directly, or telling me a location on this machine I can read them from with a file path, and I'll copy them into place myself.

**Update:** all 8 files showed up in `assets/snap-judgement/` shortly after (dropped in directly) — verified live, Snap Judgement now plays against the real screenshots end to end.

## Polish pass #12 — timeline popover (all-day view + discoverability), Snap Judgement polish

### Timeline popover now lists every activity that day, not just the portal one

`data/schedule.js`'s per-day `activities` array can now hold more than the one portal activity — each entry carries a `type` (`'remote'` for the app's own 5 activities, `'onsite'` for in-person ones with nothing to submit). By convention `activities[0]` stays the portal one (the only one with an `id`, tracked via bingo/`hasSubmitted`); anything after it is purely informational. Added Friday's on-site items — Victory Lap Party, Cake — as the concrete example given; I didn't invent on-site events for the other four days since nothing specific was provided for them, so as of now every other day still shows just its one remote activity. Send along the rest of the on-site schedule if there is one and it'll drop straight into the same array.

`app.js`'s `dayPopoverHTML` now maps over `d.day.activities` instead of reading just `d.activity`, tagging each with a small "Remote"/"On-Site" pill and only attaching the Locked/Active/Completed/Missed status badge to the portal entry (the on-site ones have no submission state to show). Nothing hardcoded — verified live on Friday (Race Day Trivia · Remote · Locked, plus Victory Lap Party and Cake both tagged On-Site) and Monday (still a clean single-item popover, unchanged in effect).

### Hover discoverability

Added a small persistent hint — "👆 Hover a day for the full schedule" — in the top-right corner of the track (`.track-hint`), hand-font, low-opacity, `pointer-events: none` so it never intercepts a click. Went with just this one static label rather than stacking it with a pulsing per-marker dot or a one-time load toast — the existing `.track-marker.active` pulse animation already means "pulsing marker" signals something specific (today's activity), and layering a second, different-meaning pulse on every marker risked muddying that rather than just nudging discovery.

### Snap Judgement

- **Reveal-bar icon**: the marker on the reveal progress bar is now 👀 instead of 🚩 — better fits "revealing/looking" than a finish-line flag.
- **Dropdown arrow spacing**: `.field select` now draws its own chevron (inline SVG background-image, `appearance: none`) instead of relying on the browser's native one. The native arrow ignores CSS padding and sits flush against the border in most browsers — exactly the "touching the edge" complaint — so the fix had to replace it, not just pad around it. 40px right padding, arrow positioned 14px from the edge.
- **Reveal mechanic: crop, not blur.** `#sjImg` is shown at full resolution the whole time; what changes per level is a `clip-path: inset(...)` window into it — same image, same `object-fit: cover` scale/position, just a centered rectangle that widens from level 1 (a small sliver, `inset(36%)`) to level 4 (`inset(0%)`, the whole image). The image itself never blurs. The "Screenshot coming soon" fallback card (shown if an image 404s) gets the same clip-path treatment for consistency, so the mechanic still reads correctly even without a real asset. Verified live against the real Excel screenshot: level 1 showed a small centered crop, level 2 a visibly wider one at the same position/scale, level 4 the full image — confirmed by reading `clip-path`/`background-position` computed values, not just eyeballing it.

## Polish pass #13 — Recognition Wall/Gallery parity, leaderboard links, popover breathing room

### Recognition Wall now literally shares Photo Finish's Gallery markup, not just its look

The Wall's own scrollbar (a `max-height: 340px; overflow-y: auto` flex list) is what was reading as cramped/awkward — Photo Finish's Gallery has no scroll container of its own at all; it just grows and lets the modal's existing `overflow-y: auto` handle it. `renderRecognitionWall` (`js/games.js`) now builds each card with the exact same inline structure and values the Gallery uses — `sketch-card` + `padding:14px`, a 120px rounded thumbnail block (the nominee's emoji standing in for the Gallery's photo), then a bold 13px name line and a 12px muted line, in the same `display:grid;grid-template-columns:1fr 1fr;gap:12px` container. Removed the now-dead `.recognition-wall`/`.recognition-card*` CSS rules that implemented the old, separate version. Verified live with three seeded nominations: clean 2-column grid, no inner scrollbar, sized and spaced identically to the Gallery.

### "View Leaderboard" on the one-shot activities' completion screens

Hyperlink Race, Snap Judgement, and Trivia each show a plain "already done" message if you reopen them after submitting (they don't have a Gallery/Wall-style view to return to). Factored that into one `renderAlreadyCompleted(body, day, title, message)` helper (`js/games.js`) that renders the message plus a "🏆 View Leaderboard" button wired to `App.openLeaderboardModal()` — which reuses the same generic modal already open, so clicking it swaps the completion message for the leaderboard in place rather than opening a second modal. Trivia's wording changed to the exact text requested ("✅ You've already completed the trivia!"); Snap Judgement's and Hyperlink Race's messages were left as-is per "consistent with what's already shown," just gaining the button. Verified live for all three, including the leaderboard swap-in-place.

### Weekday hover-card spacing

The popover's padding and gaps were one-off pixel values (7px/8px/9px, etc.) rather than the app's `--space-*` scale — switched them over (`--space-2`/`--space-3`/`--space-4` from `tokens.css`) and widened the card from 220px to 250px to give the larger padding room without crowding the text. Applies to the outer padding, the gap between an activity's name and its Remote/On-Site tag, the gap between stacked activity rows, and the margin above the status pill. Verified live on both a single-activity day (Monday) and a three-activity day (Friday).

## Polish pass #14 — Recognition Wall emoji, leaderboard deep-links, pill sizing

### Recognition Wall: emoji as a small accent, not a focal element

Replaced the 120px emoji "thumbnail" block with a small (17px) emoji sitting inline to the left of the nominee's name — reading order is now emoji → name → message, and the name/message carry the visual weight instead of the emoji. This is a deliberate divergence from Photo Finish's card (where the photo genuinely is the focal point and stays large) rather than the two cards being visually identical.

### "View Leaderboard" deep-links to the right tab

`app.js`'s `openLeaderboardModal` now takes an optional `activeKey` (defaults to `'combined'`, and falls back to it for any key that doesn't match a real tab rather than rendering a blank one). `Games.renderAlreadyCompleted` (`js/games.js`) takes a matching `leaderboardKey` param and passes it through — the key is just the same collection name (`hyperlinkRaceEntries`, `snapJudgementEntries`, `triviaEntries`) each activity already uses one line above for its own `Store.hasSubmitted` check, so there's no separate mapping table to keep in sync. Clicking "View Leaderboard" from any of the three now opens straight into that activity's own tab. Verified live for all three: Race Day Trivia's button landed on the Race Day Trivia tab showing the seeded score, and likewise for Snap Judgement and Hyperlink Race.

### Pill sizing (Remote/On-Site tags + the status pill)

Both `.track-marker-popover__type` and `.track-marker-popover__status` were relying on inherited line-height, which was crushing their vertical padding regardless of the padding values themselves. Gave both an explicit `line-height: 1`, switched to `inline-flex` centering, and bumped padding to 6px/12px (type) and 6px/14px (status) with `white-space: nowrap` so a pill's size comes purely from font-size + line-height + padding — never from its text length. Verified via computed `getBoundingClientRect()`: "Remote" and "On-Site" pills both measure exactly 22.0px tall.

## Polish pass #15 — conditional secret leaderboard tab, hover-card cleanup

### Secret leaderboard as a tab, unlocked per-user

`app.js`'s leaderboard modal now shows a `🤫 Secret Leaderboard` tab alongside the existing five, but only for a user who has actually played the mini-game — checked via `Store.hasSubmitted('minigameEntries', currentUser.code)`, a real recorded score, not `easterEgg.found` (which mascot.js sets just from clicking the mascot 7×, before the mini-game is ever played — those aren't the same thing). `visibleBoards()` computes the tab list fresh per render/open, and `openLeaderboardModal`'s deep-link validation now checks against that same per-user list. No new UI or scoring logic needed for the tab itself — `minigameEntries` docs are already `{code, score}`, the same shape the existing generic leaderboard branch already handles.

The existing separate "Secret Leaderboard 🤫" button/view reached from the mini-game's own end screen (`App.openSecretLeaderboard`) is untouched — this is an additional way in, not a replacement.

Verified live: a user with no mini-game score sees 5 tabs; after `Store.recordMinigameScore`, the same user's leaderboard shows 6, the new tab opens correctly, and shows the right row; a second, still-unplayed user opening the leaderboard still sees only 5, confirming the check is per-user, not global.

### Hover cards: schedule only, no completion-status pill

`dayPopoverHTML` (`js/app.js`) no longer renders the Completed/Missed/Active/Locked pill — the hover card is schedule information (activity name + Remote/On-Site tag) only, not a reflection of the viewing user's personal progress. Removed the now-dead `.track-marker-popover__status` CSS along with it. The marker circle itself (✓/✕/pulsing gold) and the activity cards below the timeline still show personal completion status exactly as before — only the hover popover changed. Verified live on both Monday (single activity) and Friday (three activities): tag pills intact, status pill gone.

## Polish pass #16 — packaged for Vercel

Added what was missing for a real deploy: `package.json` (zero dependencies, `build`/`start`/`dev` scripts) and `build.js`, a dependency-free Node script that validates every local asset `index.html` references actually exists and that every `.js` file under `js/`/`data/` parses cleanly — a real check, not a formality (verified it both catches a deliberately broken reference/syntax error and passes cleanly once fixed, via `npm run build`). No environment variables — the app is 100% client-side against `localStorage`, nothing to configure yet.

Originally shipped without a `vercel.json`, reasoning that Vercel's zero-config default output directory for an unrecognized framework would just be the repo root. That reasoning was wrong: adding a `build` script to `package.json` makes Vercel run the build through `@vercel/static-build`, which needs an explicit output directory rather than defaulting to root — the first real deploy built without error but had nothing to serve, i.e. exactly the 404 that surfaced. Fixed by adding `vercel.json` with `buildCommand`/`outputDirectory` pinned explicitly (`outputDirectory: "."`, the repo root — see "Deploy to Vercel" up top for the full explanation). Lesson for next time: verify a Vercel-specific claim like this against an actual deploy, not just local reasoning about local behavior — the two aren't guaranteed to match once a build step is genuinely involved.

Full local-run instructions, Vercel deploy steps, environment-variable note, and the mock-data-in-production caveat live in "Run locally" / "Deploy to Vercel" / "Mock data" near the top of this file.

## Polish pass #17 — daily cumulative trivia, schedule restructure, mobile responsiveness

The biggest structural pass so far — four changes, two of them (trivia format, activity scheduling) touching the data model, not just presentation.

### 1. Secret mini-game score excluded from Combined Overall — already true, now documented

Checked `Store.recordMinigameScore`: it only ever writes `minigameEntries` and the user's `easterEgg` field, never `totalScore` — the combined leaderboard and every per-user overall total were already unaffected by mini-game play. Nothing was broken; added an explicit comment on that function and verified live anyway (a 9999-point mini-game score left a user's Combined Overall total completely unchanged, while the secret leaderboard picked it up correctly) so this invariant is asserted, not just assumed.

### 2. Race Day Trivia: daily, cumulative, and gated per day

Replaced the single Friday-only quiz with 5 new questions unlocking each day Monday–Friday (the real questions provided, in `data/trivia-questions.js` — `TRIVIA_BY_DAY`, keyed by day id so a day's set can be swapped wholesale). Each day is its own submission that locks after answering, same pattern as every other single-day activity — implemented via `Store.submitTriviaDay`, which stores each day's entry as a Firestore-shaped subcollection doc (`triviaEntries/{code}/days/{dayId}`) rather than one flat doc, since a user now has up to 5 trivia entries, not one.

**Scoring accumulates across days**, both the real per-user total (`totalScore`, incremented the same way every other activity already does) and a dedicated `triviaTotalScore` field used to power the "Race Day Trivia" leaderboard tab (which now reads cumulative totals off `users` instead of the now-multi-doc `triviaEntries` collection directly — see `renderLeaderboard` in `app.js`). Cumulative score-so-far shows on the pre-game screen (once you've done at least one prior day), the results screen after each submission, and the "already completed today" revisit screen.

**The Bingo Card itself didn't need to change.** Rather than expanding `BINGO_KEYS` from 5 to 9 (one per activity-type plus one per trivia day), the 5 daily flags (`triviaMon`..`triviaFri`) track real per-day submission state but live outside `BINGO_KEYS`; the one flag `BINGO_KEYS` actually tracks (`trivia`) only flips true once all 5 day-flags are — preserving "one bingo square per activity type," so the Bingo Card's grid, styling, and "complete all 5" copy are all completely unchanged. Verified the whole chain live: per-day lock (Tuesday's trivia showed Completed while Tuesday's Hyperlink Race stayed independently playable), the `trivia` square staying unchecked at 1/5 days and flipping true at 5/5, and the leaderboard tab showing one correct cumulative row per user rather than 5.

### 3. Schedule restructure: Who Went The Extra Mile → Friday, Trivia → all week

`data/schedule.js`'s `activities` array per day now commonly holds two remote activities (that day's Race Day Trivia set plus its other activity) — Monday has just Trivia (since the nomination moved out), Friday has Trivia + the nomination + the two on-site items. Day themes stayed put; only which activities sit under each day changed, per the request.

**Judgment call, flagged as asked:** built the nomination as Friday-only/day-gated (dropped its `openAllWeek`/`closesAfter` override) rather than keeping it open all week, per the instruction to build it that way pending feedback. Flip `openAllWeek: true, closesAfter: '2026-10-09'` back onto its schedule entry to restore the old open-all-week behavior if that's preferred instead.

The activity board (`renderActivityBoard`) now flattens each day's activities into one card per activity rather than one per day, and `.activity-grid` switched from a fixed 5-column layout to `repeat(auto-fit, minmax(200px, 1fr))` so it reflows correctly for any count (5–9 depending on the day mix) at any width, with each day's card(s) still adjacent in reading order. The timeline hover popover needed **no changes at all** — it already iterated `day.activities` in full from an earlier pass, so it started listing both activities per day automatically the moment the schedule data changed. Verified live: Tuesday shows both Race Day Trivia and Hyperlink Race as separate cards and separate popover rows; Friday shows all four (Trivia, nomination, Victory Lap Party, Cake).

### 4. Mobile responsiveness

Removed the `min-width: 1180px` on `html, body` — this alone was blocking every phone-width layout regardless of anything else, so nothing downstream mattered until it was gone. Added two breakpoints (`@media (max-width: 900px)` for tablet, `@media (max-width: 640px)` for phone) retrofitting the existing desktop-first CSS: stacked login screen, a wrapping (not overflowing) timeline with the connecting road hidden below 640px, single-column activity/Gallery/Recognition-Wall grids, a bottom-sheet-style modal, 2-column Bingo Card and leaderboard tabs, and tightened-in fixed corner widgets. Swapped the custom `cursor: none` trail for the OS pointer below 640px, since it's a mouse-hover flourish with no touch equivalent.

**Photo Finish upload was checked specifically, per the request** — `<input type="file" accept="image/*">` already had no `capture` attribute, which is what makes mobile Safari/Chrome offer *both* camera and gallery in the native picker sheet (adding `capture` would have narrowed it to camera-only, the wrong call here) — confirmed via the input's own attributes, not just visually. Ran the full upload pipeline at a 375px viewport with an injected file (same technique used for this flow in earlier passes, since the sandbox can't drive a native OS picker): themed button → preview → caption gating → submit → Gallery, all working, all legible, all correctly sized for tapping.

Also audited and verified live at 375×812: login/PIN entry, the full timeline + activity board, a trivia question screen, the Bingo Card, and the Leaderboard (including its tab grid and champion card). One known minor item, left as-is rather than over-engineered: the `#previewStrip` day-jump widget (a mock-data testing aid, not part of the real user-facing app) visually overlaps the header at narrow widths — cosmetic only, on a dev-only tool.

## Polish pass #18 — anti-cheating locks, desktop/mobile gating, mini-game touch, timeline overhaul

### Secret Leaderboard tab — emoji dropped

`SECRET_BOARD`'s label lost its 🤫, matching every other tab (`Combined Overall`, `Hyperlink Race`, etc.), which were already plain text. The standalone secret-leaderboard *view* (`App.openSecretLeaderboard`, reached from the mini-game's own end screen — a different surface from the Leaderboard modal's tabs) keeps its own 🤫 in its heading; only the tab label was in scope here.

### Race Day Trivia gets its own weekly section

New "Race Day Trivia — 5 Days, 5 Rounds" section, parallel to "This Week's Activities" (same `.board-section`/`.activities-title`/`.activity-grid` classes, one added blurb line), populated from a new `renderTriviaSection()` in `app.js`. `renderActivityBoard()` now filters trivia out of the general list (`!activity.id.startsWith('trivia')`) so it's not shown twice. Both sections share one `activityCardHTML()`/`wireActivityCardClicks()` pair rather than duplicating the card-rendering logic. Uses the exact same `AppState.computeDashboardDays` day-gating as everywhere else — no separate lock/active/completed logic to maintain. Verified live: trivia fully gone from the main grid, its own section showing all 5 days' correct states, the main grid correctly down to just each day's *other* activity.

### Mid-session modal lock (Hyperlink Race, Snap Judgement, Race Day Trivia)

`app.js`'s generic modal gained a `modalLocked` flag: once true, both the backdrop-click and the ✕ stop dismissing it (the ✕ hides outright rather than sitting there inert). `ctx` (passed to every activity) gained `lock()`/`unlock()`/`quit()`; the three cheating-risk activities call `ctx.lock()` the instant a real session starts (Hyperlink Race's Start, Snap Judgement's/Trivia's Start-through-first-round), and each shows its own "Quit" button once locked — a `confirm()`-gated escape hatch (deliberately higher-friction than the outside-click it replaces, and quitting submits nothing, so the activity is simply replayable from scratch after). `openModal()` always resets the lock on a fresh open, so Bingo/Leaderboard/every other modal is completely unaffected — verified Photo Finish stays freely dismissible throughout. Verified live end-to-end for all three: ✕ disappears and a real backdrop click does nothing once Start is clicked, Quit closes and leaves the activity re-openable from a clean slate.

### Desktop-only gate for Hyperlink Race and Snap Judgement

New shared `isMobileViewport()` (in `minigame.js`, since it loads first and both it and `games.js` need it) — true only when the viewport is *both* narrow (<768px) and touch-primary (`(hover: none) and (pointer: coarse)`), so a narrow desktop window or a large touch laptop don't false-positive either way. Both activities check it right after their "already submitted" check and, if true, show a clear "needs a desktop or laptop browser" message instead of the game — not locked (nothing's started), so it's freely dismissible. Race Day Trivia has no such gate. Verified: blocked with the right copy on a 375px/touch-emulated viewport, loads completely normally at desktop width.

### Secret mini-game: swipe controls + adaptive explainer

Added `touchstart`/`touchend` handlers to the mini-game's canvas — a swipe past a 30px threshold shifts one lane, the direct touch equivalent of one arrow-key press (not a drag-to-position control), cleaned up alongside the existing `keydown` removal on game over. The pre-game explainer now shows "swipe left / right" or "tap ← →" based on `isMobileViewport()`. Verified live: a swipe gesture (via dispatched `Touch`/`TouchEvent`, since the sandbox can't drive real hardware touch) visibly moved the car from the center lane to the right lane.

### Timeline overhaul on mobile

Replaced the previous "wrap into a centered clump" mobile layout with a horizontally-scrolling strip — generously-spaced markers (`scroll-snap-type: x proximity`), a new mobile-only hint ("👉 Swipe to see all 5 days · Tap a day for details") replacing the desktop hover hint. Hit a real CSS spec gotcha along the way, caught by actually looking at the rendered page rather than trusting the rules: setting `overflow-x: auto` silently forces `overflow-y` to compute as `auto` too (the spec doesn't allow one axis `visible` and the other not), which was clipping the day labels sitting below each marker — fixed with a `min-height` on the scroll strip sized to contain a marker plus its label, so nothing ever overflows vertically in the first place.

**Tap-to-reveal replaces hover on mobile** (desktop's hover behavior is completely untouched). First attempt reused the existing hover-popover markup toggled via a `.tap-open` class — but that ran into the *same* overflow-clipping issue, this time for the popover itself (positioned via `bottom: 100%`, i.e. extending upward out of the now-`overflow-y:auto` scroll strip, silently clipped no matter how it was padded). Rather than patch around it, switched to a cleaner pattern: a `position: fixed` card (`#mobileDayCard`, `js/app.js`'s `showMobileDayCard`) appended to `<body>`, completely decoupled from the scrolling container — same content (`dayDetailInnerHTML`, factored out and shared with the desktop popover so there's exactly one place that builds it), docked to the bottom of the viewport, dismissed by its own ✕, a second tap elsewhere, or tapping another day. Verified live: tapping Friday's marker shows all 4 of its activities (2 remote, 2 on-site) correctly tagged in the fixed card; the close button and outside-tap both dismiss it correctly.

**Also discovered, unrelated to the above:** this project directory contains a nested `csw-2026/csw-2026/` folder with its own `.git` — a separate git clone, presumably created for the GitHub/Vercel connection from the previous deploy pass. All of this pass's edits were made in the outer project directory (the one this dev server serves from); that nested clone is a different, currently-stale copy and will need these changes pushed/synced into it separately before they reach the live Vercel deployment.

## Polish pass #19 — no in-modal Quit, for real

Adjustment to pass #18's mid-session lock: removed the "Quit" button entirely from Hyperlink Race, Snap Judgement, and Race Day Trivia. Once one of these actually starts, there is now no in-app control that exits it — not outside-click (already true), not the ✕ (already true), and now not a Quit button either. The only way out is finishing and submitting.

Removed `quitButtonHTML`/`wireQuitButton` from `js/games.js` entirely (they had no other callers) and `ctx.quit`/`ctx.unlock` from `app.js`'s `openActivityModal` (also unused elsewhere — `closeModal()` already resets the lock directly on the one path that still needs it, `ctx.done()`). `ctx.lock()` is the only capability these three activities get now.

**Confirmed this doesn't strand anyone**, per the request: `modalLocked` is a plain in-memory JS variable, never written to `localStorage`/the mock store — there's nothing for a page refresh to "clean up" because nothing about the lock is ever persisted in the first place. Verified live: started Hyperlink Race, locked it, confirmed a real backdrop click does nothing (✕ hidden, no Quit button anywhere) — then hard-refreshed the page and landed cleanly back on the hub with no stuck state, and reopened Hyperlink Race to confirm it starts completely fresh (nothing was submitted, so nothing carried over). Same lock-with-no-exit behavior confirmed for Snap Judgement and Race Day Trivia. Photo Finish and the nomination remain untouched — still freely dismissible, as before.
