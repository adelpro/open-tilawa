#!/usr/bin/env python3
"""Generate the brand bits the browser and a launcher ask for.

The source of truth is `public/images/logo.png` — the navy تلاوة wordmark on a
transparent canvas, with a soft drop shadow baked into its alpha. There is no
vector version of the mark in the repository, so the tab icon is traced out of
that raster with potrace; the launcher icons are plain rasters.

Run by hand, not at build: these are brand assets, and the image build stage is
node-only. `apps/web/public/` is copied verbatim into `dist/` by Vite.

    python3 apps/web/scripts/make-assets.py

Two rules decide the backgrounds, and they are not the same rule:

  * The **browser tab** paints its own background, and that background is light
    or dark depending on the user's theme. So the tab icon carries no plate —
    an opaque white square glares on a dark tab strip and has no edge at all on
    a light one. `favicon.svg` also swaps its fill per `prefers-color-scheme`,
    which a raster cannot do.
  * A **launcher** composites the icon onto whatever it likes: iOS paints alpha
    onto black, Android crops a maskable to an arbitrary shape, and the App
    Store rejects alpha outright. Those icons stay opaque and full-bleed.
"""
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageDraw, ImageFont

PUBLIC = Path(__file__).resolve().parents[1] / 'public'
LOGO = PUBLIC / 'images' / 'logo.png'

INK = (17, 17, 17)  # #111 — the app's --ink; the page is greys only
WHITE = (255, 255, 255, 255)

# Open Graph / Twitter `summary_large_image`: 1.91:1. Crop-free at every card
# renderer, and the largest size X, Facebook and Slack all accept.
SHARE_SIZE = (1200, 630)

# The wordmark is two dots over a 35px stroke; anything under ~50% alpha in the
# source is the drop shadow, not the letter.
GLYPH_ALPHA = 200

# A tab icon needs an optical margin, or the descenders and the dots of ة sit on
# the edge and the mark reads as clipped. The 16px fallback is the exception:
# four Arabic letters in sixteen pixels cannot afford the padding.
MARGIN = 0.92
TIGHT = 1.0


def glyph() -> Image.Image:
    """The wordmark alone: shadow dropped, trimmed, flattened to the app's ink."""
    image = Image.open(LOGO).convert('RGBA')
    alpha = np.array(image)[:, :, 3]

    # Soften the threshold instead of binarising: keep the antialiased edge,
    # discard everything that is only shadow.
    cleaned = np.clip((alpha.astype(np.int16) - 128) * 255 // 127, 0, 255).astype(np.uint8)

    canvas = np.zeros((image.height, image.width, 4), np.uint8)
    canvas[..., 0:3] = INK
    canvas[..., 3] = cleaned

    flat = Image.fromarray(canvas, 'RGBA')
    box = flat.getbbox()
    if box is None:
        raise SystemExit(f'make-assets: {LOGO} is fully transparent')
    return flat.crop(box)


def fit(mark: Image.Image, width: int) -> Image.Image:
    return mark.resize((width, max(1, round(mark.height * width / mark.width))), Image.LANCZOS)


def square(mark: Image.Image, size: int, fraction: float, fill=None) -> Image.Image:
    """The wordmark centred in a square, never wider than `fraction` of it."""
    canvas = Image.new('RGBA', (size, size), fill or (0, 0, 0, 0))
    scaled = fit(mark, round(size * fraction))
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas


def num(value: float) -> str:
    return f'{float(value):.2f}'.rstrip('0').rstrip('.')


def trace_svg(mark: Image.Image, size: int = 100, fraction: float = MARGIN) -> str:
    """Vectorise the wordmark and hand the browser a theme-aware favicon."""
    mask = np.array(mark)[:, :, 3] > GLYPH_ALPHA
    height, width = mask.shape

    # pypotrace flips black and white in its constructor, so the glyph has to
    # go in as the white region.
    path = potrace.Bitmap(~mask).trace(turdsize=2, alphamax=1.0, opticurve=1, opttolerance=0.2)

    parts = []
    for curve in path:
        start = curve.start_point
        parts.append(f'M{num(start.x)} {num(start.y)}')
        for segment in curve:
            if segment.is_corner:
                corner, end = segment.c, segment.end_point
                parts.append(f'L{num(corner.x)} {num(corner.y)} {num(end.x)} {num(end.y)}')
            else:
                c1, c2, end = segment.c1, segment.c2, segment.end_point
                parts.append(
                    f'C{num(c1.x)} {num(c1.y)} {num(c2.x)} {num(c2.y)} {num(end.x)} {num(end.y)}'
                )
        parts.append('Z')

    scale = (size * fraction) / width
    tx = (size - width * scale) / 2
    ty = (size - height * scale) / 2

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'role="img" aria-label="تلاوة">\n'
        '  <!-- One mark, two colour schemes: a raster would have to pick one. -->\n'
        '  <style>\n'
        f'    path {{ fill: #{INK[0]:02x}{INK[1]:02x}{INK[2]:02x}; }}\n'
        '    @media (prefers-color-scheme: dark) { path { fill: #f2f2f2; } }\n'
        '  </style>\n'
        f'  <g transform="translate({tx:.4f} {ty:.4f}) scale({scale:.6f})">\n'
        f'    <path d="{"".join(parts)}"/>\n'
        '  </g>\n'
        '</svg>\n'
    )


