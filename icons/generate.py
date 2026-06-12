"""Generate the extension icon (brackets-with-ellipsis on paper).

Design: serif-style brackets `[ ... ]` in ink, on a paper-cream rounded
tile with a subtle shadow. The backing keeps the mark legible on arbitrary
Firefox toolbar theme colors.

Renders at 4x supersample then downsamples for crisp small-size output.
Small toolbar sizes use a tighter layout so the icon doesn't read as shrunken
next to neighboring extension buttons.
"""

from PIL import Image, ImageDraw, ImageFilter

PAPER = (246, 241, 231, 255)   # --paper #f6f1e7
INK = (26, 25, 22, 255)        # --ink #1a1916
RULE = (217, 209, 189, 255)    # --rule #d9d1bd
SHADOW = (0, 0, 0, 80)

SCALE = 4  # supersample factor

def draw_icon(size_px: int) -> Image.Image:
    s = size_px * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    compact = size_px <= 32

    card_pad = 0
    card_radius = int((0.17 if compact else 0.19) * s)
    card_box = (card_pad, card_pad, s - card_pad, s - card_pad)

    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    shadow_offset = int((0.015 if compact else 0.02) * s)
    sd.rounded_rectangle(
        (
            card_box[0] + shadow_offset,
            card_box[1] + shadow_offset,
            card_box[2] + shadow_offset,
            card_box[3] + shadow_offset,
        ),
        radius=card_radius,
        fill=SHADOW,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(0.018 * s)))
    img.alpha_composite(shadow)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle(
        card_box,
        radius=card_radius,
        fill=PAPER,
        outline=RULE,
        width=max(1, int((0.012 if compact else 0.014) * s)),
    )

    # Bracket geometry (in normalized 0..1, then scaled). Small toolbar sizes
    # are drawn chunkier and closer to the card edges so the icon fills the
    # browser's 16px slot instead of reading like a tiny badge.
    stroke = int((0.07 if compact else 0.062) * s)
    serif_len = int((0.155 if compact else 0.145) * s)
    serif_thick = int((0.07 if compact else 0.062) * s)
    bracket_top = int((0.17 if compact else 0.19) * s)
    bracket_bot = int((0.83 if compact else 0.81) * s)
    left_x = int((0.12 if compact else 0.15) * s)
    right_x = int((0.88 if compact else 0.85) * s) - stroke

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
    dot_y = int(0.50 * s)
    cx = s // 2
    dot_r = int((0.068 if compact else 0.062) * s)
    gap = int((0.15 if compact else 0.155) * s)
    for offset in (-gap, 0, gap):
        x = cx + offset
        d.ellipse((x - dot_r, dot_y - dot_r, x + dot_r, dot_y + dot_r), fill=INK)

    # Downsample to target size with high-quality resampling.
    out = img.resize((size_px, size_px), Image.LANCZOS)

    # Toolbar icons at 16px need a deliberately simplified center mark. Three
    # literal tiny dots get mushy, so redraw the center as a sturdier
    # ellipsis-like horizontal glyph after downsampling.
    if size_px == 16:
        td = ImageDraw.Draw(out)
        td.rounded_rectangle((4, 7, 11, 8), radius=1, fill=INK)
        td.rectangle((6, 7, 6, 8), fill=PAPER)
        td.rectangle((9, 7, 9, 8), fill=PAPER)

    return out


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for sz in (16, 32, 48, 96, 128):
        img = draw_icon(sz)
        out = os.path.join(here, f"icon-{sz}.png")
        img.save(out, "PNG", optimize=True)
        print(f"wrote {out}")
