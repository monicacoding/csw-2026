// ---------------------------------------------------------------------------
// Data access layer. Every read/write for the app goes through here.
// Currently backed by MockDB (js/mock-db.js) — see the note there for how
// to swap this back to real Firestore later without touching callers.
//
// Collections:
//   users/{CODE}
//   hyperlinkRaceEntries/{CODE}
//   snapJudgementEntries/{CODE}
//   triviaEntries/{CODE}
//   photoFinishEntries/{CODE}            + votes/{VOTER_CODE} subcollection
//   nominations/{CODE}
//   minigameEntries/{CODE}
// ---------------------------------------------------------------------------

const Store = (() => {
  function emptyBingo() {
    return {
      hyperlinkRace: false,
      snapJudgement: false,
      trivia: false,
      photoFinish: false,
      nomination: false,
      bonus: false,
    };
  }

  async function getOrCreateUser(code) {
    const existing = MockDB.getDoc('users', code);
    if (existing) {
      MockDB.setDoc('users', code, { lastSeenAt: MockDB.now() }, true);
      return { id: code, ...existing, lastSeenAt: MockDB.now() };
    }
    const fresh = {
      code,
      createdAt: MockDB.now(),
      lastSeenAt: MockDB.now(),
      bingo: emptyBingo(),
      totalScore: 0,
      finishLineSeenAt: null,
      easterEgg: { found: false, foundAt: null, minigameHighScore: 0 },
      cursorGlyph: '🏎️',
    };
    MockDB.setDoc('users', code, fresh, false);
    return { id: code, ...fresh };
  }

  async function getUser(code) {
    const data = MockDB.getDoc('users', code);
    return data ? { id: code, ...data } : null;
  }

  // Creates a brand-new user record with a PIN (+ its per-digit hash set,
  // for the "forgot your PIN" flow — see Auth.hashPinDigits) already set.
  // Callers (the login flow) are responsible for hashing first — this layer
  // never sees or stores plaintext.
  async function createUser(code, pinHash, pinDigitHashes) {
    const fresh = {
      code,
      createdAt: MockDB.now(),
      lastSeenAt: MockDB.now(),
      bingo: emptyBingo(),
      totalScore: 0,
      finishLineSeenAt: null,
      easterEgg: { found: false, foundAt: null, minigameHighScore: 0 },
      cursorGlyph: '🏎️',
      pinHash,
      pinDigitHashes,
      pinResetAttempts: 0,
      pinResetLockedUntil: null,
    };
    MockDB.setDoc('users', code, fresh, false);
    return { id: code, ...fresh };
  }

  // Adopts a PIN for a record that doesn't have one yet (e.g. a user created
  // before PINs existed) — sets it, does not compare against anything.
  async function setPin(code, pinHash, pinDigitHashes) {
    MockDB.setDoc('users', code, { pinHash, pinDigitHashes }, true);
  }

  // A successful "forgot your PIN" reset: sets the new PIN and clears any
  // failed-attempt tracking.
  async function resetPin(code, pinHash, pinDigitHashes) {
    MockDB.setDoc('users', code, {
      pinHash, pinDigitHashes,
      pinResetAttempts: 0,
      pinResetLockedUntil: null,
    }, true);
  }

  // Records one wrong "which digit was in your PIN?" guess. Locks further
  // reset attempts for `lockoutMs` once `maxAttempts` is reached. Returns
  // the updated attempt count and whether this guess triggered the lock.
  async function registerFailedPinReset(code, { maxAttempts, lockoutMs }) {
    const user = MockDB.getDoc('users', code) || {};
    const attempts = (user.pinResetAttempts || 0) + 1;
    const patch = { pinResetAttempts: attempts, pinResetLastAttempt: MockDB.now() };
    const locked = attempts >= maxAttempts;
    if (locked) patch.pinResetLockedUntil = new Date(Date.now() + lockoutMs).toISOString();
    MockDB.setDoc('users', code, patch, true);
    return { attempts, locked };
  }

  async function touchLastSeen(code) {
    MockDB.setDoc('users', code, { lastSeenAt: MockDB.now() }, true);
  }

  // Writes a game entry + flips the matching bingo flag + bumps totalScore,
  // mirroring the batched write we'd do against Firestore.
  async function submitEntry({ collection, code, data, bingoKey, scoreDelta = 0 }) {
    MockDB.setDoc(collection, code, { code, submittedAt: MockDB.now(), ...data }, false);

    const user = MockDB.getDoc('users', code) || { bingo: emptyBingo(), totalScore: 0 };
    const bingo = { ...emptyBingo(), ...(user.bingo || {}) };
    bingo[bingoKey] = true;

    const coreDone = BINGO_KEYS.every((k) => bingo[k]);
    if (coreDone) bingo.bonus = true;

    MockDB.incrementField('users', code, 'totalScore', scoreDelta, { bingo, lastSeenAt: MockDB.now() });

    return { coreDone };
  }

  async function hasSubmitted(collection, code) {
    return !!MockDB.getDoc(collection, code);
  }

  async function getLeaderboard(collection, { orderBy, direction = 'desc', limit = 50 }) {
    let rows = MockDB.listCollection(collection);
    rows.sort((a, b) => {
      const av = a[orderBy] ?? 0, bv = b[orderBy] ?? 0;
      if (av < bv) return direction === 'asc' ? -1 : 1;
      if (av > bv) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return rows.slice(0, limit);
  }

  async function getCombinedLeaderboard(limit = 50) {
    return getLeaderboard('users', { orderBy: 'totalScore', direction: 'desc', limit });
  }

  async function getPhotoFinishEntries() {
    const rows = MockDB.listCollection('photoFinishEntries');
    rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    return rows;
  }

  // Every "Who Went The Extra Mile?" nomination, newest first — powers the
  // Recognition Wall (only shown to users who've submitted their own).
  async function getNominations() {
    const rows = MockDB.listCollection('nominations');
    rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    return rows;
  }

  // One vote per user, enforced per-entry via the votes/{voterCode} doc.
  async function voteForPhoto(entryCode, voterCode) {
    if (entryCode === voterCode) throw new Error("You can't vote for your own entry.");
    const votesCollection = MockDB.subPath('photoFinishEntries', entryCode, 'votes');
    if (MockDB.getDoc(votesCollection, voterCode)) {
      throw new Error('Already voted for this entry.');
    }
    MockDB.setDoc(votesCollection, voterCode, { votedAt: MockDB.now() }, false);
    MockDB.incrementField('photoFinishEntries', entryCode, 'votes', 1);
  }

  async function recordMinigameScore(code, score) {
    MockDB.setDoc('minigameEntries', code, { code, score, playedAt: MockDB.now() }, false);
    const user = MockDB.getDoc('users', code);
    const prevHigh = user?.easterEgg?.minigameHighScore || 0;
    MockDB.setDoc('users', code, {
      easterEgg: { found: true, foundAt: MockDB.now(), minigameHighScore: Math.max(prevHigh, score) },
    }, true);
  }

  async function markEasterEggFound(code) {
    const user = MockDB.getDoc('users', code);
    const prevHigh = user?.easterEgg?.minigameHighScore || 0;
    MockDB.setDoc('users', code, {
      easterEgg: { found: true, foundAt: MockDB.now(), minigameHighScore: prevHigh },
    }, true);
  }

  async function markFinishLineSeen(code) {
    MockDB.setDoc('users', code, { finishLineSeenAt: MockDB.now() }, true);
  }

  async function setCursorGlyph(code, glyph) {
    MockDB.setDoc('users', code, { cursorGlyph: glyph }, true);
  }

  return {
    getOrCreateUser,
    getUser,
    createUser,
    setPin,
    resetPin,
    registerFailedPinReset,
    touchLastSeen,
    submitEntry,
    hasSubmitted,
    getLeaderboard,
    getCombinedLeaderboard,
    getPhotoFinishEntries,
    getNominations,
    voteForPhoto,
    recordMinigameScore,
    markEasterEggFound,
    markFinishLineSeen,
    setCursorGlyph,
    emptyBingo,
  };
})();

window.Store = Store;
