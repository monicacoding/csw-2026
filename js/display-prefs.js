// ---------------------------------------------------------------------------
// Per-user display preferences that exist for performance/comfort, not style:
//  - cursor glyph, including Cursor.NONE ("use my normal system cursor" —
//    the custom cursor and its trail are removed entirely, see js/cursor.js)
//  - "Reduce animations" (html.reduce-motion — see the block of that name at
//    the end of css/sketch.css for what it turns off)
//
// Source of truth is the user's own doc (`cursorGlyph`, `reduceMotion` —
// Store.setCursorGlyph / Store.setReduceMotion, the same plain-field
// pattern setOnboardingDismissed already uses). Each choice is also mirrored
// to localStorage purely so the *next* page load can apply it before login:
// the people who need these switches are exactly the ones for whom the login
// screen already lags, and the user doc can't be read until they've logged
// in. The mirror is a head start, never authoritative — applyUser() below
// overwrites it with whatever the logged-in user's doc actually says.
//
// "Reduce animations" with no saved choice follows the OS-level
// prefers-reduced-motion setting, so someone who's already told their device
// they want less motion doesn't have to find a switch in a popover first.
// ---------------------------------------------------------------------------

const DisplayPrefs = (() => {
  const LS_GLYPH = 'csw2026_cursor_glyph';
  const LS_MOTION = 'csw2026_reduce_motion';
  const DEFAULT_GLYPH = '🏎️';

  let glyph = DEFAULT_GLYPH;
  let reduceMotion = false;
  let appliedForCode = null;

  function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function lsSet(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode etc. — the mirror is optional */ } }

  function osPrefersReducedMotion() {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function applyGlyph(g) {
    glyph = g;
    Cursor.setGlyph(g);
    lsSet(LS_GLYPH, g);
  }

  function applyReduceMotion(on) {
    reduceMotion = on;
    document.documentElement.classList.toggle('reduce-motion', on);
    Cursor.setTrail(!on);
    lsSet(LS_MOTION, on ? '1' : '0');
  }

  // Called once, first thing in App.init(), before anything has loaded.
  function boot() {
    const savedMotion = lsGet(LS_MOTION);
    reduceMotion = savedMotion === null ? osPrefersReducedMotion() : savedMotion === '1';
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
    glyph = lsGet(LS_GLYPH) || DEFAULT_GLYPH;
    Cursor.init(glyph);
    Cursor.setTrail(!reduceMotion);
  }

  // Called from every showHub(), but only does anything the first time it
  // sees a given login. showHub re-runs constantly (every refresh), often
  // with a `currentUser` that predates a just-made picker change — applying
  // the doc every time would flip a fresh choice back on the very next
  // re-render. After the first apply, this module's own state is the live
  // truth for the session and the picker keeps it (and the doc) up to date.
  function applyUser(user) {
    if (!user || appliedForCode === user.code) return;
    appliedForCode = user.code;
    applyGlyph(user.cursorGlyph || DEFAULT_GLYPH);
    applyReduceMotion(typeof user.reduceMotion === 'boolean' ? user.reduceMotion : osPrefersReducedMotion());
  }

  function persist(promise, what) {
    promise.catch((e) => console.warn(`Could not save ${what}`, e));
  }

  function setGlyph(g) {
    applyGlyph(g);
    const code = Auth.getCurrentCode();
    if (code) persist(Store.setCursorGlyph(code, g), 'cursor choice');
  }

  function setReduceMotion(on) {
    applyReduceMotion(on);
    const code = Auth.getCurrentCode();
    if (code) persist(Store.setReduceMotion(code, on), 'reduce-animations choice');
  }

  return {
    boot, applyUser, setGlyph, setReduceMotion,
    getGlyph: () => glyph,
    getReduceMotion: () => reduceMotion,
  };
})();

window.DisplayPrefs = DisplayPrefs;
