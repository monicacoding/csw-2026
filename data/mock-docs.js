// ---------------------------------------------------------------------------
// Hyperlink Race's self-contained "Learn Docs"-style site — fictional docs
// for a made-up customer-service platform ("Meridian CX"), living entirely
// inside this app as data (no real external site, no real Microsoft
// content). js/games.js's Hyperlink Race renders these as internal views
// inside its own modal — clicking an internal link just swaps which page
// this data describes is on screen, tracked in a plain JS variable (see
// runHyperlinkRace's `currentPageId`), which is what lets the app *know*
// which page a player is on rather than trust their self-report.
//
// MOCKDOCS_START_PAGE_ID / MOCKDOCS_GOAL_PAGE_ID are the only two things
// that need to change to run a different hunt some future week — nothing
// about the page graph itself is hardcoded to "being the start" or "being
// the goal" anywhere else.
//
// Graph shape: 18 pages, 7 categories. There's no single obvious click from
// getting-started to sla-policies — the shortest real route is 4 hops
// (getting-started → ticketing-basics → macros → automation-rules →
// sla-policies), several other routes run 5-6 hops, and every page links to
// at least one genuine decoy so reaching the goal takes actually reading
// and choosing, not pattern-matching one highlighted trail.
//
// Internal links are written directly into each page's body HTML as
// `<a href="#" class="mockdoc-link" data-doc-id="pageId">text</a>` — see
// wireMockDocLinks in js/games.js for the click handling. Body paragraphs
// are plain trusted strings (authored here, never user input), same as
// every other hand-authored HTML template already in this codebase
// (js/games.js's game screens) — no escaping needed.
// ---------------------------------------------------------------------------

const MOCKDOCS_START_PAGE_ID = 'getting-started';
const MOCKDOCS_GOAL_PAGE_ID = 'sla-policies';

const MOCKDOCS_CATEGORY_ORDER = [
  'Getting Started',
  'Tickets & Routing',
  'Automation',
  'Service Levels',
  'Customer Feedback',
  'Channels & Content',
  'Developer',
];

function mdLink(pageId, text) {
  return `<a href="#" class="mockdoc-link" data-doc-id="${pageId}">${text}</a>`;
}

