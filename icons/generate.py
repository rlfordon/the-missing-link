"""Generate the extension icon (brackets-with-ellipsis on paper).

Design: serif-style brackets `[ ... ]` in ink, on a paper-cream rounded
square, with a small ink-blue underline accent. Matches the popup's
editorial palette.

Renders at 4x supersample then downsamples for crisp small-size output.
"""

from PIL import Image, ImageDraw

PAPER = (246, 241, 231, 255)   # --paper #f6f1e7
INK = (26, 25, 22, 255)        # --ink #1a1916
ACCENT = (29, 63, 110, 255)    # --accent #1d3f6e
RULE = (217, 209, 189, 255)    # --rule #d9d1bd

SCALE = 4  # supersample factor

def draw_icon(size_px: int) -> Image.Image:
    s = size_px * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Bracket geometry (in normalized 0..1, then scaled).
    # Brackets sit right at the canvas border so the mark reads as the
    # dominant element, not as small content floating inside a card.
    stroke = int(0.07 * s)             # vertical stroke thickness
    serif_len = int(0.18 * s)          # how far the top/bottom serif extends inward
    serif_thick = int(0.07 * s)        # serif thickness
    bracket_top = int(0.05 * s)
    bracket_bot = int(0.95 * s)
    left_x = int(0.04 * s)
    right_x = int(0.96 * s) - stroke

    # Left bracket
    d.rectangle((left_x, bracket_top, left_x + stroke, bracket_bot), fill=INK)
    d.rectangle((left_x, bracket_top, left_x + stroke + serif_len, bracket_top + serif_thick), fill=INK)
    d.rectangle((left_x, bracket_bot - serif_thick, left_x + stroke + serif_len, bracket_bot), fill=INK)

    # Right bracket
    d.rectangle((right_x, bracket_top, right_x + stroke, bracket_bot), fill=INK)
    d.rectangle((right_x - serif_len, bracket_top, right_x + stroke, bracket_top + serif_thick), fill=INK)
    d.rectangle((right_x - serif_len, bracket_bot - serif_thick, right_x + stroke, bracket_bot), fill=INK)

    # Ellipsis: three dots, centered between brackets at true vertical
    # center (no underline below to bias it lower). Larger dots so the
    # mark stays legible at toolbar size.
    dot_r = int(0.07 * s)
    dot_y = int(0.50 * s)
    cx = s // 2
    gap = int(0.20 * s)
    for offset in (-gap, 0, gap):
        x = cx + offset
        d.ellipse((x - dot_r, dot_y - dot_r, x + dot_r, dot_y + dot_r), fill=INK)

    # Downsample to target size with high-quality resampling.
    return img.resize((size_px, size_px), Image.LANCZOS)


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for sz in (48, 96):
        img = draw_icon(sz)
        out = os.path.join(here, f"icon-{sz}.png")
        img.save(out, "PNG", optimize=True)
        print(f"wrote {out}")
