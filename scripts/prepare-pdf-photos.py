#!/usr/bin/env python3
"""The photographs the downloadable PDFs print (scripts/pdf-design/photos/).

    python3 scripts/prepare-pdf-photos.py                 every photo whose source is in the repo
    python3 scripts/prepare-pdf-photos.py NAME=/path.jpg  one photo from a file kept outside the repo

Owner's rules (2026-10-13): square crop; at least 300 ppi at the size it
prints; JPEG quality 85; EXIF and GPS stripped; no colour grading or
retouching that changes how the product looks; never upscale a low-resolution
copy. So this script only crops, scales down when the crop is larger than
needed, and re-encodes. A crop smaller than the print size needs at 300 ppi
is refused, not enlarged.

Originals that show more than the product (facility, equipment, handwriting,
lot marks) stay out of the repository: pass their path on the command line,
and only the tight crop is written. The source and permission of each photo
are in docs/asset-rights-register.md.
"""
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'scripts', 'pdf-design', 'photos')

# The largest a photo prints on any sheet: 50 mm (one photo) or 48 mm (pair).
PRINT_MM = 50
MIN_PX = round(PRINT_MM / 25.4 * 300)  # 591 px at 300 ppi
MAX_PX = 1000  # enough for 50 mm at over 500 ppi; keeps files small

# name: (source in the repo, or None when it is supplied on the command line;
#        crop box (left, top, right, bottom) in the source, or None for the
#        largest centred square)
PHOTOS = {
    # The homepage's whole green olives photograph, already a square crop of
    # the owner's original (owner-confirmed 2026-10-13).
    'green-olives-whole.jpg': ('assets/hero-green-olives.jpg', None),
    # Pitted green olives at the partner facility, taken by the owner (date
    # not recorded). The original (960 x 1280, a messaging-app copy) shows a
    # tray, barrels and handwriting, so it stays out of the repository and only
    # this 620 x 620 crop of olives is kept (tight enough to match the whole-olive photo's scale; 328 ppi at 48 mm). To be re-cut from the camera
    # original when the owner sends it. Supplied on the command line.
    'green-olives-pitted.jpg': (None, (260, 620, 880, 1240)),
    # Jalapeño, green and red rings: the owner's warehouse photographs
    # (960 x 1280 copies, 2026-10-13). Cropped inside the vessel, so no rim,
    # lid or the importer's label on the red one's bucket shows.
    'jalapeno-green-rings.jpg': (None, (130, 280, 850, 1000)),
    'jalapeno-red-rings.jpg': (None, (190, 330, 850, 990)),
    # Oxidized black olives (pitted, in brine): the owner's warehouse
    # photograph, cropped below the barrel lids and the bucket's tab.
    'oxidized-black-olives.jpg': (None, (0, 420, 860, 1280)),
}


def prepare(name, source, box):
    im = Image.open(source)
    im.load()
    if box is None:
        side = min(im.size)
        left, top = (im.width - side) // 2, (im.height - side) // 2
        box = (left, top, left + side, top + side)
    if box[2] - box[0] != box[3] - box[1]:
        sys.exit(f'{name}: crop {box} is not square')
    crop = im.crop(box).convert('RGB')
    if crop.width < MIN_PX:
        sys.exit(f'{name}: crop is {crop.width} px, under the {MIN_PX} px that {PRINT_MM} mm needs at 300 ppi. '
                 'Not enlarged: supply a larger original.')
    if crop.width > MAX_PX:
        crop = crop.resize((MAX_PX, MAX_PX), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    # A fresh image carries no EXIF, GPS or other metadata.
    clean = Image.frombytes('RGB', crop.size, crop.tobytes())
    out = os.path.join(OUT, name)
    clean.save(out, 'JPEG', quality=85, optimize=True, progressive=True)
    ppi = clean.width / (PRINT_MM / 25.4)
    print(f'wrote scripts/pdf-design/photos/{name}: {clean.width} x {clean.height}, '
          f'{ppi:.0f} ppi at {PRINT_MM} mm, {os.path.getsize(out) // 1024} KB')


def main():
    given = dict(a.split('=', 1) for a in sys.argv[1:] if '=' in a)
    for name, (source, box) in PHOTOS.items():
        if name in given:
            prepare(name, given[name], box)
        elif source and not given:
            prepare(name, os.path.join(ROOT, source), box)


if __name__ == '__main__':
    main()
