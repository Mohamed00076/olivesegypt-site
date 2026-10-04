#!/usr/bin/env python3
"""
Static instances of the site's variable web fonts, for the PDFs only.

    python3 scripts/make-pdf-static-fonts.py

Chromium can embed a variable font in a PDF only as Type3, a format some
viewers draw less sharply and tools handle worse than ordinary TrueType. So
for every @font-face in assets/fonts/fonts.css whose file is a variable font,
this writes the same file pinned at the face's declared weight to
scripts/pdf-fonts/static/, and scripts/guide-pdfs.js points the PDFs' copy of
that face at it. The outlines are the variable font's own at that weight, so
the PDFs look the same.

LICENCE. The originals are SIL OFL 1.1 (assets/fonts/OFL.txt). An instance is
a Modified Version, and Playfair Display reserves its name, so every instance
is renamed ("TC PDF Sans/Serif/Naskh") before it is saved; it stays under the
OFL, whose text is in scripts/pdf-fonts/static/OFL.txt. The page still calls
the face by the site's family name: that is a CSS label, not the font's name.

Output is deterministic (the originals' timestamps), so re-running it on unchanged
inputs changes nothing. scripts/ is pruned from the deploy: no page loads
these files.
"""
import os
import re
import shutil

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, 'assets', 'fonts', 'fonts.css')
OUT = os.path.join(ROOT, 'scripts', 'pdf-fonts', 'static')
NEW_NAME = {'Plus Jakarta Sans': 'TC PDF Sans', 'Playfair Display': 'TC PDF Serif', 'Noto Naskh Arabic': 'TC PDF Naskh'}
STYLE = {400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold'}


def faces():
    css = open(CSS, encoding='utf-8').read()
    for body in re.findall(r'@font-face\s*\{([^}]*)\}', css):
        get = lambda prop: (re.search(prop + r'\s*:\s*([^;]+)', body) or [None, None])[1]
        yield (get('font-family').strip().strip('\'"'), (get('font-style') or 'normal').strip(),
               int(get('font-weight').strip()), re.search(r'url\(/([^)]+)\)', body).group(1))


def static_path(src, weight):
    """Where the static instance of src at weight is written (repo-relative)."""
    stem = os.path.splitext(os.path.basename(src))[0]
    return f'scripts/pdf-fonts/static/{stem}-{weight}.woff2'


def rename(font, family, weight):
    style = STYLE[weight]
    full = f'{family} {style}'
    ps = f'{family.replace(" ", "")}-{style}'
    name = font['name']
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25) or rec.nameID >= 256:
            name.removeNames(nameID=rec.nameID)
    for nid, value in ((1, family if weight in (400, 700) else f'{family} {style}'),
                       (2, 'Bold' if weight == 700 else 'Regular'), (3, f'{ps};instance'),
                       (4, full), (6, ps), (16, family), (17, style)):
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)
    for table in ('STAT',):
        if table in font:
            del font[table]


def main():
    os.makedirs(OUT, exist_ok=True)
    made = 0
    for family, style, weight, src in faces():
        if family not in NEW_NAME or style != 'normal':
            continue
        font = TTFont(os.path.join(ROOT, src), recalcTimestamp=False)
        if 'fvar' not in font:
            continue
        inst = instancer.instantiateVariableFont(font, {'wght': weight})
        rename(inst, NEW_NAME[family], weight)
        # Keep the original's timestamps rather than the time of saving.
        inst.recalcTimestamp = False
        inst['head'].modified = font['head'].modified
        inst.flavor = 'woff2'
        inst.save(os.path.join(ROOT, static_path(src, weight)), reorderTables=True)
        made += 1
    shutil.copyfile(os.path.join(ROOT, 'assets', 'fonts', 'OFL.txt'), os.path.join(OUT, 'OFL.txt'))
    print(f'{made} static instance(s) in scripts/pdf-fonts/static')


if __name__ == '__main__':
    main()
