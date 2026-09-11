// Customer Service Week 2026 — "We Go the Extra Mile"
// Single source of truth for the Mon–Fri unlock schedule. Game modal headers
// (js/games.js) read `label`/`theme` from here rather than hardcoding their
// own copy, so this file is the only place day/theme text needs to change.
// Dates are local-time midnight; an activity unlocks at 00:00 on its date.
//
// Each day's `activities` array holds every activity happening that day —
// the timeline's hover popover (js/app.js) and the activity board both
// derive from it, so adding an activity here (remote or on-site) reflects
// everywhere automatically, no separate list to maintain.
//   type: 'remote' — lives in the app, opens as a modal, has a stable `id`
//   type: 'onsite' — happens in person, not tracked by the app, no `id`
//     (informational only — shown in the hover popover, not the board)
// Race Day Trivia now runs every day (a new 5-question set each day — see
// data/trivia-questions.js's TRIVIA_BY_DAY, keyed by this file's day `id`s),
// so it appears on all five days alongside that day's other activity, if
// any. Each day's trivia set has its own `id` (`triviaMon`, `triviaTue`,
// etc.) so it locks/unlocks/tracks exactly like any other single-day
// activity — see js/store.js's submitTriviaDay for how its score
// accumulates across days while still using the single shared "trivia"
// bingo square (only checked off once all 5 days are done).
const CSW_SCHEDULE = [
  {
    id: 'mon',
    label: 'Monday',
    date: '2026-10-05',
    theme: 'On Your Marks',
    pillarIcon: 'flag',
    activities: [
      { id: 'triviaMon', title: 'Race Day Trivia', type: 'remote' },
    ],
  },
  {
    id: 'tue',
    label: 'Tuesday',
    date: '2026-10-06',
    theme: 'Picking Up The Pace',
    pillarIcon: 'bolt',
    activities: [
      { id: 'triviaTue', title: 'Race Day Trivia', type: 'remote' },
      { id: 'hyperlinkRace', title: 'Hyperlink Race', type: 'remote' },
    ],
  },
  {
    id: 'wed',
    label: 'Wednesday',
    date: '2026-10-07',
    theme: 'The Halfway Mile',
    pillarIcon: 'star',
    activities: [
      { id: 'triviaWed', title: 'Race Day Trivia', type: 'remote' },
      { id: 'photoFinish', title: 'Photo Finish', type: 'remote' },
    ],
  },
  {
    id: 'thu',
    label: 'Thursday',
    date: '2026-10-08',
    theme: 'The Final Stretch',
    pillarIcon: 'sparkle',
    activities: [
      { id: 'triviaThu', title: 'Race Day Trivia', type: 'remote' },
      { id: 'snapJudgement', title: 'Snap Judgement', type: 'remote' },
    ],
  },
  {
    id: 'fri',
    label: 'Friday',
    date: '2026-10-09',
    theme: 'Crossing the Finish Line',
    pillarIcon: 'checkerbit',
    activities: [
      { id: 'triviaFri', title: 'Race Day Trivia', type: 'remote' },
      // Moved here from Monday — day-gated to Friday like every other
      // activity now, not open all week. (That's a judgment call, not
      // an explicit instruction — flagged in the handoff notes; flip
      // `openAllWeek: true` + `closesAfter: '2026-10-09'` back on here
      // to restore the old open-all-week behavior if preferred.)
      { id: 'nomination', title: 'Who Went The Extra Mile?', type: 'remote' },
      { title: 'Victory Lap Party', type: 'onsite' },
      { title: 'Cake', type: 'onsite' },
    ],
  },
];

// The 6th bingo square — unlocks once the other 5 are complete.
const BONUS_SQUARE = { id: 'bonus', title: 'Bonus: Full House' };

// The five *tracked activity types* (not five calendar days, and not five
// per-day trivia sets) — one bingo square each. Race Day Trivia's square is
// a single aggregate: js/store.js only checks it off once all 5 daily
// trivia sets (triviaMon..triviaFri, tracked separately — see
// Store.submitTriviaDay) are done, the same way this list always meant
// "one square per activity type," not "one square per calendar day."
const BINGO_KEYS = ['nomination', 'hyperlinkRace', 'photoFinish', 'snapJudgement', 'trivia'];

