# -*- coding: utf-8 -*-
"""Compile CastleHUD digit bitmap font (0-9 . x m % + - :)."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1] / "www" / "castle-parkour" / "assets" / "fonts"
CHARS = list("0123456789.") + ["x", "m", "%", "+", "-", ":"]
CELL_W, CELL_H = 96, 128


def pick_font(size: int = 78) -> ImageFont.FreeTypeFont:
    for path in (
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit("no CJK/UI font found")


def render_glyph(ch: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    canvas = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    tmp = Image.new("L", (CELL_W, CELL_H), 0)
    td = ImageDraw.Draw(tmp)
    bbox = td.textbbox((0, 0), ch, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (CELL_W - tw) // 2 - bbox[0]
    y = (CELL_H - th) // 2 - bbox[1] - 4

    mask = Image.new("L", (CELL_W, CELL_H), 0)
    ImageDraw.Draw(mask).text((x, y), ch, font=font, fill=255)
    outline = mask.filter(ImageFilter.MaxFilter(7))
    glow = outline.filter(ImageFilter.GaussianBlur(3))

    base = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    g = Image.new("RGBA", (CELL_W, CELL_H), (80, 40, 140, 0))
    g.putalpha(glow.point(lambda p: min(180, p)))
    base = Image.alpha_composite(base, g)

    gold = Image.new("RGBA", (CELL_W, CELL_H), (212, 168, 72, 0))
    gold.putalpha(outline)
    base = Image.alpha_composite(base, gold)

    erode = mask.filter(ImageFilter.MinFilter(5))
    stone = Image.new("RGBA", (CELL_W, CELL_H), (55, 52, 48, 0))
    stone.putalpha(erode)
    base = Image.alpha_composite(base, stone)

    hi = Image.new("RGBA", (CELL_W, CELL_H), (240, 220, 160, 0))
    ha = erode.filter(ImageFilter.GaussianBlur(1)).point(lambda p: int(p * 0.35) if p else 0)
    ha_px = ha.load()
    for yy in range(CELL_H // 2, CELL_H):
        for xx in range(CELL_W):
            ha_px[xx, yy] = 0
    hi.putalpha(ha)
    return Image.alpha_composite(base, hi)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    font = pick_font()
    atlas = Image.new("RGBA", (CELL_W * len(CHARS), CELL_H), (0, 0, 0, 0))
    glyphs: dict[str, dict] = {}
    for i, ch in enumerate(CHARS):
        g = render_glyph(ch, font)
        atlas.paste(g, (i * CELL_W, 0), g)
        bb = g.split()[-1].getbbox() or (8, 8, CELL_W - 8, CELL_H - 8)
        glyphs[ch] = {
            "x": i * CELL_W,
            "y": 0,
            "w": CELL_W,
            "h": CELL_H,
            "ox": 0,
            "oy": 0,
            "advance": max(28, bb[2] - bb[0] + 10),
            "content": [bb[0], bb[1], bb[2], bb[3]],
        }
    atlas.save(OUT / "castle-hud-digits.png")
    meta = {
        "name": "CastleHUD",
        "cellW": CELL_W,
        "cellH": CELL_H,
        "lineHeight": 110,
        "baseline": 100,
        "glyphs": glyphs,
    }
    (OUT / "castle-hud-digits.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("wrote", OUT / "castle-hud-digits.png", "glyphs", len(glyphs))


if __name__ == "__main__":
    main()
