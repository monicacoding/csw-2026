// ---------------------------------------------------------------------------
// Derives dashboard/bingo view-state from a user record + the static
// schedule. Pure functions — no Firestore calls here.
// ---------------------------------------------------------------------------

const AppState = (() => {
  // Per-activity state: 'locked' | 'active' | 'done' | 'expired'.
  //
  // Most activities are only "active" on their own scheduled day (their
  // implicit closesAfter === day.date, i.e. their deadline is end of that
  // day). An activity can opt into a longer open window via `closesAfter`
  // on its schedule entry — it's "active" for every day from its unlock
  // date through closesAfter, and only "expired" once that whole window has
  // passed without a submission (no late submissions past a deadline).
  //
  // `weekLocked` (the hard end-of-week global switch — see
  // data/schedule.js's isWeekLocked) is checked before any of that: once
  // the week has ended, every not-yet-completed activity is "expired"
  // regardless of its own individual unlock/deadline — a global override,
  // not just another deadline. A completed activity is always "done"
  // first, even past its deadline or past week-end — completed work stays
  // viewable indefinitely (see js/app.js's activityClickPolicy).
  function activityTileState(activity, submitted, day, todayStr, weekLocked = false) {
    if (submitted) return 'done';
    if (weekLocked) return 'expired';
    const closesAfter = activity.closesAfter || day.date;
    if (todayStr < day.date) return 'locked';
    if (todayStr <= closesAfter) return 'active';
    return 'expired'; // its whole open window has passed, never submitted
  }

  // A day can now carry more than one remote activity (Race Day Trivia
  // alongside that day's other activity, most days) — this returns, per
  // day, the *remote* activities (on-site ones like Victory Lap Party have
  // no submission state to track, so they're not part of this) each with
  // their own individual tileState, plus a day-level aggregate `tileState`
  // for the timeline marker: 'done' only once every remote activity that
  // day is done, otherwise whatever the least-finished state present is
  // (locked/missed take priority over active, active over done) — in
  // practice every activity on a given day shares the same locked/active/
  // missed window since none of them carry a custom `closesAfter` anymore,
  // so this mainly just decides "done" vs "not yet."
  function computeDashboardDays(user, todayStr = todayLocalDateString()) {
    const weekLocked = isWeekLocked(todayStr);
    const bingo = { ...Store.emptyBingo(), ...(user?.bingo || {}) };
    return CSW_SCHEDULE.map((day) => {
      const remoteActivities = day.activities.filter((a) => a.type !== 'onsite');
      const activityStates = remoteActivities.map((activity) => {
        const submitted = !!bingo[activity.id];
        return { activity, submitted, tileState: activityTileState(activity, submitted, day, todayStr, weekLocked) };
      });

      let tileState;
      if (activityStates.every((s) => s.tileState === 'done')) tileState = 'done';
      else if (activityStates.some((s) => s.tileState === 'locked')) tileState = 'locked';
      else if (activityStates.some((s) => s.tileState === 'active')) tileState = 'active';
      else tileState = 'expired';

      const status = dayStatus(day, todayStr); // locked | active | past — the raw calendar-day status
      return { day, activityStates, status, tileState, weekLocked };
    });
  }

  // Progress used for the mascot's "X down, Y to go" — count of the 5
  // *activity-type* bingo squares checked off (BINGO_KEYS), not calendar
  // days and not individual trivia-day submissions.
  function completedDayCount(user) {
    const bingo = { ...Store.emptyBingo(), ...(user?.bingo || {}) };
    return BINGO_KEYS.filter((k) => bingo[k]).length;
  }

  function bingoCoreComplete(user) {
    const bingo = { ...Store.emptyBingo(), ...(user?.bingo || {}) };
    return BINGO_KEYS.every((k) => bingo[k]);
  }

  function bingoFullHouse(user) {
    const bingo = { ...Store.emptyBingo(), ...(user?.bingo || {}) };
    return bingoCoreComplete(user) && !!bingo.bonus;
  }

  return { computeDashboardDays, completedDayCount, bingoCoreComplete, bingoFullHouse, activityTileState };
})();

window.AppState = AppState;
