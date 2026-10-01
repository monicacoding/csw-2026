#!/usr/bin/env python3
"""
One-off import for the real Photo Finish meme templates, replacing the
generated placeholders (scripts/gen-photo-finish-placeholders.py) with the
actual 40 images. Not run by build.js or any part of the live app.

Source files live outside this repo (supplied separately, not committed in
their original form) — this script resizes/re-encodes them down to a sane
web thumbnail size before they ever land under assets/photo-finish/, for the
same reason js/games.js's old fileToResizedDataUrl existed: the originals
are full-resolution browser downloads (400KB-2.8MB each), and this picker
renders all 40 at once as a grid of small thumbnails — shipping them
unresized would mean an 40-80MB page just to open Photo Finish.

Ordering: the 40 source files have no meaningful filenames of their own
(4 are named template-01..04.png, the rest are browser-assigned
"download (N).png" with gaps) — but their mtimes form a clean, unbroken
chronological sequence (confirmed: template-01..04 are strictly the oldest
four, then download(9) through download(47) strictly increase from there).
That's treated as the real save order and preserved 1:1 into template-01
.. template-40, on the assumption that whatever order they were saved in
reflects how they were meant to be curated — not re-sorted alphabetically
(which would scramble "download (9)" after "download (10)") or arbitrarily.
"""
import os
import sys
from PIL import Image

SRC_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads/memes')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'photo-finish')
MAX_DIM = 640
QUALITY = 85

files = [f for f in os.listdir(SRC_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif'))]
files.sort(key=lambda f: os.path.getmtime(os.path.join(SRC_DIR, f)))

if len(files) != 40:
    print(f'Expected exactly 40 source images, found {len(files)}. Aborting — check {SRC_DIR}.')
    sys.exit(1)

# Clear the old placeholder SVGs first — these are being fully replaced, not
# supplemented (same filenames, different extension, so old ones would
# otherwise linger unreferenced).
for f in os.listdir(OUT_DIR):
    if f.endswith('.svg'):
        os.remove(os.path.join(OUT_DIR, f))

for i, fname in enumerate(files, start=1):
    n = f'{i:02d}'
    src_path = os.path.join(SRC_DIR, fname)
    img = Image.open(src_path)
    # Flatten any transparency onto white rather than letting JPEG encoding
    # silently turn it black — plenty of meme templates are PNGs with a
    # transparent (not white) background.
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        img = img.convert('RGBA')
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert('RGB')

    w, h = img.size
    if max(w, h) > MAX_DIM:
        scale = MAX_DIM / max(w, h)
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)

    out_path = os.path.join(OUT_DIR, f'template-{n}.jpg')
    img.save(out_path, 'JPEG', quality=QUALITY, optimize=True)
    print(f'{fname} -> template-{n}.jpg ({os.path.getsize(out_path) // 1024}KB)')

print(f'\nDone — {len(files)} templates written to {OUT_DIR}')
