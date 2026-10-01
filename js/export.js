// ===========================================================================
// Results export — "Download Results" in Developer Mode (MIFN-only, see
// js/dev-mode.js's devExportBtn). Builds a single multi-tab .xlsx file
// entirely client-side via SheetJS (window.XLSX, loaded from a CDN — see
// index.html — no backend involved) and triggers a normal browser download.
//
// One tab per game, every submission (not just non-deleted ones — see each
// tab builder's own `Deleted` column), plus one Overall Leaderboard tab.
// Nothing here mutates data — this only ever reads.
// ===========================================================================
const ResultsExport = (() => {
  const yesNo = (v) => (v ? 'Yes' : 'No');
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : '');

  // Needs firestore.rules' collectionGroup('days') rule actually deployed
  // (Firebase Console → Firestore → Rules) — see that file's own comment on
  // the `match /{path=**}/days/{dayId}` block for why a collectionGroup
  // query needs a rule of its own, separate from the per-user nested one.
  // If that hasn't happened yet, this tab fails on its own without taking
  // the rest of the export down with it — see download()'s per-tab catch.
  async function buildTriviaRows() {
    const rows = await Store.getAllTriviaEntries();
    return rows
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || (a.dayId || '').localeCompare(b.dayId || ''))
      .map((r) => ({
        'Short Login': r.code || '',
        'Day': r.dayId || '',
        'Score': r.score ?? '',
        'Correct': r.correctCount ?? '',
        'Total Questions': r.totalQuestions ?? '',
        'Submitted At': fmtTime(r.submittedAt),
        // Race Day Trivia has no soft-delete concept (only Photo Finish and
        // Who Went The Extra Mile do — see js/admin-panel.js) — always "No",
        // included anyway so every tab carries the same column set.
        'Deleted': 'No',
      }));
  }

  async function buildHyperlinkRaceRows() {
    const rows = await FirestoreDB.listCollection('hyperlinkRaceEntries');
    return rows
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
      .map((r) => ({
        'Short Login': r.code || '',
        'Score': r.score ?? '',
        'Elapsed (seconds)': r.elapsedMs != null ? Math.round(r.elapsedMs / 1000) : '',
        'Word Correct': yesNo(r.wordCorrect),
        'Submitted At': fmtTime(r.submittedAt),
        'Deleted': 'No',
      }));
  }

  async function buildSnapJudgementRows() {
    const rows = await FirestoreDB.listCollection('snapJudgementEntries');
    return rows
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
      .map((r) => ({
        'Short Login': r.code || '',
        'Score': r.score ?? '',
        'Correct': r.correctCount ?? '',
        'Total Rounds': r.totalRounds ?? '',
        'Submitted At': fmtTime(r.submittedAt),
        'Deleted': 'No',
      }));
  }

  async function buildPhotoFinishRows() {
    const rows = await Store.getPhotoFinishEntries({ includeDeleted: true });
    return rows.map((r) => ({
      'Short Login': r.code || '',
      'Caption': r.caption || '',
      'Template ID': r.templateId || '',
      'Votes': r.votes || 0,
      'Submitted At': fmtTime(r.submittedAt),
      'Deleted': yesNo(r.deleted),
    }));
  }

  async function buildNominationRows() {
    const rows = await Store.getNominations({ includeDeleted: true });
    return rows.map((r) => ({
      'Short Login (Nominator)': r.code || '',
      'Nominee Name': r.nomineeName || '',
      'Emoji': r.emoji || '',
      'Reason': r.reason || '',
      'Submitted At': fmtTime(r.submittedAt),
      'Deleted': yesNo(r.deleted),
    }));
  }

  async function buildMinigameRows() {
    const rows = await FirestoreDB.listCollection('minigameEntries');
    return rows
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((r) => ({
        'Short Login': r.code || '',
        'Score': r.score ?? '',
        'Played At': fmtTime(r.playedAt),
        'Deleted': 'No',
      }));
  }

  // Bingo Card is the aggregate tracker, not its own submissions collection
  // — this tab is a snapshot of every user's `bingo` field (which of the 5
  // core squares + the bonus square they've checked off), not a list of raw
  // entries like every other tab.
  function buildBingoRows(users) {
    return users.map((u) => {
      const bingo = { ...Store.emptyBingo(), ...(u.bingo || {}) };
      return {
        'Short Login': u.id || u.code || '',
        "Who Went The Extra Mile?": yesNo(bingo.nomination),
        'Hyperlink Race': yesNo(bingo.hyperlinkRace),
        'Photo Finish': yesNo(bingo.photoFinish),
        'Snap Judgement': yesNo(bingo.snapJudgement),
        'Race Day Trivia': yesNo(bingo.trivia),
        'Bonus Square': yesNo(bingo.bonus),
      };
    });
  }

  // Same combined ranking the in-app Leaderboard shows (Store.
  // getCombinedLeaderboard) — users.totalScore never includes the secret
  // mini-game's score (see Store.recordMinigameScore's own comment), so
  // this is already "excluding the secret mini-game" with no extra filtering
  // needed here.
  function buildOverallLeaderboardRows(users) {
    const sorted = [...users].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    return sorted.map((u, i) => ({
      'Rank': i + 1,
      'Short Login': u.id || u.code || '',
      'Total Score': u.totalScore || 0,
    }));
  }

  async function download() {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) failed to load — check your connection and try again.');
    }

    // Each tab's own read is isolated — one collection's permission error
    // (most likely Race Day Trivia's collectionGroup query, if firestore.
    // rules' matching rule hasn't been deployed yet — see buildTriviaRows'
    // own comment) shouldn't take every other tab down with it. A failed
    // tab gets a single explanatory row instead of real data.
    const safe = async (label, buildFn) => {
      try {
        return await buildFn();
      } catch (err) {
        console.error(`Results export — could not build the "${label}" tab`, err);
        return [{ 'Error': `Could not load this tab — ${err.message || err}` }];
      }
    };

    const [trivia, hyperlinkRace, snapJudgement, photoFinish, nomination, minigame, users] = await Promise.all([
      safe('Race Day Trivia', buildTriviaRows),
      safe('Hyperlink Race', buildHyperlinkRaceRows),
      safe('Snap Judgement', buildSnapJudgementRows),
      safe('Photo Finish', buildPhotoFinishRows),
      safe('Who Went The Extra Mile', buildNominationRows),
      safe('Secret Mini-Game', buildMinigameRows),
      FirestoreDB.listCollection('users'),
    ]);

    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No data yet': '' }]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    addSheet('Race Day Trivia', trivia);
    addSheet('Hyperlink Race', hyperlinkRace);
    addSheet('Photo Finish', photoFinish);
    addSheet('Snap Judgement', snapJudgement);
    addSheet('Who Went The Extra Mile', nomination);
    addSheet('Bingo Card', buildBingoRows(users));
    addSheet('Secret Mini-Game', minigame);
    addSheet('Overall Leaderboard', buildOverallLeaderboardRows(users));

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `extra-mile-hub-results-${dateStr}.xlsx`);
  }

  return { download };
})();

window.ResultsExport = ResultsExport;
