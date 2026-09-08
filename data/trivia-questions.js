// ---------------------------------------------------------------------------
// Race Day Trivia — daily question sets. Race Day Trivia now runs every day
// (Monday–Friday), 5 new questions per day, keyed by the same day id
// data/schedule.js uses ('mon'/'tue'/'wed'/'thu'/'fri') so js/games.js can
// just do `TRIVIA_BY_DAY[day.id]` — no separate mapping to keep in sync.
//
// Each question: { pillar, q, choices: [4 strings, in on-screen A/B/C/D
// order], correctIndex }. To swap a day's set later, replace that day's
// array wholesale — nothing else needs to change.
// ---------------------------------------------------------------------------

const TRIVIA_BY_DAY = {
  mon: [
    {
      pillar: 'AI',
      q: 'Which change usually makes an AI prompt more useful?',
      choices: [
        'Removing all context',
        'Adding a clear goal, relevant context, and desired output',
        'Using more technical jargon',
        'Combining several unrelated requests',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'CARES',
      q: 'Which CARES behavior focuses on understanding the context before deciding how to act?',
      choices: ['Communicate Effectively', 'Take Accountability', 'Assess the Situation', 'Exercise Empathy'],
      correctIndex: 2,
    },
    {
      pillar: 'Recognition',
      q: 'Which type of recognition is generally the most meaningful?',
      choices: [
        'Vague recognition delivered months later',
        'Timely, specific recognition connected to impact',
        'Recognition given only by senior leaders',
        'Recognition without explaining what the person did',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'General Knowledge',
      q: 'What does an HTTP 404 status generally indicate?',
      choices: [
        'The server is permanently offline',
        'The requested page or resource was not found',
        'The user entered the correct password',
        'The website loaded successfully',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'Microsoft Trivia',
      q: 'In what year was Microsoft founded?',
      choices: ['1975', '1980', '1971', '1985'],
      correctIndex: 0,
    },
  ],

  tue: [
    {
      pillar: 'AI',
      q: 'An AI response includes a confident factual claim without a source. What should you do next?',
      choices: ['Share it immediately', 'Verify it using trusted sources', 'Assume confidence means accuracy', 'Ask the AI to make it longer'],
      correctIndex: 1,
    },
    {
      pillar: 'CARES',
      q: 'You receive an escalation with incomplete details. What is the best first step?',
      choices: [
        'Assign blame immediately',
        'Ask clarifying questions and assess the situation',
        'Close the case because information is missing',
        'Forward it to a large distribution list',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'Recognition',
      q: 'Which recognition message is strongest?',
      choices: [
        '"Great job!"',
        '"Thank you for taking ownership of the escalation and keeping the customer informed throughout."',
        '"You are the best person on the team."',
        '"Nice work on that thing."',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'General Knowledge',
      q: 'How many bits are in one byte?',
      choices: ['4', '8', '16', '32'],
      correctIndex: 1,
    },
    {
      pillar: 'Microsoft Trivia',
      q: 'Who co-founded Microsoft alongside Bill Gates?',
      choices: ['Steve Jobs', 'Paul Allen', 'Steve Ballmer', 'Satya Nadella'],
      correctIndex: 1,
    },
  ],

  wed: [
    {
      pillar: 'AI',
      q: 'In generative AI, what is a "hallucination"?',
      choices: ['A slow response', 'Incorrect or fabricated information presented as fact', 'A translated response', 'An encrypted response'],
      correctIndex: 1,
    },
    {
      pillar: 'CARES',
      q: 'You made an incorrect assumption that affected a customer. Which response best demonstrates Take Accountability?',
      choices: [
        'Avoid mentioning the mistake',
        'Acknowledge it, correct it, and explain the next steps',
        'Blame the tool that provided the information',
        'Wait to see whether the customer notices',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'Recognition',
      q: 'How does peer recognition most directly help a team?',
      choices: [
        'It removes the need for feedback',
        'It reinforces valued behaviors and strengthens connection',
        'It guarantees promotions',
        'It eliminates difficult work',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'General Knowledge',
      q: 'Which chemical element uses the symbol "Au"?',
      choices: ['Silver', 'Copper', 'Gold', 'Aluminum'],
      correctIndex: 2,
    },
    {
      pillar: 'Microsoft Trivia',
      q: "What was the name of Microsoft's first operating system, released in 1981?",
      choices: ['Windows 1.0', 'MS-DOS', 'Windows 95', 'OS/2'],
      correctIndex: 1,
    },
  ],

  thu: [
    {
      pillar: 'AI',
      q: 'Which prompt element is most useful for controlling how an AI response is organized?',
      choices: ['Specifying the desired format', 'Writing entirely in capital letters', 'Omitting the intended audience', 'Adding several exclamation marks'],
      correctIndex: 0,
    },
    {
      pillar: 'CARES',
      q: 'An engineer cannot find a standard solution, so they safely test alternatives and collaborate with others. Which CARES behavior does this best demonstrate?',
      choices: ['Be Resourceful', 'Exercise Empathy', 'Communicate Effectively', 'Assess the Situation'],
      correctIndex: 0,
    },
    {
      pillar: 'Recognition',
      q: 'A teammate made an important behind-the-scenes contribution. What is the best recognition approach?',
      choices: [
        'Recognize only the person who presented the final result',
        'Name the contribution and explain the impact it created',
        'Wait until the annual review',
        'Thank them without mentioning what they did',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'General Knowledge',
      q: 'Which is the largest ocean on Earth?',
      choices: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'],
      correctIndex: 3,
    },
    {
      pillar: 'Microsoft Trivia',
      q: "Where is Microsoft's global headquarters located?",
      choices: ['Seattle, Washington', 'San Jose, California', 'Redmond, Washington', 'Austin, Texas'],
      correctIndex: 2,
    },
  ],

  fri: [
    {
      pillar: 'AI',
      q: 'Before using customer information with AI, what is the best practice?',
      choices: [
        'Paste everything into any available tool',
        'Use approved tools, follow data-handling policies, and include only necessary information',
        'Share the output publicly for review',
        'Assume all AI tools handle data the same way',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'AI',
      q: 'Why does human judgment remain essential when working with AI?',
      choices: ['AI can only work offline', 'Outputs still require validation, context, and accountability', 'AI cannot create written content', 'AI always refuses complex tasks'],
      correctIndex: 1,
    },
    {
      pillar: 'CARES',
      q: 'A frustrated customer repeats the same concern. Which response best combines empathy and effective communication?',
      choices: [
        'Interrupt and provide the quickest answer',
        'Acknowledge the concern, restate it, and explain the next step',
        'Send a generic article without context',
        'Transfer the customer without a handoff',
      ],
      correctIndex: 1,
    },
    {
      pillar: 'General Knowledge',
      q: 'Which mammal is capable of true sustained flight?',
      choices: ['Flying squirrel', 'Bat', 'Sugar glider', 'Colugo'],
      correctIndex: 1,
    },
    {
      pillar: 'Microsoft Trivia',
      q: "Microsoft's AI assistant integrated across its products is called what?",
      choices: ['Cortana', 'Clippy', 'Copilot', 'Bing Chat'],
      correctIndex: 2,
    },
  ],
};

if (typeof window !== 'undefined') {
  window.TRIVIA_BY_DAY = TRIVIA_BY_DAY;
}
