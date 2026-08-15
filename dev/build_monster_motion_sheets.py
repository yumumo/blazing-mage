#!/usr/bin/env python3
"""从单帧立绘生成 2×2 运动 sheet（四宫格）。"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "www" / "castle-parkour" / "assets"
CELL = 512
COLS = 2
ROWS = 2
FOOT_GAP = 10


def trim_alpha(im: Image.Image, thr: int = 12) -> Image.Image:
    a = im.split()[-1]
    bbox = a.point(lambda p: 255 if p > thr else 0).getbbox()
    if not bbox:
        return im
    return im.crop(bbox)


def fit_bottom(src: Image.Image, cell: int = CELL, foot_gap: int = FOOT_GAP, sx: float = 1.0, sy: float = 1.0) -> Image.Image:
    """装入 cell，脚底对齐；sx/sy 做轻微形变（拍翅/呼吸）。"""
    src = trim_alpha(src.convert("RGBA"))
    w, h = src.size
    nw = max(1, int(w * sx))
    nh = max(1, int(h * sy))
    warped = src.resize((nw, nh), Image.Resampling.LANCZOS)
    max_w = int(cell * 0.92)
    max_h = cell - foot_gap - 8
    scale = min(max_w / nw, max_h / nh, 1.0)
    fw = max(1, int(nw * scale))
    fh = max(1, int(nh * scale))
    fitted = warped.resize((fw, fh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    x = (cell - fw) // 2
    y = cell - foot_gap - fh
    out.alpha_composite(fitted, (x, y))
    return out


def build_sheet(src_path: Path, out_path: Path, kind: str) -> None:
    src = Image.open(src_path).convert("RGBA")
    if kind == "fly":
        scales = [
            (1.00, 1.00),
            (1.08, 0.94),
            (0.92, 1.06),
            (1.06, 0.96),
        ]
    else:
        scales = [
            (1.00, 1.00),
            (1.04, 0.96),
            (1.10, 0.90),
            (1.06, 0.94),
        ]
    sheet = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    for i, (sx, sy) in enumerate(scales):
        frame = fit_bottom(src, sx=sx, sy=sy)
        row, col = divmod(i, COLS)
        sheet.alpha_composite(frame, (col * CELL, row * CELL))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"wrote {out_path.name} {sheet.size} grid={COLS}x{ROWS}")


def main() -> None:
    jobs = [
        (ROOT / "bat.png", ROOT / "bat-sheet.png", "fly"),
        (ROOT / "flyer.png", ROOT / "flyer-sheet.png", "fly"),
        (ROOT / "monster-big.png", ROOT / "giant-sheet.png", "ground"),
    ]
    for src, dst, kind in jobs:
        if not src.exists():
            raise SystemExit(f"missing {src}")
        build_sheet(src, dst, kind)


if __name__ == "__main__":
    main()