const MOCKDOCS_PAGES = {
  'getting-started': {
    title: 'Getting Started with Meridian CX',
    category: 'Getting Started',
    lastUpdated: 'September 2, 2026',
    readMinutes: 3,
    links: ['account-setup', 'ticketing-basics', 'omnichannel-setup'],
    body: [
      `Meridian CX is a helpdesk platform for teams that handle a high volume of customer conversations across email, chat, and voice. This article is the starting point for new workspace admins — it covers what to set up first and links out to the deeper articles for each area.`,
      `Before anything else, finish ${mdLink('account-setup', 'setting up your workspace account')} — your workspace's timezone and business hours affect almost everything downstream, including how service level timers behave.`,
      `Once your account is configured, most teams move on to ${mdLink('ticketing-basics', 'ticketing basics')} to learn how cases flow through the system, or straight to ${mdLink('omnichannel-setup', 'omnichannel setup')} if email, chat, and voice all need to be live on day one.`,
    ],
  },

  'account-setup': {
    title: 'Setting Up Your Meridian CX Account',
    category: 'Getting Started',
    lastUpdated: 'August 28, 2026',
    readMinutes: 4,
    links: ['team-roles-permissions', 'inviting-teammates', 'sandbox-environments'],
    body: [
      `Workspace setup happens in three steps: confirming your organization's business hours, choosing a default timezone, and picking a primary support email domain. All three live under Workspace Settings → General.`,
      `Business hours in particular are worth getting right the first time — they're the default calendar every ${mdLink('sla-policies', 'service level policy')} pauses against outside working hours, and changing them later can shift SLA targets on cases that are already in progress.`,
      `Once the workspace itself is configured, set up ${mdLink('team-roles-permissions', 'team roles and permissions')} before inviting anyone — it's much easier to invite people directly into the right role than to reorganize access after a team has already started working cases. If you're only testing things out first, a ${mdLink('sandbox-environments', 'sandbox environment')} lets you do that without touching real customer data, and ${mdLink('inviting-teammates', 'inviting teammates')} covers the invite flow itself once you're ready.`,
    ],
  },

  'team-roles-permissions': {
    title: 'Team Roles and Permissions',
    category: 'Getting Started',
    lastUpdated: 'August 30, 2026',
    readMinutes: 5,
    links: ['case-routing', 'inviting-teammates', 'api-authentication'],
    body: [
      `Meridian CX ships with three built-in roles — Agent, Team Lead, and Admin — and supports custom roles on workspaces with the Scale plan or above. Roles control both what a person can see (which queues, which reports) and what they can do (reassign cases, edit automation, manage billing).`,
      `Team Leads inherit everything an Agent can do, plus visibility into their team's queue-level performance and the ability to reassign any case within their team, not just their own. This matters most once you've configured ${mdLink('case-routing', 'case routing')}, since a Team Lead is usually the person who manually rebalances a queue when automatic routing gets it wrong.`,
      `Admins are the only role that can generate ${mdLink('api-authentication', 'API keys')} or change workspace-wide settings like business hours. We'd recommend keeping the Admin role limited to two or three people even on a large team — it's a convenience/security tradeoff, and most day-to-day work doesn't actually need it. See ${mdLink('inviting-teammates', 'inviting teammates')} for how role assignment works at invite time.`,
    ],
  },

  'inviting-teammates': {
    title: 'Inviting Teammates to Your Workspace',
    category: 'Getting Started',
    lastUpdated: 'August 20, 2026',
    readMinutes: 2,
    links: ['team-roles-permissions', 'reporting-analytics'],
    body: [
      `Invitations are sent from Workspace Settings → People → Invite, either one at a time or by pasting a list of email addresses. Each invite requires picking a role up front — see ${mdLink('team-roles-permissions', 'team roles and permissions')} for what each one can access.`,
      `Invited teammates show up as "Pending" until they accept, and pending seats still count against your plan's seat limit. Once someone's accepted and started working cases, their activity feeds into ${mdLink('reporting-analytics', 'reporting and analytics')} the same as anyone else's — there's no separate onboarding period where their numbers are excluded.`,
    ],
  },

  'ticketing-basics': {
    title: 'Ticketing Basics',
    category: 'Tickets & Routing',
    lastUpdated: 'September 1, 2026',
    readMinutes: 4,
    links: ['macros', 'csat-surveys', 'knowledge-base-authoring'],
    body: [
      `Every customer message that comes in — email, chat, or voice — becomes a case. A case moves through four statuses: New, Open, Pending (waiting on the customer), and Resolved. Reopening a resolved case is always possible and doesn't create a duplicate.`,
      `Most agents don't type full replies from scratch for common questions — ${mdLink('macros', 'macros')} let you insert a pre-written response (with placeholders for the customer's name, case number, and so on) in one click, then edit it before sending.`,
      `After a case is resolved, the customer can optionally be sent a ${mdLink('csat-surveys', 'satisfaction survey')}, and agents are encouraged to link out to relevant ${mdLink('knowledge-base-authoring', 'knowledge base articles')} rather than re-explaining the same fix by hand every time.`,
    ],
  },

  'case-routing': {
    title: 'Case Routing Overview',
    category: 'Tickets & Routing',
    lastUpdated: 'August 25, 2026',
    readMinutes: 5,
    links: ['automation-rules', 'escalation-workflows', 'csat-surveys'],
    body: [
      `Case routing decides which queue a new case lands in, and which agent (if any) it's assigned to automatically. Meridian CX supports three routing strategies: round robin, load-balanced (fewest open cases wins), and skills-based, where cases are matched against tags an agent has been marked competent in.`,
      `Routing itself is just one kind of ${mdLink('automation-rules', 'automation rule')} under the hood — the routing strategy you pick in Settings is really a template that generates the underlying rule for you, which is why you can always drop into the rule editor afterward for anything the templates don't cover.`,
      `A case that isn't picked up before its response timer's warning threshold triggers whatever ${mdLink('escalation-workflows', 'escalation workflow')} the matching policy defines — routing gets a case to a queue, escalation is what happens if it then sits there too long. Once resolved, that case flows into the same ${mdLink('csat-surveys', 'CSAT')} pipeline as any other.`,
    ],
  },

  'escalation-workflows': {
    title: 'Escalation Workflows',
    category: 'Tickets & Routing',
    lastUpdated: 'August 22, 2026',
    readMinutes: 3,
    links: ['sla-policies', 'reporting-analytics'],
    body: [
      `An escalation workflow is the action Meridian CX takes when a case breaches — or is about to breach — the timers defined in its matching ${mdLink('sla-policies', 'SLA policy')}. Escalations range from a simple notification (ping the assigned agent) to a full reassignment (hand the case to a Team Lead and mark it urgent).`,
      `Escalation history is retained per case and rolls up into ${mdLink('reporting-analytics', 'reporting and analytics')}, so a team that's escalating a lot of cases from one particular queue is usually a sign that queue's routing or staffing needs a second look, not that the SLA policy itself is wrong.`,
    ],
  },

  'automation-rules': {
    title: 'Automation Rules',
    category: 'Automation',
    lastUpdated: 'September 3, 2026',
    readMinutes: 5,
    links: ['sla-policies', 'macros', 'webhooks'],
    body: [
      `An automation rule is a trigger, an optional set of conditions, and one or more actions — for example, "when a case is tagged billing AND the customer is on the Enterprise tier, THEN assign it to the Billing queue and set priority to High." Rules run in the order they're listed, and a case can match more than one.`,
      `Rules and ${mdLink('sla-policies', 'SLA policies')} are evaluated separately but interact constantly in practice: a rule that changes a case's tags or tier mid-flight can cause it to start matching a different SLA policy than the one it started under, which is worth testing deliberately rather than discovering by accident.`,
      `Two actions are common enough to have their own dedicated articles: inserting a ${mdLink('macros', 'macro')} automatically based on conditions, and firing a ${mdLink('webhooks', 'webhook')} out to an external system whenever a rule matches.`,
    ],
  },

  'macros': {
    title: 'Macros: Canned Responses at Scale',
    category: 'Automation',
    lastUpdated: 'August 18, 2026',
    readMinutes: 3,
    links: ['automation-rules', 'webhooks'],
    body: [
      `A macro is a reusable reply template with placeholders like {{customer.first_name}} and {{case.id}} that get filled in automatically when it's inserted. Macros can be triggered manually by an agent from the reply toolbar, or automatically as the action of an ${mdLink('automation-rules', 'automation rule')}.`,
      `Macro usage is tracked per-macro, which is a good way to find out which canned responses are actually earning their keep — a macro nobody's used in three months is usually a sign the underlying issue got fixed upstream. Macros can't themselves call out to another system directly; if you need that, pair the rule with a ${mdLink('webhooks', 'webhook')} action instead.`,
    ],
  },

  'webhooks': {
    title: 'Webhooks and Outbound Events',
    category: 'Automation',
    lastUpdated: 'August 15, 2026',
    readMinutes: 4,
    links: ['api-authentication', 'automation-rules'],
    body: [
      `Webhooks let Meridian CX notify an external system — a Slack-style chat app, an internal dashboard, a data warehouse — whenever something happens: a case is created, resolved, escalated, or reassigned. Configure a webhook under Settings → Integrations → Webhooks, or attach one as the action of an ${mdLink('automation-rules', 'automation rule')} for more targeted firing.`,
      `Every webhook payload is signed, and verifying that signature requires the same kind of credential covered in ${mdLink('api-authentication', 'API authentication')} — treat a webhook's signing secret with the same care as an API key, since anyone who has it can forge events.`,
    ],
  },

  'sla-policies': {
    title: 'Service Level Agreement (SLA) Policies',
    category: 'Service Levels',
    lastUpdated: 'September 5, 2026',
    readMinutes: 6,
    links: ['escalation-workflows', 'reporting-analytics'],
    body: [
      `Service Level Agreement (SLA) policies define how quickly your team is expected to respond to and resolve customer cases, based on priority, channel, or customer tier. Meridian CX evaluates every open case against its matching policy in real time and flags anything at risk of breaching its target.`,
      `A policy is built from two timers: a response timer, which starts the moment a case is created and stops at the first team reply, and a resolution timer, which runs until the case is marked resolved. Each timer can be configured with a target duration, a warning threshold, and an escalation action.`,
      `Business hours matter. By default, both timers pause outside your workspace's configured operating hours, so a case submitted at midnight doesn't silently burn through its response window before anyone is even online. You can override this per policy for a genuinely 24/7 support line.`,
      `Policies are matched top-down: the first policy whose conditions match an incoming case wins, so ordering is significant. A common pattern is to place your most specific policy — for example, cases tagged urgent from customers on the Enterprise tier — above your general-purpose fallback policy.`,
      `When a timer crosses its warning threshold, Meridian CX can notify the assigned agent, their manager, or an entire queue, depending on how the policy is configured. A breach — the timer running out entirely — triggers whatever ${mdLink('escalation-workflows', 'escalation workflow')} the policy defines, from a chat ping to an automatic case reassignment. Breach and near-breach rates for every policy are visible in ${mdLink('reporting-analytics', 'reporting and analytics')}.`,
    ],
    // The anti-sharing mechanism: a small pool of ordinary words already in
    // the prose above, each pinned to one exact paragraph so the highlight
    // can target that single occurrence unambiguously (every word below
    // appears exactly once in its listed paragraph, and none of them sit
    // inside a link). One is chosen at random per user the first time they
    // land on this page — see runHyperlinkRace's assignment logic in
    // js/games.js — so the underlying article is identical for everyone,
    // but the one word that lights up differs per player.
    answerCandidates: [
      { word: 'breaching', paragraph: 0 },
      { word: 'priority', paragraph: 0 },
      { word: 'resolution', paragraph: 1 },
      { word: 'duration', paragraph: 1 },
      { word: 'midnight', paragraph: 2 },
      { word: 'override', paragraph: 2 },
      { word: 'urgent', paragraph: 3 },
      { word: 'fallback', paragraph: 3 },
    ],
  },

  'csat-surveys': {
    title: 'Customer Satisfaction (CSAT) Surveys',
    category: 'Customer Feedback',
    lastUpdated: 'August 12, 2026',
    readMinutes: 3,
    links: ['reporting-analytics', 'knowledge-base-authoring'],
    body: [
      `A CSAT survey is a one-question, one-click rating (1 to 5) sent automatically after a case is resolved, with an optional follow-up comment field. Surveys can be delayed by a configurable number of hours so they don't land while a customer's still mid-conversation.`,
      `Response rates and average scores are broken out by queue, agent, and channel in ${mdLink('reporting-analytics', 'reporting and analytics')}. A pattern worth watching for: low scores clustered around a specific topic usually mean the underlying ${mdLink('knowledge-base-authoring', 'knowledge base article')} needs a rewrite, not that the agents handling it need coaching.`,
    ],
  },

  'reporting-analytics': {
    title: 'Reporting and Analytics',
    category: 'Customer Feedback',
    lastUpdated: 'August 29, 2026',
    readMinutes: 4,
    links: ['csat-surveys', 'escalation-workflows'],
    body: [
      `The Reporting workspace gives you queue-level and agent-level views of volume, response/resolution time, ${mdLink('csat-surveys', 'CSAT')} scores, and SLA breach rates, each filterable by date range, channel, and tag. Most views can be scheduled as a recurring email digest.`,
      `Breach and ${mdLink('escalation-workflows', 'escalation')} rates are usually the fastest way to spot a queue that's understaffed relative to its volume — a rising escalation rate with a flat headcount is a much clearer signal than raw case volume alone, which can look steady even as individual cases take longer and longer to close.`,
    ],
  },

  'knowledge-base-authoring': {
    title: 'Authoring Knowledge Base Articles',
    category: 'Channels & Content',
    lastUpdated: 'August 10, 2026',
    readMinutes: 3,
    links: ['csat-surveys', 'omnichannel-setup'],
    body: [
      `Knowledge base articles live alongside cases and can be linked directly into a reply the same way a macro can. Each article has a status (Draft, Published, Archived) and a visibility setting (internal-only, or public-facing on your workspace's help center).`,
      `Articles linked into a resolved case are tracked the same way macro usage is, and that data feeds back into ${mdLink('csat-surveys', 'CSAT')} analysis — an article that correlates with lower satisfaction scores when it's linked is worth revisiting. Published articles are also searchable from inside every ${mdLink('omnichannel-setup', 'channel')}, including voice, where an agent can read a summary aloud mid-call.`,
    ],
  },

  'omnichannel-setup': {
    title: 'Omnichannel Setup: Chat, Email, and Voice',
    category: 'Channels & Content',
    lastUpdated: 'August 27, 2026',
    readMinutes: 4,
    links: ['webhooks', 'api-authentication'],
    body: [
      `Meridian CX can receive cases from email (via a forwarding address or direct inbox connection), a embeddable chat widget, and voice (via a connected phone number or SIP trunk). All three funnel into the same case queue and are subject to the same routing and SLA logic — the channel is just another condition you can route or escalate on.`,
      `Voice specifically needs a bit more setup than the other two: a connected number, a call-routing menu, and — if you want calls logged as cases automatically rather than manually — either a native integration or a ${mdLink('webhooks', 'webhook')} wired up through your phone provider. Custom integrations of any kind will need ${mdLink('api-authentication', 'API credentials')} of their own.`,
    ],
  },

  'api-authentication': {
    title: 'API Authentication',
    category: 'Developer',
    lastUpdated: 'August 5, 2026',
    readMinutes: 4,
    links: ['rate-limits', 'sandbox-environments'],
    body: [
      `Every API request needs an API key, generated by an Admin from Settings → Developer → API Keys, sent as a Bearer token in the Authorization header. Keys are scoped at creation time to read-only or read-write, and can optionally be restricted to specific resources (cases, macros, reporting) rather than granted full access.`,
      `Keys never expire automatically, so rotating them on a schedule — and immediately after anyone with access to one leaves the team — is a manual habit worth building. Every key is subject to the same ${mdLink('rate-limits', 'rate limits')} regardless of scope, and it's worth testing new integrations in a ${mdLink('sandbox-environments', 'sandbox environment')} before pointing them at production data.`,
    ],
  },

  'rate-limits': {
    title: 'API Rate Limits',
    category: 'Developer',
    lastUpdated: 'July 30, 2026',
    readMinutes: 2,
    links: ['api-authentication', 'sandbox-environments'],
    body: [
      `The API allows 300 requests per minute per key on the standard plan, returned in the X-RateLimit-Remaining response header on every call so you can back off before hitting the limit rather than after. Exceeding it returns a 429 with a Retry-After header.`,
      `Rate limits apply per ${mdLink('api-authentication', 'API key')}, not per workspace, so splitting a high-volume integration across two scoped keys is a legitimate way to raise your effective ceiling. A ${mdLink('sandbox-environments', 'sandbox')} key shares the same limit as a production key of the same scope — sandbox usage isn't unmetered.`,
    ],
  },

  'sandbox-environments': {
    title: 'Sandbox Environments',
    category: 'Developer',
    lastUpdated: 'July 22, 2026',
    readMinutes: 3,
    links: ['api-authentication', 'rate-limits'],
    body: [
      `A sandbox is a full copy of your workspace's configuration — routing rules, SLA policies, macros — with none of the real case data. It's the recommended place to test a new automation rule or integration before it touches anything customer-facing.`,
      `Sandbox and production each need their own ${mdLink('api-authentication', 'API key')}, since keys are workspace-scoped and a sandbox is technically a separate workspace under the hood. They also share the same ${mdLink('rate-limits', 'rate limit')} rules, so load-testing against a sandbox is a reasonable way to find out how an integration behaves near its ceiling without any risk to production.`,
    ],
  },
};

if (typeof window !== 'undefined') {
  window.MOCKDOCS_START_PAGE_ID = MOCKDOCS_START_PAGE_ID;
  window.MOCKDOCS_GOAL_PAGE_ID = MOCKDOCS_GOAL_PAGE_ID;
  window.MOCKDOCS_CATEGORY_ORDER = MOCKDOCS_CATEGORY_ORDER;
  window.MOCKDOCS_PAGES = MOCKDOCS_PAGES;
}
