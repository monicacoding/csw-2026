// ---------------------------------------------------------------------------
// Microsoft product list for Snap Judgement's guess dropdown (alphabetized —
// keep it that way, it's what makes the dropdown scannable) + the fixed
// 8-round set the game actually uses. Each round's `product` must match a
// PRODUCT_LIST entry exactly (case-sensitive) since the dropdown answer is
// checked with strict equality.
//
// `image` paths point at assets/snap-judgement/ (the folder already
// scaffolded for these). js/games.js falls back to a plain product-name
// placeholder card if a file's missing/404s, so the round stays playable
// even before every screenshot is dropped in.
// ---------------------------------------------------------------------------

const MS_PRODUCTS = [
  'Access', 'Clipchamp', 'Copilot', 'Edge', 'Excel', 'Forms', 'Internet Explorer',
  'Lens', 'Lists', 'Loop', 'MSN', 'OneDrive', 'OneNote', 'Outlook', 'Planner',
  'PowerPoint', 'PowerScribe One', 'Project', 'Publisher', 'Security', 'SharePoint',
  'Skype', 'Surface', 'Sway', 'SwiftKey', 'Teams', 'To Do', 'Viva', 'Visio',
  'Whiteboard', 'Windows', 'Word', 'Xbox',
];

// The fixed 8 rounds for Snap Judgement, in the order the screenshots were
// provided. Each `image` filename below is what that screenshot should be
// saved as under assets/snap-judgement/ — the files themselves still need
// to be dropped in (see README "Polish pass #11").
const SNAP_ROUNDS = [
  { product: 'Excel', image: 'assets/snap-judgement/excel.jpg' },
  { product: 'Internet Explorer', image: 'assets/snap-judgement/internet-explorer.jpg' },
  { product: 'Edge', image: 'assets/snap-judgement/edge.jpg' },
  { product: 'Copilot', image: 'assets/snap-judgement/copilot.jpg' },
  { product: 'Teams', image: 'assets/snap-judgement/teams.jpg' },
  { product: 'Outlook', image: 'assets/snap-judgement/outlook.jpg' },
  { product: 'SharePoint', image: 'assets/snap-judgement/sharepoint.jpg' },
  { product: 'PowerPoint', image: 'assets/snap-judgement/powerpoint.jpg' },
];

if (typeof window !== 'undefined') {
  window.MS_PRODUCTS = MS_PRODUCTS;
  window.SNAP_ROUNDS = SNAP_ROUNDS;
}
