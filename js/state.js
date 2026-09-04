// ---------------------------------------------------------------------------
// Derives dashboard/bingo view-state from a user record + the static
// schedule. Pure functions — no Firestore calls here.
// ---------------------------------------------------------------------------

const AppState = (() => {
  // tile.state: 'locked' | 'active' | 'done' | 'missed'
  //
  // Most activities are only "active" on their own scheduled day (their
  // implicit closesAfter === day.date). An activity can opt into a longer
  // open window via `closesAfter` on its schedule entry (e.g. the Monday
  // nomination stays open through Friday) — it's "active" for every day
  // from its unlock date through closesAfter, and only "missed" once that
  // whole window has passed without a submission.
  function computeDashboardDays(user, todayStr = todayLocalDateString()) {
    const bingo = { ...Store.emptyBingo(), ...(user?.bingo || {}) };
    return CSW_SCHEDULE.map((day) => {
      const activity = day.activities[0];
      const submitted = !!bingo[activity.id];
      const closesAfter = activity.closesAfter || day.date;

      let tileState;
      if (todayStr < day.date) tileState = 'locked';
      else if (submitted) tileState = 'done';
      else if (todayStr <= closesAfter) tileState = 'active';
      else tileState = 'missed'; // its whole open window has passed, never submitted

      const status = dayStatus(day, todayStr); // locked | active | past — the raw calendar-day status
      return { day, activity, status, tileState, submitted };
    });
  }

  // Progress used to position the mascot along the track: number of days
  // whose activity has been completed (0-5).
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
