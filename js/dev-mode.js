// ===========================================================================
// Developer Mode — TEMPORARY SCAFFOLDING. Delete this entire file (and its
// <script> tag in index.html, and every call site in js/app.js: search for
// `DevMode`) before the real event ships. Nothing in here is meant to be a
// permanent feature.
//
// Three things live here, all dev-only:
//   1. DEV_MODE — the master on/off switch for the whole panel, as before.
//   2. isDevUser — NEW this round. Even with DEV_MODE on, the panel now
//      only renders for the single short login "MIFN", regardless of PIN
//      or session state. Kept as one small, obvious, greppable function
//      specifically so it's trivial to find and delete alongside the rest
//      of this file later — it is not meant to become a real "admin role"
//      concept, just a way to keep in-progress test tooling off of every
//      other tester's screen while it's still needed.
//   3. The real week-date configuration control — also NEW this round.
//      Distinct from the day-jump preview buttons (which only ever
//      simulate "today" for MIFN's own browser via localStorage): this
//      writes the REAL start/end dates for Customer Service Week to a
//      shared Firestore doc (Store.getWeekConfig/setWeekConfig) that every
//      user's app reads on load and applies via data/schedule.js's
//      applyWeekDates — the actual calendar day-gating, per-activity
//      deadlines, and the post-week lockout are all calculated against,
//      for everyone, not just a preview. Once the event's real dates are
//      fixed for good, delete this control, applyWeekDates, and the
//      appConfig collection entirely — CSW_SCHEDULE's own hardcoded
//      `date` fields become the permanent truth again at that point.
// ===========================================================================
const DevMode = (() => {
  const DEV_MODE = true;

  // TEMPORARY — single hardcoded allowlist of one short login. Deliberately
  // blunt (a plain `===`, not a role table or config flag) so it reads as
  // obviously temporary to whoever finds it later, not as infrastructure
  // worth preserving.
  function isDevUser(user) {
    return !!user && user.code === 'MIFN';
  }

  function ensurePanel() {
    let panel = document.getElementById('devModePanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'devModePanel';
      panel.className = 'dev-mode-panel';
      document.body.appendChild(panel);
    }
    return panel;
  }

  // `user`: the logged-in user, checked against both the DEV_MODE flag and
  // isDevUser above. `callbacks.showHub`/`callbacks.refreshUser`: js/app.js's
  // own functions, passed in rather than reached for directly, so this
  // module never needs access to App's private closure state — call sites
  // that change what the hub should show (a day jump, a week-date save, a
  // reset) call back into app.js through these instead of re-implementing
  // any of that here.
  function render(user, { showHub, refreshUser }) {
    if (!DEV_MODE || !isDevUser(user)) {
      document.getElementById('devModePanel')?.remove();
      return;
    }

    const panel = ensurePanel();
    const currentOverride = localStorage.getItem('csw2026_preview_date') || '';
    const dayBtns = CSW_SCHEDULE.map((d) =>
      `<button data-date="${d.date}" class="${d.date === currentOverride ? 'is-active' : ''}">${d.label.slice(0, 3)}</button>`
    ).join('');
    // One more jump: the day after the week's hard end date, so the global
    // view-only lockout (see data/schedule.js's isWeekLocked) is actually
    // reachable for testing, the same way the day buttons make each
    // individual unlock reachable.
    const postWeekDate = addDaysToDateString(CSW_WEEK_END_DATE, 1);
    panel.innerHTML = `
      <span class="dev-mode-panel__label">🛠️ Developer Mode</span>
      ${dayBtns}
      <button data-date="${postWeekDate}" class="${postWeekDate === currentOverride ? 'is-active' : ''}">Post-Week</button>
      <button data-date="">Real</button>
      <button class="dev-mode-panel__reset" id="devResetBtn" title="Wipes YOUR OWN test data — submissions, scores, PIN, mini-game progress — back to a brand new account">⚠ Reset</button>
      <div class="dev-mode-panel__week-config">
        <span class="dev-mode-panel__week-config-label">📅 Real week dates (applies to everyone)</span>
        <label>Start <input type="date" id="devWeekStart" value="${CSW_SCHEDULE[0].date}" /></label>
        <label>End <input type="date" id="devWeekEnd" value="${CSW_WEEK_END_DATE}" /></label>
        <button id="devWeekSave">Save</button>
      </div>
    `;

    // Day-jump preview buttons — simulate "today" for MIFN's own browser
    // only (localStorage, per-device). Unrelated to the real week-date
    // config below, which is global.
    panel.querySelectorAll('button[data-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.date) localStorage.setItem('csw2026_preview_date', btn.dataset.date);
        else localStorage.removeItem('csw2026_preview_date');
        showHub();
      });
    });

    // Destructive, so it's gated behind a real confirm() rather than firing
    // on a single accidental click — see Store.resetUserProgress's own
    // comment for exactly what this does and doesn't touch (this user's own
    // documents only, never another tester's).
    panel.querySelector('#devResetBtn').addEventListener('click', async () => {
      const confirmed = confirm(
        `Reset all test data for "${user.code}"?\n\n` +
        `This wipes YOUR OWN submissions, scores, PIN, mini-game progress, and the secret leaderboard unlock — back to a brand new account. This cannot be undone.`
      );
      if (!confirmed) return;
      await Store.resetUserProgress(user.code);
      await refreshUser();
      showHub();
      Toast.show('🔄 Your test data has been reset.', 'success');
    });

    // TEMPORARY — see this file's header. Sets the REAL, global week start/
    // end dates: applyWeekDates (data/schedule.js) mutates CSW_SCHEDULE's
    // own `date` fields in place, so day-gating/deadlines/isWeekLocked
    // everywhere pick it up immediately for this browser; Store.
    // setWeekConfig persists it to the shared appConfig doc so every other
    // user's app applies the same dates on their own next load.
    panel.querySelector('#devWeekSave').addEventListener('click', async (e) => {
      const weekStart = panel.querySelector('#devWeekStart').value;
      const weekEnd = panel.querySelector('#devWeekEnd').value;
      if (!weekStart || !weekEnd || weekEnd < weekStart) {
        Toast.show('⚠️ Pick a valid start and end date (end on or after start).', 'error');
        return;
      }
      e.target.disabled = true;
      e.target.textContent = 'Saving…';
      try {
        await Store.setWeekConfig(weekStart, weekEnd);
        applyWeekDates(weekStart, weekEnd);
        showHub();
        Toast.show('📅 Real week dates updated — this now applies for everyone.', 'success');
      } catch (err) {
        console.error(err);
        Toast.show('⚠️ Could not save — appConfig may not be deployed yet in firestore.rules.', 'error');
        e.target.disabled = false;
        e.target.textContent = 'Save';
      }
    });
  }

  return { DEV_MODE, isDevUser, render };
})();

window.DevMode = DevMode;
