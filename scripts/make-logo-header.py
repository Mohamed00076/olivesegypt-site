#!/usr/bin/env python3
"""
The header logo at the size it is shown.

    python3 scripts/make-logo-header.py

Every page's header shows the logo in a 32px box (class h-8 w-8), but loaded
the full 236x289 original, 38 KB, on every page. This writes
assets/logo-header.png: the same artwork scaled to 52x64, twice the box for
sharp high-density screens, lossless, about 5 KB. The original stays for the
PDFs, the social-share card, the CRM documents and the Organization logo in
the structured data, which want the full size.
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'logo-BJ1TOn9V.png')
OUT = os.path.join(ROOT, 'assets', 'logo-header.png')
HEIGHT = 64

im = Image.open(SRC).convert('RGBA')
width = round(im.width * HEIGHT / im.height)
im.resize((width, HEIGHT), Image.LANCZOS).save(OUT, 'PNG', optimize=True)
print(f'assets/logo-header.png: {width}x{HEIGHT}, {os.path.getsize(OUT)} bytes')
