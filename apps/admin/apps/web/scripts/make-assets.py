#!/usr/bin/env python3
"""Generate the brand bits the browser and a link preview ask for.

The source of truth is `public/logo.png` — the تلاوة wordmark the public web app
also ships. There is no vector version of the mark in the repository, so every
icon is rasterised from that one image: trimming its transparent padding first
is what keeps the wordmark legible at 32px.

Run by hand, not at build: the icons are brand assets, and the Docker build
stage is node-only. `apps/web/public/` is copied verbatim into `dist/` by Vite,
so the outputs land in the image with no extra step.

    python3 apps/web/scripts/make-assets.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PUBLIC = Path(__file__).resolve().parents[1] / 'public'
LOGO = PUBLIC / 'logo.png'

# The wordmark's own ink, sampled from logo.png; matching it keeps the raster
# icons and the artwork indistinguishable.
INK = (31, 77, 120, 255)
# The icons are aligned with the web app's: the same flattened #111 mark the
# public site ships, not the navy original with its drop shadow.
ICON_INK = (17, 17, 17, 255)
GREY = (92, 99, 112, 255)
WHITE = (255, 255, 255, 255)

# The launcher icon and the install splash are one artwork, so the plate has to be
# the splash field: `background_color` in app.json is where both get it from. A
# plate that disagrees with the field draws the icon as a box on the splash.
APP = json.loads((Path(__file__).resolve().parents[1] / 'app.json').read_text())
PLATE = tuple(int(APP['manifest']['background_color'][i : i + 2], 16) for i in (1, 3, 5)) + (255,)


def wordmark() -> Image.Image:
    """The logo with its transparent margins removed."""
    image = Image.open(LOGO).convert('RGBA')
    box = image.getbbox()
    if box is None:
        raise SystemExit(f'make-assets: {LOGO} is fully transparent')
    return image.crop(box)


def glyph() -> Image.Image:
    """The mark the public site ships: shadow dropped, flattened to #111.

    The source logo is navy with a soft shadow baked into its alpha. The web's
    `make-assets.py` thresholds that alpha and forces the ink, so the two apps'
    launcher tiles read as one brand; this is the same operation, kept here so
    the console does not depend on the other app's build.
    """
    image = Image.open(LOGO).convert('RGBA')
    # Keep the antialiased edge, discard the shadow: below half alpha is shadow.
    alpha = image.getchannel('A').point(
        lambda a: 0 if a <= 128 else min(255, (a - 128) * 255 // 127)
    )
    flat = Image.new('RGBA', image.size, ICON_INK[:3] + (0,))
    flat.putalpha(alpha)
    box = flat.getbbox()
    if box is None:
        raise SystemExit(f'make-assets: {LOGO} is fully transparent')
    return flat.crop(box)


def fit(mark: Image.Image, width: int) -> Image.Image:
    height = max(1, round(mark.height * width / mark.width))
    return mark.resize((width, height), Image.LANCZOS)


def square_icon(
    mark: Image.Image,
    size: int,
    fill: tuple[int, int, int, int] | None,
    width_fraction: float = 0.78,
) -> Image.Image:
    """The wordmark centred in a square, never wider than `width_fraction` of it."""
    canvas = Image.new('RGBA', (size, size), fill or (0, 0, 0, 0))
    scaled = fit(mark, round(size * width_fraction))
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    for base in ('/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/TTF'):
        candidate = Path(base) / name
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def lockup(
    mark: Image.Image,
    size: int,
    fill: tuple[int, int, int, int] | None,
    width_fraction: float = 0.72,
) -> Image.Image:
    """The shared mark with ADMIN above it, on the plate the launcher paints.

    The wordmark keeps the web app's 0.72 width, so the two icons sit at the same
    scale side by side; the label is the only thing the console adds. It is
    letter-spaced by hand because PIL has no tracking, and the label's cap height
    is what the block is centred on — not the font's line box, which includes
    ascender space the eye does not read.
    """
    canvas = Image.new('RGBA', (size, size), fill or (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    label = 'ADMIN'
    label_size = max(3, round(size * 0.058))
    face = font(label_size, bold=True)
    tracking = max(1, round(size * 0.014))
    widths = [draw.textlength(char, font=face) for char in label]
    label_width = sum(widths) + tracking * (len(label) - 1)
    box = draw.textbbox((0, 0), label, font=face)
    label_height = box[3] - box[1]

    mark_width = round(size * width_fraction)
    scaled = fit(mark, mark_width)
    gap = round(size * 0.045)
    block = label_height + gap + scaled.height
    top = (size - block) // 2

    x = (size - label_width) / 2
    for char, char_width in zip(label, widths):
        draw.text((x, top - box[1]), char, font=face, fill=GREY)
        x += char_width + tracking

    canvas.alpha_composite(scaled, ((size - mark_width) // 2, top + label_height + gap))
    return canvas


def main() -> None:
    # The icons use the flattened mark the public site ships; the in-app wordmark
    # and the share card keep the navy original they were designed with.
    mark = glyph()
    brand = wordmark()

    # Browser tab: transparent, mark plus the console's label. The 16px frame is
    # the mark alone — "ADMIN" at sixteen pixels is a smudge, not a word.
    favicon16 = square_icon(mark, 16, None, 1.0)
    favicon32 = lockup(mark, 32, None)
    favicon48 = lockup(mark, 48, None)
    favicon32.save(PUBLIC / 'favicon-32.png')
    frames = [favicon16, favicon32, favicon48]
    frames[-1].save(
        PUBLIC / 'favicon.ico',
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=frames[:-1],
    )

    # iOS adds its own mask and paints transparency black, so this one needs a
    # background — the same one the splash uses.
    lockup(mark, 180, PLATE).save(PUBLIC / 'apple-touch-icon.png')

    # PWA: full-bleed plate so `purpose: any maskable` can crop without clipping.
    lockup(mark, 192, PLATE).save(PUBLIC / 'icon-192.png')
    lockup(mark, 512, PLATE).save(PUBLIC / 'icon-512.png')

    # In-app lockup: the trimmed wordmark, so the header mark is the brand rather
    # than a letterform that only resembles it. This one stays navy: it is the
    # console's own chrome, not the launcher tile.
    fit(brand, 512).save(PUBLIC / 'logo-wordmark.png')

    # Share card: the wordmark plus a latin line, because the artwork itself is
    # Arabic and a link preview may be read by someone who does not know it.
    og = Image.new('RGBA', (1200, 630), WHITE)
    draw = ImageDraw.Draw(og)
    big = fit(brand, 520)
    og.alpha_composite(big, ((1200 - big.width) // 2, 180))
    draw.text((600, 400), 'Tilawa Admin', font=font(56, bold=True), fill=INK, anchor='mm')
    draw.text(
        (600, 468),
        'Quran audio distribution: seeders, TURN, torrents and reciters',
        font=font(26),
        fill=GREY,
        anchor='mm',
    )
    og.convert('RGB').save(PUBLIC / 'og.png')

    print(
        'wrote:',
        ', '.join(
            sorted(
                name.name
                for name in PUBLIC.glob('*')
                if name.suffix in {'.png', '.ico'} and name.name != 'logo.png'
            )
        ),
    )


if __name__ == '__main__':
    main()
