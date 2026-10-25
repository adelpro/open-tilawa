#!/usr/bin/env python3
"""Generate the brand bits the browser and a link preview ask for.

Run by hand, not at build: the icons and the share image are brand assets, and the
Docker build stage is node-only. `apps/web/public/` is copied verbatim into `dist/`
by Vite, so the outputs land in the image with no extra step.

    python3 apps/web/scripts/make-assets.py

Design: the accent `#086288` on the canvas cream `#ffefc4`, and two concentric rings
— the mark is a sound, not a letter. No font is needed for the icon, which is why it
stays legible at 16px in every renderer; the share image uses DejaVu because it is a
picture, not a logo.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

PUBLIC = Path(__file__).resolve().parents[1] / 'public'
ACCENT = (8, 98, 136, 255)
CREAM = (255, 239, 196, 255)
INK = (28, 28, 30, 255)
MUTED = (90, 90, 96, 255)

BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def mark(size: int) -> Image.Image:
    """The icon: cream tile, accent rings, drawn at 4x and downsampled."""
    scale = 4
    canvas = size * scale
    image = Image.new('RGBA', (canvas, canvas), CREAM)
    draw = ImageDraw.Draw(image)
    centre = canvas / 2
    for radius, width in ((canvas * 0.34, canvas * 0.085), (canvas * 0.17, canvas * 0.06)):
        draw.ellipse(
            [centre - radius, centre - radius, centre + radius, centre + radius],
            outline=ACCENT,
            width=max(1, int(width)),
        )
    draw.ellipse(
        [centre - canvas * 0.045, centre - canvas * 0.045, centre + canvas * 0.045, centre + canvas * 0.045],
        fill=ACCENT,
    )
    return image.resize((size, size), Image.LANCZOS)


def share_image() -> Image.Image:
    width, height = 1200, 630
    image = Image.new('RGB', (width, height), CREAM)
    draw = ImageDraw.Draw(image)

    # Rings, same mark, sized to the canvas rather than copied from the icon.
    centre = (330, height / 2)
    for radius, thickness in ((150, 22), (78, 16)):
        draw.ellipse(
            [centre[0] - radius, centre[1] - radius, centre[0] + radius, centre[1] + radius],
            outline=ACCENT,
            width=thickness,
        )
    draw.ellipse(
        [centre[0] - 16, centre[1] - 16, centre[0] + 16, centre[1] + 16],
        fill=ACCENT,
    )

    title = ImageFont.truetype(BOLD, 96)
    lead = ImageFont.truetype(REGULAR, 38)
    small = ImageFont.truetype(REGULAR, 26)

    x = 560
    draw.text((x, 190), 'Uslub', font=title, fill=INK)
    draw.text((x, 310), 'Your writing voice,', font=lead, fill=MUTED)
    draw.text((x, 358), 'wherever you write.', font=lead, fill=MUTED)
    draw.text((x, 470), 'uslub.adelpro.us.kg', font=small, fill=ACCENT)
    return image


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)

    icon = mark(512)
    icon.save(PUBLIC / 'icon-512.png')
    mark(180).save(PUBLIC / 'apple-touch-icon.png')
    mark(32).save(PUBLIC / 'favicon-32.png')
    # A one-entry ICO is a valid ICO, and every browser since IE11 reads PNG entries.
    mark(64).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (64, 64)])

    share_image().save(PUBLIC / 'og.png', optimize=True)
    print('wrote:', sorted(p.name for p in PUBLIC.glob('*.png')) + ['favicon.ico'])


if __name__ == '__main__':
    main()
