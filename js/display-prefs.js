// ---------------------------------------------------------------------------
// The player's cursor choice: an emoji glyph, or Cursor.NONE ("use my normal
// system cursor" — the custom cursor and its trail are removed entirely, see
// js/cursor.js). Exists as its own module so the picker, the login/boot path
// and showHub() all go through one place.
//
// Source of truth is the user's own doc (`cursorGlyph` — Store.setCursorGlyph,
// the same plain-field pattern setOnboardingDismissed uses). The choice is
// also mirrored to localStorage purely so the *next* page load can apply it
// before login: someone who picked "Default cursor" because the site lags
// shouldn't have to sit through the custom cursor on the login screen first,
// and the user doc can't be read until they've logged in. The mirror is a
// head start, never authoritative — applyUser() below overwrites it with
// whatever the logged-in user's doc actually says.
// ---------------------------------------------------------------------------

const DisplayPrefs = (() => {
  const LS_GLYPH = 'csw2026_cursor_glyph';
  const DEFAULT_GLYPH = '🏎️';

  let glyph = DEFAULT_GLYPH;
  let appliedForCode = null;

  function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function lsSet(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode etc. — the mirror is optional */ } }

  function applyGlyph(g) {
    glyph = g;
    Cursor.setGlyph(g);
    lsSet(LS_GLYPH, g);
  }

  // Called once, first thing in App.init(), before anything has loaded.
  function boot() {
    glyph = lsGet(LS_GLYPH) || DEFAULT_GLYPH;
    Cursor.init(glyph);
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
  }

  function setGlyph(g) {
    applyGlyph(g);
    const code = Auth.getCurrentCode();
    if (code) Store.setCursorGlyph(code, g).catch((e) => console.warn('Could not save cursor choice', e));
  }

  return { boot, applyUser, setGlyph, getGlyph: () => glyph };
})();

window.DisplayPrefs = DisplayPrefs;
