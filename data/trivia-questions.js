// ---------------------------------------------------------------------------
// PLACEHOLDER question bank — replace with the real "Race Day Trivia"
// questions from your attached question bank. Each question:
//   { q: 'text', choices: ['A','B','C','D'], correctIndex: 0-3 }
// ---------------------------------------------------------------------------

const TRIVIA_QUESTIONS = [
  {
    q: "What is this year's Customer Service Week campaign theme?",
    choices: ['We Go the Extra Mile', 'Above and Beyond', 'Service Superstars', 'Team Spirit Week'],
    correctIndex: 0,
  },
  {
    q: 'Which pillar does the ⭐ star icon represent?',
    choices: ['AI', 'Connection', 'Recognition', 'CARES'],
    correctIndex: 2,
  },
  {
    q: 'Which pillar does the 💎 diamond icon represent?',
    choices: ['Connection', 'Recognition', 'CARES', 'AI'],
    correctIndex: 0,
  },
  {
    q: 'On the mile-marker dashboard, what happens when you complete a day\'s activity?',
    choices: ['Nothing changes', 'The mascot moves further along the track', 'You get logged out', 'The page turns red'],
    correctIndex: 1,
  },
  {
    q: 'How many squares make up the core Bingo Card (not counting the bonus)?',
    choices: ['4', '5', '6', '3'],
    correctIndex: 1,
  },
  {
    q: "What unlocks the Bingo Card's bonus square?",
    choices: ['Logging in 5 times', 'Winning the trivia', 'Completing the other 5 squares', 'Nothing — it\'s always open'],
    correctIndex: 2,
  },
  {
    q: 'What day does the Victory Lap Party celebrate?',
    choices: ['Monday', 'Wednesday', 'Friday', 'Sunday'],
    correctIndex: 2,
  },
  {
    q: 'What do you need to log in to the Extra Mile Hub?',
    choices: ['Your email and password', 'A 4-letter code', 'Your employee ID number', 'A QR code'],
    correctIndex: 1,
  },
];

if (typeof window !== 'undefined') {
  window.TRIVIA_QUESTIONS = TRIVIA_QUESTIONS;
}