// While we're previewing (mock data, no real calendar-gated audience yet),
// a "jump to day" control can override what "today" means so every activity
// is reachable for testing. See the player badge in js/app.js.
function todayLocalDateString() {
  const override = localStorage.getItem('csw2026_preview_date');
  if (override) return override;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// status: 'locked' | 'active' | 'past'
function dayStatus(day, todayStr = todayLocalDateString()) {
  if (todayStr < day.date) return 'locked';
  if (todayStr === day.date) return 'active';
  return 'past';
}

// Hard end of Customer Service Week — end of the last scheduled day (Friday).
// Once "today" (real or previewed) is past this date, the whole app goes
// view-only: no activity — including the secret mini-game, even for someone
// who's never found it — can be started or played, regardless of its own
// individual unlock/deadline. This is a single global switch that overrides
// all per-activity day-gating (js/state.js's activityTileState checks it
// first, before any per-activity locked/active/expired logic). Derived from
// the schedule itself (the last day's date) rather than hardcoded a second
// time, so adding/removing a day here keeps it correct automatically.
//
// `let`, not `const` — see applyWeekDates below (TEMPORARY, js/dev-mode.js)
// for why this needs to be reassignable, not frozen at load time.
let CSW_WEEK_END_DATE = CSW_SCHEDULE[CSW_SCHEDULE.length - 1].date;

function isWeekLocked(todayStr = todayLocalDateString()) {
  return todayStr > CSW_WEEK_END_DATE;
}

// ---------------------------------------------------------------------------
// TEMPORARY SCAFFOLDING — real week-date configuration, driven by Developer
// Mode (js/dev-mode.js, MIFN-only). Delete this function, its `appConfig`
// Firestore doc (js/store.js's getWeekConfig/setWeekConfig), and the call
// sites in js/app.js/js/dev-mode.js entirely once the real event's dates
// are fixed for good — at that point CSW_SCHEDULE's own literal `date`
// fields above are simply the permanent schedule again, exactly as they
// were before this existed.
//
// Reassigns every CSW_SCHEDULE day's own `date` field IN PLACE (mutating
// the existing array/objects rather than replacing them, since everything
// else in the app — js/state.js's activityTileState, js/app.js's track/
// activity-board rendering, findActivityDay, etc. — holds a reference to
// this exact array) and recomputes CSW_WEEK_END_DATE to match. Every place
// that already reads CSW_SCHEDULE/CSW_WEEK_END_DATE — day-gating,
// per-activity deadlines (js/state.js: closesAfter || day.date), and
// isWeekLocked's post-week check — picks up the new dates automatically,
// with no separate update path needed for any of them.
//
// `weekStart` becomes the first day's (Monday's) date exactly; `weekEnd`
// becomes the last day's (Friday's) date exactly. The 3 middle days are
// spaced proportionally across whatever span that leaves — in the normal
// case (weekEnd exactly 4 days after weekStart, a standard Monday–Friday
// week) that's just 1/2/3 days after weekStart, same as the hardcoded
// defaults; a different span stretches or compresses them evenly rather
// than assuming exactly 4 days apart.
function applyWeekDates(weekStart, weekEnd) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);
  const totalDays = Math.round((end - start) / 86400000);
  const lastIndex = CSW_SCHEDULE.length - 1;
  CSW_SCHEDULE.forEach((day, i) => {
    const offset = lastIndex === 0 ? 0 : Math.round((i * totalDays) / lastIndex);
    day.date = addDaysToDateString(weekStart, offset);
  });
  CSW_WEEK_END_DATE = CSW_SCHEDULE[lastIndex].date;
  // `window.CSW_WEEK_END_DATE` is a one-time snapshot copy (see the bottom
  // of this file) — reassigning the local `let` above doesn't update it on
  // its own, and js/app.js's dev panel reads the global directly.
  if (typeof window !== 'undefined') window.CSW_WEEK_END_DATE = CSW_WEEK_END_DATE;
}

// '2026-10-09' + 1 -> '2026-10-10'. Local-time date arithmetic (no UTC
// surprises), used by the preview strip to offer a one-click "day after the
// week ends" jump so the view-only lockout is actually testable, the same
// way the existing day buttons let you preview each day's unlock.
function addDaysToDateString(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function findActivityDay(activityId) {
  return CSW_SCHEDULE.find((d) => d.activities.some((a) => a.id === activityId));
}

function findActivity(activityId) {
  const day = findActivityDay(activityId);
  return day ? day.activities.find((a) => a.id === activityId) : null;
}

function isActivityUnlocked(activityId, todayStr = todayLocalDateString()) {
  const day = findActivityDay(activityId);
  if (!day) return false;
  return todayStr >= day.date;
}

// '2026-10-05' -> '05/10' (day/month), for the small date label on the track.
function formatShortDate(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

if (typeof window !== 'undefined') {
  window.CSW_SCHEDULE = CSW_SCHEDULE;
  window.BONUS_SQUARE = BONUS_SQUARE;
  window.BINGO_KEYS = BINGO_KEYS;
  window.todayLocalDateString = todayLocalDateString;
  window.dayStatus = dayStatus;
  window.findActivityDay = findActivityDay;
  window.findActivity = findActivity;
  window.isActivityUnlocked = isActivityUnlocked;
  window.formatShortDate = formatShortDate;
  window.CSW_WEEK_END_DATE = CSW_WEEK_END_DATE;
  window.isWeekLocked = isWeekLocked;
  window.addDaysToDateString = addDaysToDateString;
  window.applyWeekDates = applyWeekDates; // TEMPORARY — see that function's own header comment
}
