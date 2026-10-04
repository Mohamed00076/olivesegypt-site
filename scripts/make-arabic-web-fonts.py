#!/usr/bin/env python3
"""
The two Arabic web fonts the Arabic pages use, cut down to the basic Arabic
block.

    python3 scripts/make-arabic-web-fonts.py

Writes assets/fonts/arabic-sans.woff2 (Noto Sans Arabic, for text) and
assets/fonts/arabic-naskh.woff2 (Noto Naskh Arabic, for headings), both
variable (weights 400-700), keeping only standard Arabic (UNICODES below).
The Persian, Urdu, Quranic and presentation-form characters Google's
"arabic" subset also carries are dropped, which takes the pair from 253 KB
to about 51 KB, downloaded only by Arabic pages. Shaping (GSUB/GPOS) is
kept whole.

Sources: scripts/font-sources/notosansarabic-*.woff2 (Google Fonts, fetched
2026-10-04) and the site's own assets/fonts/notonaskharabic-*DHV20Lg.woff2.
Both are SIL OFL 1.1 (assets/fonts/OFL.txt); Noto reserves no font name, so
the subsets keep theirs. Output is deterministic.
"""
import os

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOBS = [
    ('scripts/font-sources/notosansarabic-nwpCtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlj4wv4r4xA.woff2', 'assets/fonts/arabic-sans.woff2'),
    ('assets/fonts/notonaskharabic-RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2', 'assets/fonts/arabic-naskh.woff2'),
]
# Standard Arabic: comma, semicolon and question mark; the 26 letters and
# hamza forms (U+0621-063A); tatweel and the letters U+0641-064A; the short
# vowels and other marks (U+064B-0652); Arabic-Indic digits and percent,
# decimal and thousands signs (U+0660-066D); superscript alef and alef wasla;
# the joiners and direction marks. Every Arabic character on the site and in
# the guides is in it; Persian and Urdu letters are not.
UNICODES = ([0x060C, 0x061B, 0x061F] + list(range(0x0621, 0x063B)) + list(range(0x0640, 0x0653))
            + list(range(0x0660, 0x066E)) + [0x0670, 0x0671, 0x200C, 0x200D, 0x200E, 0x200F])


def main():
    for src, out in JOBS:
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        font = TTFont(os.path.join(ROOT, src), recalcTimestamp=False)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        font.flavor = 'woff2'
        font.save(os.path.join(ROOT, out))
        print(f'{out}: {os.path.getsize(os.path.join(ROOT, out)) // 1024} KB')


if __name__ == '__main__':
    main()
