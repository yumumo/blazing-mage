#!/usr/bin/env python3
"""Audit + fix castle-parkour asset mattes (leftover magenta / over-erasure)."""
from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_layout import ASSETS, RAW  # noqa: E402
RAW.mkdir(parents=True, exist_ok=True)


def is_magentaish(rr: int, gg: int, bb: int, aa: int) -> bool:
    if aa < 8:
        return False
    # hot key magenta / purple fringe
    if rr > 155 and bb > 135 and gg < 150 and (rr + bb) > (gg * 2 + 30):
        return True
    if rr > 180 and bb > 160 and gg < 120:
        return True
    # soft purple fringe
    if rr > 120 and bb > 110 and gg < rr - 20 and gg < bb - 10 and (rr + bb) > gg * 2 + 20:
        return True
    return False


def strip_magenta(arr: np.ndarray) -> tuple[np.ndarray, int]:
    out = arr.copy()
    r, g, b, al = [out[:, :, i].astype(np.int16) for i in range(4)]
    hot = (
        (al > 8)
        & (r > 155)
        & (b > 135)
        & (g < 150)
        & ((r + b) > (g * 2 + 30))
    )
    soft = (
        (al > 20)
        & (r > 120)
        & (b > 110)
        & (g < r - 20)
        & (g < b - 10)
        & ((r + b) > g * 2 + 20)
    )
    # only kill soft when near transparent or edge-ish (avoid eating purple cloth)
    # soft only if alpha already low OR neighbor has hot magenta / empty
    kill = hot.copy()
    soft_only = soft & ~hot
    if soft_only.any():
        # dilate empty/hot to catch fringe
        empty = al < 12
        near = (
            np.array(Image.fromarray((empty | hot).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3)))
            > 0
        )
        kill |= soft_only & near
    n = int(kill.sum())
    out[kill, 3] = 0
    return out, n


def fill_small_holes(arr: np.ndarray, max_area: int = 40) -> tuple[np.ndarray, int]:
    """Fill tiny fully-internal transparent holes (over-keyed pinholes)."""
    from collections import deque

    h, w = arr.shape[:2]
    al = arr[:, :, 3]
    empty = al < 12
    seen = np.zeros((h, w), bool)
    filled = 0
    out = arr.copy()
    for y in range(h):
        for x in range(w):
            if not empty[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            cells = [(y, x)]
            touches_border = False
            while q:
                cy, cx = q.popleft()
                if cy == 0 or cx == 0 or cy == h - 1 or cx == w - 1:
                    touches_border = True
                for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and empty[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
                        cells.append((ny, nx))
                        if len(cells) > max_area:
                            touches_border = True  # too big, abort fill
            if touches_border or len(cells) > max_area:
                continue
            # fill from median of surrounding opaque
            for cy, cx in cells:
                cands = []
                for rad in range(1, 6):
                    for dy in range(-rad, rad + 1):
                        for dx in (-rad, rad) if abs(dy) < rad else range(-rad, rad + 1):
                            ny, nx = cy + dy, cx + dx
                            if not (0 <= ny < h and 0 <= nx < w):
                                continue
                            if out[ny, nx, 3] < 40:
                                continue
                            pix = out[ny, nx]
                            if is_magentaish(int(pix[0]), int(pix[1]), int(pix[2]), int(pix[3])):
                                continue
                            cands.append(pix)
                    if cands:
                        break
                if cands:
                    out[cy, cx] = np.median(np.stack(cands), 0).astype(np.uint8)
                    filled += 1
    return out, filled


def scan(path: Path) -> dict:
    a = np.array(Image.open(path).convert("RGBA"))
    r, g, b, al = [a[:, :, i].astype(np.int16) for i in range(4)]
    mag = (al > 8) & (r > 155) & (b > 135) & (g < 150) & ((r + b) > (g * 2 + 30))
    soft = (al > 20) & (r > 120) & (b > 110) & (g < r - 20) & (g < b - 10) & ((r + b) > g * 2 + 20)
    black = (al > 200) & (r < 18) & (g < 18) & (b < 18)
    return {
        "mag": int(mag.sum()),
        "soft": int(soft.sum()),
        "black": int(black.sum()),
        "opaque": int((al > 20).sum()),
    }


def main() -> None:
    report = []
    fixed = []
    for path in sorted(ASSETS.rglob("*.png")):
        if "portrait" in path.name:
            continue
        before = scan(path)
        score = before["mag"] + before["soft"] // 4
        # always light strip if any hot magenta
        arr = np.array(Image.open(path).convert("RGBA"))
        arr2, n_mag = strip_magenta(arr)
        arr3, n_hole = fill_small_holes(arr2, max_area=36)
        after = {
            "mag": scan_arr(arr3)["mag"],
            "soft": scan_arr(arr3)["soft"],
            "opaque": int((arr3[:, :, 3] > 20).sum()),
        }
        changed = n_mag > 0 or n_hole > 0
        if changed:
            # backup once
            bak = RAW / f"{path.stem}.before-mattefix.png"
            if not bak.exists():
                bak.write_bytes(path.read_bytes())
            Image.fromarray(arr3, "RGBA").save(path)
            fixed.append((path.name, n_mag, n_hole, before, after))
        if score > 40 or before["mag"] > 15 or changed:
            report.append((path.name, before, after if changed else before, n_mag, n_hole))

    print("=== fixed ===")
    for name, nm, nh, b, a in fixed:
        print(f"  {name}: strip_mag={nm} fill_holes={nh} mag {b['mag']}→{a['mag']} soft {b['soft']}→{a['soft']}")
    print(f"total fixed {len(fixed)}")

    # remasure sheets lightly? bump ver
    root = ASSETS.parent
    cur = (root / "build-id.txt").read_text(encoding="utf-8").strip()
    if cur[-1].isalpha() and cur[-1] != "z":
        nxt = cur[:-1] + chr(ord(cur[-1]) + 1)
    else:
        # 20260819a style
        nxt = "20260819b" if not cur.endswith("b") else "20260819c"
        if cur.startswith("20260819"):
            last = cur[-1]
            nxt = cur[:-1] + chr(ord(last) + 1) if last.isalpha() else cur + "b"
    old, new = cur.encode(), nxt.encode()
    for p in [
        root / "build-id.txt",
        root / "js" / "config" / "characters.js",
        root / "js" / "boot-mobile.js",
        root / "index.html",
    ]:
        d = p.read_bytes()
        if old in d:
            p.write_bytes(d.replace(old, new))
            print("bump", p.name, "->", nxt)

    (RAW / "_matte_audit.txt").write_text(
        "\n".join(
            f"{n}: before mag={b['mag']} soft={b['soft']} | after mag={a['mag']} soft={a['soft']} strip={nm} holes={nh}"
            for n, b, a, nm, nh in report
        )
        or "none",
        encoding="utf-8",
    )
    print("wrote", RAW / "_matte_audit.txt")


def scan_arr(a: np.ndarray) -> dict:
    r, g, b, al = [a[:, :, i].astype(np.int16) for i in range(4)]
    mag = (al > 8) & (r > 155) & (b > 135) & (g < 150) & ((r + b) > (g * 2 + 30))
    soft = (al > 20) & (r > 120) & (b > 110) & (g < r - 20) & (g < b - 10) & ((r + b) > g * 2 + 20)
    return {"mag": int(mag.sum()), "soft": int(soft.sum())}


if __name__ == "__main__":
    main()
