"""Generate the simple Chrome Web Store promo tile."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "store-assets"

PAPER = (246, 241, 231, 255)
INK = (26, 25, 22, 255)
ACCENT = (37, 74, 132, 255)

TITLE_FONTS = (
    "C:/Windows/Fonts/georgiab.ttf",
    "C:/Windows/Fonts/Georgia Bold.ttf",
    "C:/Windows/Fonts/timesbd.ttf",
)
TAGLINE_FONTS = (
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
)


def load_font(size, *candidates):
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def fit_font(text, max_width, sizes, *candidates):
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1), (0, 0, 0, 0)))
    for size in sizes:
        font = load_font(size, *candidates)
        left, _, right, _ = probe.textbbox((0, 0), text, font=font)
        if right - left <= max_width:
            return font
    return load_font(sizes[-1], *candidates)


def box_size(draw, text, font):
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def make_promo():
    width, height = 440, 280
    img = Image.new("RGBA", (width, height), PAPER)
    draw = ImageDraw.Draw(img)

    icon_size = 144
    icon_x = 34
    icon_y = (height - icon_size) // 2
    icon = Image.open(ROOT / "icons" / "icon-96.png").convert("RGBA")
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    img.alpha_composite(icon, (icon_x, icon_y))

    title = "The Missing Link"
    tagline = "Find the case fast."
    text_x = icon_x + icon_size + 22
    max_text_width = width - text_x - 24

    title_font = fit_font(title, max_text_width, list(range(30, 21, -1)), *TITLE_FONTS)
    tagline_font = load_font(17, *TAGLINE_FONTS)

    _, title_h = box_size(draw, title, title_font)
    _, tagline_h = box_size(draw, tagline, tagline_font)
    gap = 10
    block_h = title_h + gap + tagline_h
    text_y = (height - block_h) // 2 - 2

    draw.text((text_x, text_y), title, font=title_font, fill=INK)
    draw.text((text_x + 1, text_y + title_h + gap), tagline, font=tagline_font, fill=ACCENT)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img.save(OUT_DIR / "chrome-small-promo-440x280.png", "PNG", optimize=True)


if __name__ == "__main__":
    make_promo()
