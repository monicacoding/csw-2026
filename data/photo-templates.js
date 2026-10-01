// Photo Finish's template picker — the array js/games.js's photoFinish()
// renders as a grid of thumbnails to choose from, in place of the old
// free-form image upload. This array is the entire "folder structure":
// swapping any of these images later means replacing the matching file
// under assets/photo-finish/ (same filename) or updating `src` here to
// point at a new one — no other code changes required, since js/games.js
// and the Gallery both read a template's image purely through
// PHOTO_FINISH_TEMPLATES.find(id).
//
// The real 40 meme templates (scripts/import-photo-finish-memes.py —
// resized/re-encoded from the originals supplied separately, down from
// several hundred KB–2.8MB each to a web-sized JPEG, since this picker
// renders all 40 at once). Numbered in the same order they were originally
// saved (see that script's own comment on how that order was determined),
// not re-sorted. `id` is what's actually stored on a submission
// (photoFinishEntries/{code}.templateId) — stable even if `src`/`alt`
// change later, so already-submitted entries don't silently point at the
// wrong thumbnail if a template gets swapped or renumbered.
const PHOTO_FINISH_TEMPLATES = Array.from({ length: 40 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: `template${n}`,
    src: `assets/photo-finish/template-${n}.jpg`,
    alt: `Template ${n}`,
  };
});

if (typeof window !== 'undefined') {
  window.PHOTO_FINISH_TEMPLATES = PHOTO_FINISH_TEMPLATES;
}
