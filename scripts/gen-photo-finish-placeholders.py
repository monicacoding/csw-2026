#!/usr/bin/env python3
"""
One-off generator for assets/photo-finish/template-NN.svg — 40 placeholder
meme/reaction thumbnails so the Photo Finish template picker (data/
photo-templates.js) has something real to render and test against before
the actual 40 meme images are supplied. Not run by build.js or any part of
the live app; re-run manually only if the placeholder set itself needs
regenerating. Once real images are dropped in under the same filenames
(template-01.jpg, etc.) and data/photo-templates.js's `src`/`alt` fields are
updated to match, these placeholders are simply overwritten/replaced.
"""
import os

PALETTE = ['#1D3557', '#9C3B2E', '#F2A73B', '#E7EEE9', '#FBF1E4']
EMOJI = ['😂', '🤣', '😅', '🙃', '😎', '🤯', '🫠', '😬', '🥲', '😭',
         '🤪', '😤', '🫡', '🥹', '😵‍💫', '🤓', '😮‍💨', '🫨', '😶‍🌫️', '🙄']

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'photo-finish')
os.makedirs(OUT_DIR, exist_ok=True)

for i in range(1, 41):
    n = f'{i:02d}'
    bg = PALETTE[(i - 1) % len(PALETTE)]
    fg = '#FBF1E4' if bg in ('#1D3557', '#9C3B2E') else '#1D3557'
    emoji = EMOJI[(i - 1) % len(EMOJI)]
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <rect width="300" height="300" fill="{bg}" />
  <text x="150" y="145" font-size="100" text-anchor="middle" dominant-baseline="middle">{emoji}</text>
  <text x="150" y="230" font-size="22" font-family="Verdana, sans-serif" font-weight="700" fill="{fg}" text-anchor="middle">Template {n}</text>
</svg>'''
    with open(os.path.join(OUT_DIR, f'template-{n}.svg'), 'w') as f:
        f.write(svg)

print('Wrote 40 placeholder templates to', OUT_DIR)
