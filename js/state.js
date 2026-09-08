// ---------------------------------------------------------------------------
// Derives dashboard/bingo view-state from a user record + the static
// schedule. Pure functions — no Firestore calls here.
// ---------------------------------------------------------------------------

const AppState = (() => {
  // Per-activity state: 'locked' | 'active' | 'done' | 'missed'.
  //
  // Most activities are only "active" on their own scheduled day (their
  // implicit closesAfter === day.date). An activity can opt into a longer
  // open window via `closesAfter` on its schedule entry — it's "active" for
  // every day from its unlock date through closesAfter, and only "missed"
  // once that whole window has passed without a submission.
  function activityTileState(activity, submitted, day, todayStr) {
    const closesAfter = activity.closesAfter || day.date;
    if (todayStr < day.date) return 'locked';
    if (submitted) return 'done';
    if (todayStr <= closesAfter) return 'active';
    return 'missed'; // its whole open window has passed, never submitted
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
    const bingo = { ...Store.emptyBingo(), ...(user?.bingo || {}) };
    return CSW_SCHEDULE.map((day) => {
      const remoteActivities = day.activities.filter((a) => a.type !== 'onsite');
      const activityStates = remoteActivities.map((activity) => {
        const submitted = !!bingo[activity.id];
        return { activity, submitted, tileState: activityTileState(activity, submitted, day, todayStr) };
      });

      let tileState;
      if (activityStates.every((s) => s.tileState === 'done')) tileState = 'done';
      else if (activityStates.some((s) => s.tileState === 'locked')) tileState = 'locked';
      else if (activityStates.some((s) => s.tileState === 'active')) tileState = 'active';
      else tileState = 'missed';

      const status = dayStatus(day, todayStr); // locked | active | past — the raw calendar-day status
      return { day, activityStates, status, tileState };
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

  return { computeDashboardDays, completedDayCount, bingoCoreComplete, bingoFullHouse };
})();

window.AppState = AppState;
