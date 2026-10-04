#!/usr/bin/env python3
"""
An 800px WebP for each card photo whose largest size is 1200px, and a 320px
WebP of every product photograph for thumbnails.

    python3 scripts/make-card-image-sizes.py

The cards offered a 600w and a 1200w WebP. A phone needs about 660-720
device pixels for a full-width card, just over 600, so it took the 1200w
file: 85 KB for Toffahi, 163 KB for the jalapeno photograph, to fill a crop
176 pixels tall. This writes <name>-800.webp beside each, from the same JPEG
the other sizes came from, and the pages list it between the two. Quality
78: the cards show a 176px-tall crop, and the files stay under the 100 KB
per-image budget (scripts/check-performance-budget.js, 2026-10-04).
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = ['olive-toffahi-SpdiHPHF', 'olive-manzanilla-vwgGqjiA', 'olive-oxidized-black', 'jalapeno-sliced']
QUALITY = 78
# 2026-10-04 (Phase 3a): a 320px WebP of every product photograph, for the
# related-product thumbnails on the product pages (about 150px wide, 300 device
# pixels on a phone). The smallest size until then was 600w: 8-69 KB a file,
# three to a page.
THUMBS = ['olive-aggizi-BuhWRZTd', 'olive-toffahi-SpdiHPHF', 'olive-manzanilla-vwgGqjiA',
          'olive-oxidized-black', 'jalapeno-sliced', 'olive-kalamata']
THUMB_QUALITY = 75

for name in NAMES:
    im = Image.open(os.path.join(ROOT, 'assets', name + '.jpg')).convert('RGB')
    h = round(im.height * 800 / im.width)
    out = os.path.join(ROOT, 'assets', name + '-800.webp')
    im.resize((800, h), Image.LANCZOS).save(out, 'WEBP', quality=QUALITY, method=6)
    print(f'assets/{name}-800.webp: 800x{h}, {os.path.getsize(out) // 1024} KB')

for name in THUMBS:
    im = Image.open(os.path.join(ROOT, 'assets', name + '.jpg')).convert('RGB')
    h = round(im.height * 320 / im.width)
    out = os.path.join(ROOT, 'assets', name + '-320.webp')
    im.resize((320, h), Image.LANCZOS).save(out, 'WEBP', quality=THUMB_QUALITY, method=6)
    print(f'assets/{name}-320.webp: 320x{h}, {os.path.getsize(out) // 1024} KB')
