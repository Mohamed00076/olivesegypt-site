#!/usr/bin/env python3
"""Build the small icons from the company logo.

    python3 scripts/build-favicons.py          (requires Pillow)

Writes assets/favicon-mark.png, favicon-48.png and favicon.ico. It does not
touch the large icons (favicon-96, icon-192, icon-512, apple-touch-icon):
those are the complete logo and are checked in as-is.

Run this only when the logo itself changes. The output is committed, not
built at deploy time -- Netlify runs build-geo.js and nothing else, and a
deploy is not the place to discover that Pillow is missing.


WHY THERE IS A CROP AT ALL

The logo is a tall lockup: two colour bars, an olive, and fine branches. It
resolves from about 96px up. In a 16px browser tab the branches collapse and
the whole thing reads as a smudge, which is what the site actually shipped
once a red placeholder favicon was replaced with the real logo.

So the small icons are a 96x96 window onto that same artwork, centred on the
olive at the top of the mark -- the one element with enough mass to survive
sixteen pixels. The corner of the gold bar falls inside the frame, so both
brand colours come with it. Nothing here draws, moves or recolours anything:
CROP is a pixel region of icon-512.png and that is the whole of it.
scripts/check-favicons.js enforces that by sliding the mark across the logo
and requiring a near-zero match.


WHY 96, SPECIFICALLY

96 divides exactly by 16, 32 and 48. Every output pixel is therefore exactly
an n-by-n block of source pixels, so each icon is a true area average with no
resampling error at all. Widening the crop by a few pixels would cost that.


WHY THE AVERAGING HAPPENS IN LINEAR LIGHT

An sRGB value is a perceptual encoding, not a quantity of light. Averaging
those codes directly -- which is what every image tool does by default --
averages the wrong thing, and on a high-contrast mark it shows: the white
highlight on the olive comes out grey and the whole icon reads muddy.

Converting to linear light, averaging, and converting back gives the correct
result. Measured on this artwork at 32px, the white highlight survives at full
255 either way, but sRGB averaging drags the midtones down and flattens the
tonal range from 199 to 216 in the wrong direction -- the highlight arc stops
reading as a highlight.

Lanczos was tried and rejected. Its negative lobes ring on edges this hard,
putting a black fringe around the olive at 48px that is nowhere in the source
(the darkest pixel came out at luminance 0, below anything in the artwork).
A box filter cannot overshoot, and at exact integer ratios it is not an
approximation of the right answer -- it is the right answer.
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SOURCE = 'icon-512.png'
CROP = (243, 142, 339, 238)          # the olive at the top of the mark
MARK = 'assets/favicon-mark.png'
PNG_48 = 'favicon-48.png'
ICO = 'favicon.ico'
ICO_SIZES = (16, 32, 48)


def _srgb_to_linear(v):
    v /= 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(x):
    x = 0.0 if x < 0 else (1.0 if x > 1 else x)
    return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055


_TO_LINEAR = [_srgb_to_linear(i) for i in range(256)]


def downscale(img, size):
    """Area-average to size x size, with the averaging done in linear light."""
    if img.width % size or img.height % size:
        raise ValueError(f'{img.size} does not divide evenly by {size}; see WHY 96 above')

    channels = []
    for channel in img.convert('RGB').split():
        linear = Image.new('F', channel.size)
        linear.putdata([_TO_LINEAR[v] for v in channel.getdata()])
        linear = linear.resize((size, size), Image.BOX)
        encoded = Image.new('L', (size, size))
        encoded.putdata([round(255 * _linear_to_srgb(v)) for v in linear.getdata()])
        channels.append(encoded)
    return Image.merge('RGB', channels)


def main():
    source = Image.open(os.path.join(ROOT, SOURCE)).convert('RGB')
    mark = source.crop(CROP)

    side = CROP[2] - CROP[0]
    if mark.size != (side, side):
        raise SystemExit(f'{SOURCE} is smaller than the crop region {CROP}')
    for size in ICO_SIZES:
        if side % size:
            raise SystemExit(f'crop is {side}px, which does not divide by {size}')

    mark.save(os.path.join(ROOT, MARK))
    downscale(mark, 48).save(os.path.join(ROOT, PNG_48))

    # Pillow's ICO writer resamples internally, so hand it images already at
    # the right size -- otherwise the careful part above is thrown away.
    sizes = [downscale(mark, s) for s in ICO_SIZES]
    sizes[-1].save(os.path.join(ROOT, ICO), format='ICO',
                   sizes=[(s, s) for s in ICO_SIZES],
                   append_images=sizes[:-1])

    print(f'{MARK}  <- {SOURCE} {CROP}')
    print(f'{PNG_48}     <- linear-light area average')
    print(f'{ICO}       <- {", ".join(f"{s}x{s}" for s in ICO_SIZES)}')
    print('\nnow run: node scripts/check-favicons.js')


if __name__ == '__main__':
    main()