def share_card(mark: Image.Image) -> Image.Image:
    """The 1200x630 link preview.

    `summary_large_image` crops nothing at 1.91:1, so the card is authored at
    exactly that ratio and the artwork sits inside the 10% safe margin every
    scraper respects. Opaque white, because a transparent canvas is composited
    onto whatever the timeline happens to use, and a scraper that meets alpha
    usually fills it with black.
    """
    width, height = SHARE_SIZE
    card = Image.new('RGBA', (width, height), WHITE)

    wordmark = fit(mark, round(width * 0.46))
    draw = ImageDraw.Draw(card)

    url_text = 'tilawa.quran.us.kg'
    url_size = 30
    url_font = latin_font(url_size)
    url_box = draw.textbbox((0, 0), url_text, font=url_font)
    url_height = url_box[3] - url_box[1]

    gap = 56
    block = wordmark.height + gap + url_height
    top = (height - block) // 2

    card.alpha_composite(wordmark, ((width - wordmark.width) // 2, top))

    # A URL is not brand type; a neutral face is the honest choice and keeps the
    # script free of a webfont decoder.
    baseline = top + wordmark.height + gap
    draw.text(
        ((width - (url_box[2] - url_box[0])) // 2 - url_box[0], baseline - url_box[1]),
        url_text,
        font=url_font,
        fill=(107, 107, 107, 255),  # #6b6b6b, the app's --muted
    )
    return card.convert('RGB')


def latin_font(size: int) -> ImageFont.FreeTypeFont:
    for path in (
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/TTF/DejaVuSans.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main() -> None:
    mark = glyph()

    (PUBLIC / 'favicon.svg').write_text(trace_svg(mark))

    # Browser tab: transparent, because the tab strip is the background.
    square(mark, 16, TIGHT).save(PUBLIC / 'icons' / 'favicon-16.png')
    square(mark, 32, MARGIN).save(PUBLIC / 'icons' / 'favicon-32.png')
    square(mark, 64, MARGIN).save(PUBLIC / 'icons' / 'favicon-64.png')

    # .ico carries one image per size; Windows and the odd old crawler pick a
    # frame, so the 16px frame is composed at 16px instead of downsampled.
    frames = [square(mark, s, TIGHT if s == 16 else MARGIN) for s in (16, 32, 48, 64)]
    frames[-1].save(
        PUBLIC / 'favicon.ico',
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
        append_images=frames[:-1],
    )

    # Launchers: opaque, because the platform supplies the background or masks
    # the edges away.
    square(mark, 180, 0.72, WHITE).save(PUBLIC / 'icons' / 'apple-touch-icon.png')
    square(mark, 192, 0.72, WHITE).save(PUBLIC / 'icons' / 'icon-192.png')
    square(mark, 512, 0.72, WHITE).save(PUBLIC / 'icons' / 'icon-512.png')
    # A maskable is cropped to a circle of 80% of the canvas, so the artwork
    # has to stay well inside it.
    square(mark, 512, 0.50, WHITE).save(PUBLIC / 'icons' / 'maskable-512.png')

    share_card(mark).save(PUBLIC / 'og.png')


if __name__ == '__main__':
    main()
