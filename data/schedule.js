// Customer Service Week 2026 — "We Go the Extra Mile"
// Single source of truth for the Mon–Fri unlock schedule. Game modal headers
// (js/games.js) read `label`/`theme` from here rather than hardcoding their
// own copy, so this file is the only place day/theme text needs to change.
// Dates are local-time midnight; an activity unlocks at 00:00 on its date.
//
// Each day's `activities` array holds every activity happening that day, not
// just the portal one — the timeline's hover popover (js/app.js) lists all
// of them, tagged by `type`. By convention `activities[0]` is always the
// portal/remote activity (the one with an `id`, tracked via bingo/hasSubmitted
// and opened as a modal) — every other entry is purely informational (no
// `id`, nothing to submit) and just needs `title` + `type`.
//   type: 'remote' — lives in the app (the 5 portal activities)
//   type: 'onsite' — happens in person, not tracked by the app at all
// Add an activity to either list and it shows up in the popover for free —
// nothing else to wire up.
const CSW_SCHEDULE = [
  {
    id: 'mon',
    label: 'Monday',
    date: '2026-10-05',
    theme: 'On Your Marks',
    pillarIcon: 'flag',
    // Open the entire week, not just Monday — see isActivityUnlocked/
    // computeDashboardDays, which special-case `openAllWeek`. `closesAfter`
    // is the last day it's still considered "on time" (not yet "missed").
    activities: [
      { id: 'nomination', title: 'Who Went The Extra Mile?', type: 'remote', openAllWeek: true, closesAfter: '2026-10-09' },
    ],
  },
  {
    id: 'tue',
    label: 'Tuesday',
    date: '2026-10-06',
    theme: 'Picking Up The Pace',
    pillarIcon: 'bolt',
    activities: [
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
      { id: 'trivia', title: 'Race Day Trivia', type: 'remote' },
      { title: 'Victory Lap Party', type: 'onsite' },
      { title: 'Cake', type: 'onsite' },
    ],
  },
];

// The 6th bingo square — unlocks once the other 5 are complete.
const BONUS_SQUARE = { id: 'bonus', title: 'Bonus: Full House' };

// All five scored/tracked bingo keys, in card order.
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
}
