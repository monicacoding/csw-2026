// ---------------------------------------------------------------------------
// "Short login" — a 4 capital-letter code identifies the user, paired with
// a 4-digit PIN. Not real authentication: intentionally low-friction for an
// internal fun-week activity hub, but the PIN is still hashed client-side
// before it ever touches the data layer — never stored or compared in
// plaintext. Single-page app, so this just tracks session state — no
// page-to-page redirects.
// ---------------------------------------------------------------------------

const Auth = (() => {
  const KEY = 'csw2026_code';

  function isValidCode(code) {
    return /^[A-Z]{4}$/.test(code);
  }

  function isValidPin(pin) {
    return /^[0-9]{4}$/.test(pin);
  }

  // SHA-256 via the browser's native Web Crypto API — no library needed, and
  // it's available in any secure context (https, or http on localhost).
  async function hashPin(pin) {
    const bytes = new TextEncoder().encode(pin);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // For the "forgot your PIN" flow: a set of hashes, one per unique digit in
  // the PIN, so we can later check "was this digit part of the PIN?" without
  // storing the PIN itself. Honest caveat, since this is a genuinely mock/
  // low-stakes tool: a hash of a single digit (0–9) is trivially reversible —
  // there are only 10 possible inputs — so this is not meaningfully more
  // secure than storing the digits directly. It exists so no field in the
  // record literally spells out the PIN, not as real protection.
  async function hashPinDigits(pin) {
    const uniqueDigits = [...new Set(pin.split(''))];
    return Promise.all(uniqueDigits.map((d) => hashPin(d)));
  }

  function getCurrentCode() {
    return sessionStorage.getItem(KEY);
  }

  function setCurrentCode(code) {
    sessionStorage.setItem(KEY, code);
  }

  function logOut() {
    sessionStorage.removeItem(KEY);
  }

  return { isValidCode, isValidPin, hashPin, hashPinDigits, getCurrentCode, setCurrentCode, logOut };
})();

window.Auth = Auth;
