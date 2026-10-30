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


def main() -> None:
    mark = wordmark()

    # Browser tab: transparent and as wide as a 32px slot allows — a wordmark
    # loses too much detail with the padding the larger icons can afford.
    favicon32 = square_icon(mark, 32, None, 0.9)
    favicon32.save(PUBLIC / 'favicon-32.png')

    # iOS adds its own mask and paints transparency black, so this one needs a
    # background — the same one the splash uses.
    square_icon(mark, 180, PLATE).save(PUBLIC / 'apple-touch-icon.png')

    # PWA: full-bleed plate so `purpose: any maskable` can crop without clipping.
    square_icon(mark, 192, PLATE).save(PUBLIC / 'icon-192.png')
    square_icon(mark, 512, PLATE).save(PUBLIC / 'icon-512.png')

    # .ico carries several sizes in one file; Windows picks per context.
    favicon32.save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

    # In-app lockup: the trimmed wordmark, so the header mark is the brand rather
    # than a letterform that only resembles it.
    fit(mark, 512).save(PUBLIC / 'logo-wordmark.png')

    # Share card: the wordmark plus a latin line, because the artwork itself is
    # Arabic and a link preview may be read by someone who does not know it.
    og = Image.new('RGBA', (1200, 630), WHITE)
    draw = ImageDraw.Draw(og)
    big = fit(mark, 520)
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
