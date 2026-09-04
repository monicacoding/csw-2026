// ---------------------------------------------------------------------------
// Hand-drawn/sketch-style icons — stroked, round-capped, slightly irregular
// paths rather than crisp solid vector shapes, to match the doodle aesthetic.
// Inherit currentColor so they pick up whatever medallion/badge they sit in.
// ---------------------------------------------------------------------------

const Icons = {
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2.8c.6 2 1.4 4.6 2.3 5.9 1.4.3 4.1.5 6.1.9-1.5 1.5-3.4 3-4.1 3.9.3 1.9 1 4.4 1.1 6.3-1.9-1-4-2.4-5.4-2.6-1.5.4-3.8 1.7-5.5 2.5.3-2 .7-4.5 1-6.2-1-1-2.9-2.6-4.2-3.8 2.1-.5 4.6-.6 6.1-1 .8-1.5 1.7-4.1 2.6-5.9z"/></svg>`,
  diamond: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4.2 9.3L8 3.4h8.3l3.5 5.7L12 21 4.2 9.3z"/><path d="M4.2 9.3h15.6M9 3.6l-1 5.6L12 21M15.3 3.6l1 5.6L12 21"/></svg>`,
  cares: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3.2c-4.9-.3-9 3.6-9 8.6s4 8.9 9 8.6c4.6-.3 8.8-3.9 8.8-8.6S16.9 2.9 12 3.2z"/><path d="M15 9.2c-1-.9-4-.8-4.7.6-.8 1.6.4 2.8 1.7 3 1.6.3 3.3-.4 3.3-1.7" /></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M13.4 2.6L4.8 14h5.6l-1 7.4 9-11.6h-5.9l.9-7.2z"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.2v18"/><path d="M5 4.3c2-1 3.6-.6 5.4.1 1.9.7 3.7.9 5.4-.2-.2 1.6-.4 3.2-.2 4.6.2 1.6.7 2.8-.4 3.8-1.7 1.4-3.7 1-5.4.2-1.7-.8-3.5-1-4.8-.1z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.8l4.6 4.6L20 6"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8 10.3V7.4c0-2.4 1.8-4.2 4-4.2s4 1.8 4 4.2v2.9"/><circle cx="12" cy="15" r="1.4"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4c0 3-2.2 5.4-5 5.4S7 11 7 8V4z"/><path d="M7 5.2H4.3c0 2.2 1 3.8 2.9 4M17 5.2h2.7c0 2.2-1 3.8-2.9 4"/><path d="M10 13.3v3M14 13.3v3"/><path d="M8 19.8c0-.9 1.8-1.6 4-1.6s4 .7 4 1.6"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c.6 3 1.7 6 4.4 7C13.7 11 12.6 14 12 17c-.6-3-1.7-6-4.4-7C10.3 9 11.4 6 12 3z"/></svg>`,
  checkerbit: `<svg viewBox="0 0 20 20"><rect x="1" y="1" width="8" height="8" fill="currentColor"/><rect x="11" y="11" width="8" height="8" fill="currentColor"/></svg>`,
  cursor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3.3l6.7 16.9 2.4-7 7-2.3z"/></svg>`,
};

function pillarIcon(name) {
  return Icons[name] || Icons.star;
}

// A short, uneven "scribble" underline used under headings — one hand-drawn
// path per call so nobody notices they're all the same squiggle.
function scribbleUnderline(color = 'var(--brick)') {
  return `<svg class="scribble-underline" viewBox="0 0 220 12" preserveAspectRatio="none"><path d="M2 7 C 30 2, 55 10, 90 5 C 120 1, 150 9, 180 4 C 195 2, 205 6, 218 3" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/></svg>`;
}
