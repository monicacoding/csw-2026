// Photo Finish's template picker — the array js/games.js's photoFinish()
// renders as a grid of thumbnails to choose from, in place of the old
// free-form image upload. This array is the entire "folder structure":
// swapping in the real 40 meme/reaction images (once supplied) means
// replacing the files under assets/photo-finish/ with the same filenames
// (or updating `src` here to point at whatever filenames they actually use)
// — no other code changes required, since js/games.js and the Gallery both
// read a template's image purely through PHOTO_FINISH_TEMPLATES.find(id).
//
// Right now every entry points at a generated placeholder (see
// scripts/gen-photo-finish-placeholders.py) — a distinct color + emoji +
// number per template, just so the picker/Gallery/voting are all genuinely
// testable before the real images exist. `id` is what's actually stored on
// a submission (photoFinishEntries/{code}.templateId) — stable even if
// `src`/`alt` change later, so already-submitted entries don't silently
// point at the wrong thumbnail if a template gets swapped or renumbered.
const PHOTO_FINISH_TEMPLATES = Array.from({ length: 40 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    id: `template${n}`,
    src: `assets/photo-finish/template-${n}.svg`,
    alt: `Template ${n}`,
  };
});

if (typeof window !== 'undefined') {
  window.PHOTO_FINISH_TEMPLATES = PHOTO_FINISH_TEMPLATES;
}
