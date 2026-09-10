// ---------------------------------------------------------------------------
// Data access layer. Every read/write for the app goes through here.
// Backed by real Firestore (js/firestore-db.js) as of the Firebase swap —
// previously js/mock-db.js (still in the repo, unused). Every db-layer call
// below is awaited: FirestoreDB's methods are genuinely async (real network
// requests), unlike MockDB's synchronous localStorage reads, which is the
// one thing that had to change here — the function *shapes* (Store.*, what
// the rest of the app calls) never did.
//
// Collections:
//   users/{CODE}
//   hyperlinkRaceEntries/{CODE}
//   hyperlinkRaceProgress/{CODE}          the per-user assigned answer word
//                                         — see assignHyperlinkAnswer below
//   snapJudgementEntries/{CODE}
//   triviaEntries/{CODE}/days/{DAY_ID}   subcollection — see submitTriviaDay
//   photoFinishEntries/{CODE}            + votes/{VOTER_CODE} subcollection
//   nominations/{CODE}
//   minigameEntries/{CODE}
// ---------------------------------------------------------------------------

const Store = (() => {
  // Race Day Trivia's 5 daily sets, keyed to match data/schedule.js's day
  // ids and TRIVIA_BY_DAY's keys 1:1.
  const TRIVIA_DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const triviaDayBingoKey = (dayId) => `trivia${dayId[0].toUpperCase()}${dayId.slice(1)}`;

  function emptyBingo() {
    return {
      hyperlinkRace: false,
      snapJudgement: false,
      // `trivia` is the single square BINGO_KEYS/the Bingo Card track — see
      // submitTriviaDay below, it only flips true once every triviaX flag
      // has. The 5 triviaX flags are the *real* per-day submission state
      // (day-gating, "already completed" checks) but aren't themselves in
      // BINGO_KEYS, so they don't change what "5 core squares" means.
      trivia: false,
      triviaMon: false,
      triviaTue: false,
      triviaWed: false,
      triviaThu: false,
      triviaFri: false,
      photoFinish: false,
      nomination: false,
      bonus: false,
    };
  }

  async function getOrCreateUser(code) {
    const existing = await FirestoreDB.getDoc('users', code);
    if (existing) {
      await FirestoreDB.setDoc('users', code, { lastSeenAt: FirestoreDB.now() }, true);
      return { id: code, ...existing, lastSeenAt: FirestoreDB.now() };
    }
    const fresh = {
      code,
      createdAt: FirestoreDB.now(),
      lastSeenAt: FirestoreDB.now(),
      bingo: emptyBingo(),
      totalScore: 0,
      finishLineSeenAt: null,
      easterEgg: { found: false, foundAt: null, minigameHighScore: 0 },
      cursorGlyph: '🏎️',
      // See App.maybeShowOnboarding/openOnboardingModal — false (or, for
      // any user created before this field existed, simply absent, which
      // reads exactly as falsy) means "hasn't dismissed it with 'don't
      // show again' checked," so it keeps auto-showing on login.
      onboardingDismissed: false,
    };
    await FirestoreDB.setDoc('users', code, fresh, false);
    return { id: code, ...fresh };
  }

  async function getUser(code) {
    const data = await FirestoreDB.getDoc('users', code);
    return data ? { id: code, ...data } : null;
  }

  // Creates a brand-new user record with a PIN (+ its per-digit hash set,
  // for the "forgot your PIN" flow — see Auth.hashPinDigits) already set.
  // Callers (the login flow) are responsible for hashing first — this layer
  // never sees or stores plaintext.
  async function createUser(code, pinHash, pinDigitHashes) {
    const fresh = {
      code,
      createdAt: FirestoreDB.now(),
      lastSeenAt: FirestoreDB.now(),
      bingo: emptyBingo(),
      totalScore: 0,
      finishLineSeenAt: null,
      easterEgg: { found: false, foundAt: null, minigameHighScore: 0 },
      cursorGlyph: '🏎️',
      onboardingDismissed: false,
      pinHash,
      pinDigitHashes,
      pinResetAttempts: 0,
      pinResetLockedUntil: null,
    };
    await FirestoreDB.setDoc('users', code, fresh, false);
    return { id: code, ...fresh };
  }

  // Adopts a PIN for a record that doesn't have one yet (e.g. a user created
  // before PINs existed) — sets it, does not compare against anything.
  async function setPin(code, pinHash, pinDigitHashes) {
    await FirestoreDB.setDoc('users', code, { pinHash, pinDigitHashes }, true);
  }

  // A successful "forgot your PIN" reset: sets the new PIN and clears any
  // failed-attempt tracking.
  async function resetPin(code, pinHash, pinDigitHashes) {
    await FirestoreDB.setDoc('users', code, {
      pinHash, pinDigitHashes,
      pinResetAttempts: 0,
      pinResetLockedUntil: null,
    }, true);
  }

  // Records one wrong "which digit was in your PIN?" guess. Locks further
  // reset attempts for `lockoutMs` once `maxAttempts` is reached. Returns
  // the updated attempt count and whether this guess triggered the lock.
  async function registerFailedPinReset(code, { maxAttempts, lockoutMs }) {
    const user = (await FirestoreDB.getDoc('users', code)) || {};
    const attempts = (user.pinResetAttempts || 0) + 1;
    const patch = { pinResetAttempts: attempts, pinResetLastAttempt: FirestoreDB.now() };
    const locked = attempts >= maxAttempts;
    if (locked) patch.pinResetLockedUntil = new Date(Date.now() + lockoutMs).toISOString();
    await FirestoreDB.setDoc('users', code, patch, true);
    return { attempts, locked };
  }

  async function touchLastSeen(code) {
    await FirestoreDB.setDoc('users', code, { lastSeenAt: FirestoreDB.now() }, true);
  }

  // Writes a game entry + flips the matching bingo flag + bumps totalScore.
  async function submitEntry({ collection, code, data, bingoKey, scoreDelta = 0 }) {
    await FirestoreDB.setDoc(collection, code, { code, submittedAt: FirestoreDB.now(), ...data }, false);

    const user = (await FirestoreDB.getDoc('users', code)) || { bingo: emptyBingo(), totalScore: 0 };
    const bingo = { ...emptyBingo(), ...(user.bingo || {}) };
    bingo[bingoKey] = true;

    const coreDone = BINGO_KEYS.every((k) => bingo[k]);
    if (coreDone) bingo.bonus = true;

    await FirestoreDB.incrementField('users', code, 'totalScore', scoreDelta, { bingo, lastSeenAt: FirestoreDB.now() });

    return { coreDone };
  }

  async function hasSubmitted(collection, code) {
    return !!(await FirestoreDB.getDoc(collection, code));
  }

  // The raw stored entry itself (not just whether one exists) — used to
  // show a user a read-only view of their own actual result once an
  // activity card shows as "Completed" (see js/games.js's renderAlreadyCompleted
  // call sites, which read real score/answer fields off this rather than
  // just a generic "you're done" message).
  async function getEntry(collection, code) {
    return FirestoreDB.getDoc(collection, code);
  }

  // ---- Race Day Trivia: daily + cumulative -------------------------------
  // Each day's 5-question set is its own submission, stored as a real
  // Firestore subcollection doc (triviaEntries/{code}/days/{dayId}) rather
  // than one flat triviaEntries/{code} doc, since a user now has up to 5
  // separate trivia entries, not one. (firestore.rules has a matching
  // nested `match /days/{dayId}` rule for this — see that file.)
  //
  // Gates exactly like any other single-day activity via its own bingo flag
  // (`triviaMon` etc.) — but that flag is deliberately *not* one of
  // BINGO_KEYS. The one BINGO_KEYS actually tracks, `trivia`, only flips
  // true once every day's flag has, i.e. once the whole week's trivia is
  // done — same "one square per activity type" meaning this list always had.
  //
  // Score is cumulative: `triviaTotalScore` on the user doc is the running
  // sum across every day completed so far (this pass's contribution goes
  // through the normal totalScore increment too, same as every other
  // activity — Race Day Trivia was never special-cased out of the combined
  // score, only the secret mini-game is, see recordMinigameScore below).
  async function submitTriviaDay({ code, dayId, data, scoreDelta = 0 }) {
    const daysCollection = FirestoreDB.subPath('triviaEntries', code, 'days');
    await FirestoreDB.setDoc(daysCollection, dayId, { code, dayId, submittedAt: FirestoreDB.now(), ...data }, false);

    const user = (await FirestoreDB.getDoc('users', code)) || { bingo: emptyBingo(), totalScore: 0, triviaTotalScore: 0 };
    const bingo = { ...emptyBingo(), ...(user.bingo || {}) };
    bingo[triviaDayBingoKey(dayId)] = true;

    const allDaysDone = TRIVIA_DAY_IDS.every((d) => bingo[triviaDayBingoKey(d)]);
    if (allDaysDone) bingo.trivia = true;

    const coreDone = BINGO_KEYS.every((k) => bingo[k]);
    if (coreDone) bingo.bonus = true;

    const triviaTotalScore = (user.triviaTotalScore || 0) + scoreDelta;
    await FirestoreDB.incrementField('users', code, 'totalScore', scoreDelta, {
      bingo, triviaTotalScore, lastSeenAt: FirestoreDB.now(),
    });

    return { coreDone, allDaysDone, triviaTotalScore };
  }

  async function hasSubmittedTriviaDay(code, dayId) {
    const daysCollection = FirestoreDB.subPath('triviaEntries', code, 'days');
    return !!(await FirestoreDB.getDoc(daysCollection, dayId));
  }

  // The raw stored entry for one specific day's trivia round — same
  // "read-only view of your own result" purpose as getEntry above, just
  // scoped to the days/{dayId} subcollection instead of a flat collection.
  async function getTriviaDayEntry(code, dayId) {
    const daysCollection = FirestoreDB.subPath('triviaEntries', code, 'days');
    return FirestoreDB.getDoc(daysCollection, dayId);
  }

  // Every trivia day this user has completed so far — used to show "days
  // completed" alongside the cumulative score.
  async function getTriviaDaysCompleted(code) {
    const daysCollection = FirestoreDB.subPath('triviaEntries', code, 'days');
    return FirestoreDB.listCollection(daysCollection);
  }

  // ---- Hyperlink Race: per-user assigned answer word ---------------------
  // The anti-sharing mechanism (see data/mock-docs.js's answerCandidates on
  // the goal page): the first time a user reaches the goal page, the
  // running game session (js/games.js's runHyperlinkRace) picks one
  // candidate word for them and calls this to persist it — `merge: true`
  // (setDoc's third arg) so a re-entry into the same page later in the same
  // session doesn't clobber it with a fresh word. Read back at submit time
  // via getHyperlinkAssignment rather than trusting only the in-memory copy
  // the session already holds, so what a user is actually scored against is
  // whatever was durably assigned, not whatever their client claims it was.
  async function assignHyperlinkAnswer(code, word) {
    await FirestoreDB.setDoc('hyperlinkRaceProgress', code, { code, word, assignedAt: FirestoreDB.now() }, true);
  }

  async function getHyperlinkAssignment(code) {
    return FirestoreDB.getDoc('hyperlinkRaceProgress', code);
  }

  async function getLeaderboard(collection, { orderBy, direction = 'desc', limit = 50 }) {
    let rows = await FirestoreDB.listCollection(collection);
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
    const rows = await FirestoreDB.listCollection('photoFinishEntries');
    rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    return rows;
  }

  // Every "Who Went The Extra Mile?" nomination, newest first — powers the
  // Recognition Wall (only shown to users who've submitted their own).
  async function getNominations() {
    const rows = await FirestoreDB.listCollection('nominations');
    rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    return rows;
  }

  // One vote per user, enforced per-entry via the votes/{voterCode} doc.
  async function voteForPhoto(entryCode, voterCode) {
    if (entryCode === voterCode) throw new Error("You can't vote for your own entry.");
    const votesCollection = FirestoreDB.subPath('photoFinishEntries', entryCode, 'votes');
    if (await FirestoreDB.getDoc(votesCollection, voterCode)) {
      throw new Error('Already voted for this entry.');
    }
    await FirestoreDB.setDoc(votesCollection, voterCode, { votedAt: FirestoreDB.now() }, false);
    await FirestoreDB.incrementField('photoFinishEntries', entryCode, 'votes', 1);
  }

  // Deliberately never touches `totalScore` — the secret mini-game's score
  // counts only toward its own secret leaderboard (Store.getLeaderboard
  // with collection 'minigameEntries'), not the Combined Overall board or
  // any per-user overall total. Finding the easter egg is a bonus, not a
  // requirement, so someone who never finds it shouldn't be scored against
  // someone who did. `FirestoreDB.setDoc` here — not `incrementField` — is
  // what keeps this true: the only field ever written on the user doc for
  // this is `easterEgg`, never `totalScore`.
  async function recordMinigameScore(code, score) {
    await FirestoreDB.setDoc('minigameEntries', code, { code, score, playedAt: FirestoreDB.now() }, false);
    const user = await FirestoreDB.getDoc('users', code);
    const prevHigh = user?.easterEgg?.minigameHighScore || 0;
    await FirestoreDB.setDoc('users', code, {
      easterEgg: { found: true, foundAt: FirestoreDB.now(), minigameHighScore: Math.max(prevHigh, score) },
    }, true);
  }

  async function markEasterEggFound(code) {
    const user = await FirestoreDB.getDoc('users', code);
    const prevHigh = user?.easterEgg?.minigameHighScore || 0;
    await FirestoreDB.setDoc('users', code, {
      easterEgg: { found: true, foundAt: FirestoreDB.now(), minigameHighScore: prevHigh },
    }, true);
  }

  async function markFinishLineSeen(code) {
    await FirestoreDB.setDoc('users', code, { finishLineSeenAt: FirestoreDB.now() }, true);
  }

  async function setCursorGlyph(code, glyph) {
    await FirestoreDB.setDoc('users', code, { cursorGlyph: glyph }, true);
  }

  // The onboarding modal's "Don't show this again" checkbox (see
  // App.renderOnboardingContent) — written the moment the checkbox is
  // toggled, not deferred until the modal is actually dismissed, so
  // whatever it's set to always reflects reality by the time the modal
  // closes regardless of which of its several close paths (✕, backdrop
  // click, the Got It button) the user ends up using.
  async function setOnboardingDismissed(code, dismissed) {
    await FirestoreDB.setDoc('users', code, { onboardingDismissed: dismissed }, true);
  }

  // ---- Dev-only: reset one user's own test data ---------------------------
  // Reachable only from the Developer Mode panel's Reset button (behind
  // js/app.js's DEV_MODE flag — see that file). Deliberately scoped to a
  // single user's own documents, never a whole-collection/whole-database
  // wipe — see js/firestore-db.js's header comment for why a global reset
  // was never brought back after this app left MockDB/localStorage: this is
  // the real, shared Firestore project, and a one-click reset that could
  // touch every tester's data would be genuinely destructive rather than
  // just "start my own test over."
  //
  // Overwrites `users/{code}` back to the exact same fresh shape
  // getOrCreateUser gives a brand-new code (no PIN — the next login treats
  // this like a legacy no-PIN record and lets them set a new one, same path
  // createUser already handles), and deletes every other doc this code owns
  // across every collection: its own game entries, all 5 trivia days, and
  // the Hyperlink Race answer assignment. Deleting a doc that was never
  // created (e.g. an activity this user never played) is a no-op, not an
  // error, so this doesn't need to check what actually exists first.
  //
  // Not touched, deliberately: any *other* user's documents — including
  // photoFinishEntries/{otherCode}/votes/{code}, a vote this user may have
  // cast on someone else's photo. Scrubbing that would mean writing into
  // every other tester's own subcollection, which is a meaningfully
  // different (and more invasive) operation than resetting your own
  // account, and isn't attempted here.
  async function resetUserProgress(code) {
    const fresh = {
      code,
      createdAt: FirestoreDB.now(),
      lastSeenAt: FirestoreDB.now(),
      bingo: emptyBingo(),
      totalScore: 0,
      triviaTotalScore: 0,
      finishLineSeenAt: null,
      easterEgg: { found: false, foundAt: null, minigameHighScore: 0 },
      cursorGlyph: '🏎️',
      // "Fresh account" includes re-triggering onboarding on next login —
      // consistent with everything else this resets.
      onboardingDismissed: false,
    };
    await FirestoreDB.setDoc('users', code, fresh, false); // false = full overwrite, not merge — must actually clear stale fields (PIN included), not just patch over them

    const daysCollection = FirestoreDB.subPath('triviaEntries', code, 'days');
    await Promise.all([
      FirestoreDB.deleteDoc('hyperlinkRaceEntries', code),
      FirestoreDB.deleteDoc('hyperlinkRaceProgress', code),
      FirestoreDB.deleteDoc('snapJudgementEntries', code),
      FirestoreDB.deleteDoc('photoFinishEntries', code),
      FirestoreDB.deleteDoc('nominations', code),
      FirestoreDB.deleteDoc('minigameEntries', code),
      ...TRIVIA_DAY_IDS.map((dayId) => FirestoreDB.deleteDoc(daysCollection, dayId)),
    ]);
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
    getEntry,
    submitTriviaDay,
    hasSubmittedTriviaDay,
    getTriviaDayEntry,
    getTriviaDaysCompleted,
    assignHyperlinkAnswer,
    getHyperlinkAssignment,
    getLeaderboard,
    getCombinedLeaderboard,
    getPhotoFinishEntries,
    getNominations,
    voteForPhoto,
    recordMinigameScore,
    markEasterEggFound,
    markFinishLineSeen,
    setCursorGlyph,
    setOnboardingDismissed,
    resetUserProgress,
    emptyBingo,
  };
})();

window.Store = Store;
