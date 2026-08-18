# -*- coding: utf-8 -*-
"""Rebuild 3x3 roll sheets: game run0 bookends + locked-diameter ball spins.

Extracts best ball-like mid crop from a magenta roll source (or current sheet),
cleans, scales so diameter ≈ 0.72 * h_run, spins 7 angles, stamps bookends.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from build_mage_roll_spin import (  # noqa: E402
    ball_spin_cell,
    clean_ball,
    content_box,
    plant_ground,
    stamp_dust,
)
from plant_blob_sheet import eye_safe_defringe, find_blobs  # noqa: E402
from replant_all_action_sheets import ASSETS, CH, CW, RAW, WWW, chroma, crop_alpha, scale_k  # noqa: E402

CURSOR = Path(r"C:\Users\lin\.cursor\projects\e-Users-lin-Desktop-Home-XRK-AGT\assets")
ALPHA = 28
# diameter ≈ this fraction of run0 content height (tucked ball, not full standing)
LOCK_FRAC = 0.72


def h_run_of(char: str) -> int:
    run = Image.open(ASSETS / "characters" / char / f"{char}-run-sheet.png").convert("RGBA")
    cell = run.crop((0, 0, CW, CH))
    box = content_box(np.array(cell))
    assert box
    return box[3] - box[1]


def pick_ball(char: str) -> Image.Image:
    """Prefer dedicated ball magenta; else roll sheet blobs."""
    candidates = [
        CURSOR / f"{char}-roll-ball-v2-magenta.png",
        RAW / f"{char}-roll-ball-v2-magenta.png",
        CURSOR / f"{char}-roll-ball-v1-magenta.png",
        RAW / f"{char}-roll-ball-v1-magenta.png",
        CURSOR / f"{char}-roll-3x3-gutter-v1-magenta.png",
        RAW / f"{char}-roll-3x3-gutter-v1-magenta.png",
        ASSETS / "characters" / char / f"{char}-roll-sheet.png",
    ]
    src = next((p for p in candidates if p.exists()), None)
    if src is None:
        raise FileNotFoundError(f"no roll source for {char}")
    print("ball src", src)
    import shutil

    if "magenta" in src.name and src.parent == CURSOR:
        shutil.copy2(src, RAW / src.name)
    im = Image.open(src).convert("RGBA")
    if "magenta" in src.name:
        im = eye_safe_defringe(chroma(im), passes=3)
        im.save(RAW / src.name.replace(".png", "-keyed.png"))
    a = np.array(im)
    blobs = find_blobs(a, min_area=500)
    if "ball-v" in src.name and blobs:
        # largest blob = the ball
        blobs.sort(key=lambda b: b[4], reverse=True)
        x0, y0, x1, y1, _ = blobs[0]
        ball = crop_alpha(Image.fromarray(a[y0:y1, x0:x1], "RGBA"))
        return clean_ball(ball)
    scored = []
    for x0, y0, x1, y1, area in blobs[:15]:
        w, h = x1 - x0, y1 - y0
        if w < 40 or h < 40:
            continue
        aspect = w / max(1, h)
        square = 1.0 - min(abs(aspect - 1.0), 1.0)
        scored.append((square * area, x0, y0, x1, y1, w, h))
    scored.sort(reverse=True)
    if not scored:
        raise SystemExit(f"no ball blob for {char}")
    _, x0, y0, x1, y1, w, h = scored[0]
    print(f"  pick ball box {w}x{h}")
    ball = crop_alpha(Image.fromarray(a[y0:y1, x0:x1], "RGBA"))
    return clean_ball(ball)


def mid_max_side(cell: Image.Image) -> int:
    box = content_box(np.array(cell))
    if not box:
        return 0
    return max(box[2] - box[0], box[3] - box[1])


def rebuild(char: str) -> None:
    run0 = Image.open(ASSETS / "characters" / char / f"{char}-run-sheet.png").convert("RGBA").crop(
        (0, 0, CW, CH)
    )
    hr = h_run_of(char)
    ball0 = pick_ball(char)
    lock = max(1, int(hr * LOCK_FRAC))
    k = lock / max(ball0.size)
    ball = scale_k(ball0, k)
    # re-crop after scale; force max side == lock exactly
    from build_mage_roll_spin import fit_once

    ball = fit_once(ball, lock)
    lock = max(ball.size)
    print(f"{char}: h_run={hr} ball={ball.size} lock={lock}")

    # 7 mid frames: even forward-roll angles (PIL negative = clockwise)
    angles = [-i * (360.0 / 8.0) for i in range(1, 8)]  # -45..-315
    mids = [stamp_dust(ball_spin_cell(ball, float(ang), lock), None) for ang in angles]

    # hard assert: every mid max-side within 2px of lock
    for i, c in enumerate(mids, start=1):
        m = mid_max_side(c)
        if abs(m - lock) > 2:
            raise SystemExit(f"{char} mid c{i} max={m} != lock={lock}")

    out = Image.new("RGBA", (CW * 3, CH * 3), (0, 0, 0, 0))
    cells = [run0, *mids, run0.copy()]
    for i, c in enumerate(cells):
        ri, ci = divmod(i, 3)
        out.paste(c, (ci * CW, ri * CH))
    dest = ASSETS / "characters" / char / f"{char}-roll-sheet.png"
    out.save(dest)
    print("wrote", dest)
    for i, c in enumerate(cells):
        box = content_box(np.array(c))
        if not box:
            print(f"  c{i}: EMPTY")
            continue
        w, h = box[2] - box[0], box[3] - box[1]
        print(f"  c{i}: {w}x{h} max={max(w, h)}")


def bump(ver: str) -> None:
    for rel in ["js/config/characters.js", "js/boot-mobile.js", "build-id.txt", "index.html"]:
        p = WWW / rel
        s = p.read_text(encoding="utf-8")
        if rel.endswith("build-id.txt"):
            s = ver + "\n"
        else:
            s = re.sub(r"20260821[a-z]+", ver, s)
        p.write_text(s, encoding="utf-8", newline="\n")
    print("ver", ver)


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--char", action="append", choices=("mage", "warrior"))
    ap.add_argument("--ver", default="20260821bv")
    args = ap.parse_args()
    chars = args.char or ["mage", "warrior"]
    for char in chars:
        rebuild(char)
    bump(args.ver)


if __name__ == "__main__":
    main()
