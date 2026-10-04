#!/usr/bin/env python3
"""
The Arabic web font the Arabic pages use, cut down to standard Arabic.

    python3 scripts/make-arabic-web-fonts.py

Writes assets/fonts/arabic-sans.woff2: Noto Sans Arabic, variable, its
weight axis narrowed from 100-900 to the 400-700 the pages use (no Arabic
page sets a lighter or heavier weight), for text and headings alike (owner, 2026-10-04: one Arabic font,
fewer files). It keeps standard Arabic (UNICODES below) plus the word space,
so an Arabic line, headings included, is set in one font: left in a Latin
face, the space alone made every Arabic heading download Playfair Display.
The Persian, Urdu, Quranic and presentation-form characters Google's
"arabic" subset also carries are dropped. Shaping keeps fontTools' default
feature set, which carries every Arabic joining, ligature and mark feature.
About 17 KB (31 KB with the full weight axis), downloaded only by Arabic
pages.

The Noto Naskh Arabic headings face (assets/fonts/arabic-naskh.woff2, added
earlier on 2026-10-04) was retired the same day for the single font.

Source: scripts/font-sources/notosansarabic-*.woff2 (Google Fonts, fetched
2026-10-04). SIL OFL 1.1 (assets/fonts/OFL.txt); Noto reserves no font name,
so the subset keeps its own. Output is deterministic.
"""
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOBS = [
    ('scripts/font-sources/notosansarabic-nwpCtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlj4wv4r4xA.woff2', 'assets/fonts/arabic-sans.woff2'),
]
# Standard Arabic: the word space and no-break space; comma, semicolon and
# question mark; the letters and hamza forms (U+0621-063A); tatweel and the
# letters U+0641-064A; the short vowels and other marks (U+064B-0652);
# Arabic-Indic digits and percent, decimal and thousands signs (U+0660-066D,
# some of which the site uses); superscript alef and alef wasla; the joiners
# and direction marks. Every Arabic character on the site and in the guides
# is in it; Persian and Urdu letters are not.
UNICODES = ([0x0020, 0x00A0, 0x060C, 0x061B, 0x061F] + list(range(0x0621, 0x063B)) + list(range(0x0640, 0x0653))
            + list(range(0x0660, 0x066E)) + [0x0670, 0x0671, 0x200C, 0x200D, 0x200E, 0x200F])


def main():
    for src, out in JOBS:
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        font = TTFont(os.path.join(ROOT, src), recalcTimestamp=False)
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        font = instancer.instantiateVariableFont(font, {'wght': (400, 700)})
        font.flavor = 'woff2'
        font.save(os.path.join(ROOT, out))
        print(f'{out}: {os.path.getsize(os.path.join(ROOT, out)) // 1024} KB')


if __name__ == '__main__':
    main()
