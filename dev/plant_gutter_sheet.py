# -*- coding: utf-8 -*-
"""Plant any whole guttered sheet: sheet_k = game_run0 / sheet_run0; eye-safe."""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from replant_all_action_sheets import (  # noqa: E402
    ASSETS,
    CH,
    CW,
    FOOT,
    MARGIN,
    RAW,
    WWW,
    chroma,
    content_box,
    crop_alpha,
    scale_k,
)

ALPHA = 28
CURSOR = Path(r"C:\Users\lin\.cursor\projects\e-Users-lin-Desktop-Home-XRK-AGT\assets")


def upper_w(cell: np.ndarray) -> int | None:
    ys, xs = np.where(cell[:, :, 3] > ALPHA)
    if len(ys) == 0:
        return None
    y0, y1 = int(ys.min()), int(ys.max())
    h = y1 - y0 + 1
    y_end = y0 + max(12, int(h * 0.40))
    region = cell[y0:y_end, int(xs.min()) : int(xs.max()) + 1, 3] > ALPHA
    if not region.any():
        return None
    return int(region.sum(axis=1).max())


def face_white(cell: np.ndarray) -> int:
    r, g, b, al = cell[:, :, 0].astype(int), cell[:, :, 1].astype(int), cell[:, :, 2].astype(int), cell[:, :, 3]
    ys, xs = np.where(al > 40)
    if len(ys) == 0:
        return 0
    y0, y1 = int(ys.min()), int(ys.max())
    h = y1 - y0 + 1
    fy0, fy1 = y0 + int(h * 0.08), y0 + int(h * 0.45)
    band = (slice(fy0, fy1), slice(int(xs.min()), int(xs.max()) + 1))
    return int(((al[band] > 40) & (r[band] > 200) & (g[band] > 200) & (b[band] > 200)).sum())


def eye_safe_defringe(im: Image.Image, passes: int = 2) -> Image.Image:
    a = np.array(im.convert("RGBA"))
    H, W = a.shape[:2]
    for _ in range(passes):
        al = a[:, :, 3]
        r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
        pad = np.pad(al <= 20, 1, constant_values=True)
        edge = np.zeros((H, W), bool)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            edge |= pad[1 + dy : H + 1 + dy, 1 + dx : W + 1 + dx]
        whiteish = (r > 185) & (g > 185) & (b > 185)
        cream = (r > 150) & (g > 125) & (b < 210) & (r > b + 6)
        skin = (r > 140) & (g > 90) & (b > 70) & (r > b) & (r < 230)
        cyan = (b > 140) & (g > 140) & (r < 180)  # warrior visor
        protect = whiteish | cream | skin | cyan
        hot = (
            edge
            & (al > 15)
            & (r > 200)
            & (b > 200)
            & (g < 110)
            & (np.abs(r - b) < 45)
            & ~protect
        )
        a[hot, 3] = 0
    r, g, b, al = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int), a[:, :, 3]
    whiteish = (r > 185) & (g > 185) & (b > 185)
    hot2 = (al > 8) & (r > 210) & (b > 210) & (g < 95) & (np.abs(r - b) < 40) & ~whiteish
    a[hot2, 3] = 0
    return Image.fromarray(a, "RGBA")


def plant_foot(crop: Image.Image) -> Image.Image:
    max_w, max_h = CW - 2 * MARGIN, FOOT - MARGIN
    fit = min(max_w / max(1, crop.width), max_h / max(1, crop.height), 1.0)
    if fit < 1.0:
        crop = scale_k(crop, fit)
    out = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    x = (CW - crop.width) // 2
    y = FOOT - crop.height
    if y < MARGIN:
        y = MARGIN
    out.paste(crop, (x, y), crop)
    return out


def plant(char: str, role: str, src_name: str, cols: int, rows: int, ver: str) -> int:
    src = CURSOR / src_name
    if not src.exists():
        src = RAW / src_name
    if not src.exists():
        raise FileNotFoundError(src_name)
    shutil.copy2(src, RAW / src_name)

    game_run0 = Image.open(ASSETS / "characters" / char / f"{char}-run-sheet.png").convert(
        "RGBA"
    ).crop((0, 0, CW, CH))
    w_game = upper_w(np.array(game_run0))
    assert w_game

    keyed = eye_safe_defringe(chroma(Image.open(src).convert("RGBA")), passes=2)
    keyed.save(RAW / src_name.replace(".png", "-keyed.png"))

    W, H = keyed.size
    cw, ch = W // cols, H // rows
    n = cols * rows
    crops = []
    for i in range(n):
        ri, ci = divmod(i, cols)
        c = crop_alpha(keyed.crop((ci * cw, ri * ch, (ci + 1) * cw, (ri + 1) * ch)))
        crops.append(c)
        print(f"  crop{i}: {c.size} uw={upper_w(np.array(c))} eyeW={face_white(np.array(c))}")

    w_sheet = upper_w(np.array(crops[0]))
    assert w_sheet and w_sheet > 20
    sheet_k = w_game / w_sheet
    print(f"  sheet_k={sheet_k:.3f} game={w_game} sheet_run0={w_sheet}")

    out = Image.new("RGBA", (CW * cols, CH * rows), (0, 0, 0, 0))
    for i in range(1, n - 1):
        ri, ci = divmod(i, cols)
        scaled = scale_k(crops[i], sheet_k)
        uw2 = upper_w(np.array(scaled))
        if uw2 and uw2 > 8:
            ratio = uw2 / w_game
            if ratio < 0.88 or ratio > 1.12:
                nudge = w_game / uw2
                print(f"  NUDGE c{i} ratio={ratio:.3f} x{nudge:.3f}")
                scaled = scale_k(scaled, nudge)
        planted = plant_foot(scaled)
        out.paste(planted, (ci * CW, ri * CH))
    out.paste(game_run0, (0, 0))
    ri, ci = divmod(n - 1, cols)
    out.paste(game_run0, (ci * CW, ri * CH))

    dest = ASSETS / "characters" / char / f"{char}-{role}-sheet.png"
    out.save(dest)

    a = np.array(out)
    fails = 0
    for i in range(n):
        ri, ci = divmod(i, cols)
        cell = a[ri * CH : (ri + 1) * CH, ci * CW : (ci + 1) * CW]
        uw = upper_w(cell)
        ratio = uw / w_game if uw else 0
        ok = 0.88 <= ratio <= 1.12
        if not ok:
            fails += 1
        print(f"  audit c{i}: {'OK' if ok else 'FAIL'} ratio={ratio:.3f} eyeW={face_white(cell)}")
    print(f"wrote {dest} FAIL={fails}")

    for rel in ["js/config/characters.js", "js/boot-mobile.js", "build-id.txt", "index.html"]:
        p = WWW / rel
        s = p.read_text(encoding="utf-8")
        if rel.endswith("build-id.txt"):
            s = ver + "\n"
        else:
            s = re.sub(r"20260821[a-z]+", ver, s)
        p.write_text(s, encoding="utf-8", newline="\n")
    print("ver", ver)
    return fails


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--char", required=True)
    ap.add_argument("--role", required=True)
    ap.add_argument("--src", required=True)
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--ver", required=True)
    args = ap.parse_args()
    fails = plant(args.char, args.role, args.src, args.cols, args.rows, args.ver)
    raise SystemExit(1 if fails else 0)


if __name__ == "__main__":
    main()
