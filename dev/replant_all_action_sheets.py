# -*- coding: utf-8 -*-
"""Re-plant all action sheets with ONE sheet_k per sheet (no per-cell crush).

Sources: Cursor assets/*-fix-v*-magenta.png
Bookends: exact current run0
Canvas: 512x768, FOOT=CH-14
"""
from __future__ import annotations

import re
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_layout import ASSETS, RAW  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / "www" / "castle-parkour"
CURSOR_ASSETS = Path(r"C:\Users\lin\.cursor\projects\e-Users-lin-Desktop-Home-XRK-AGT\assets")

CW, CH, FOOT, MARGIN, ALPHA = 512, 768, 754, 20, 28
VER = "20260821m"

JOBS = [
    # char, role, cols, rows, magenta src name, tuck/anchor cell index for sheet_k
    ("mage", "jump", 3, 3, "mage-jump-3x3-fix-v2-magenta.png", 1),
    ("mage", "atk", 2, 2, "mage-atk-2x2-fix-v1-magenta.png", 1),
    ("mage", "roll", 3, 3, "mage-roll-3x3-fix-v2-magenta.png", 1),
    ("warrior", "jump", 3, 3, "warrior-jump-3x3-fix-v1-magenta.png", 1),
    ("warrior", "atk", 2, 2, "warrior-atk-2x2-fix-v1-magenta.png", 1),
    ("warrior", "roll", 3, 3, "warrior-roll-3x3-fix-v1-magenta.png", 1),
]

# target height ratio of anchor cell vs h_run
ANCHOR_RATIO = {
    "jump": 0.82,
    "atk": 0.95,
    "roll": 0.75,
}


def content_box(a: np.ndarray):
    ys, xs = np.where(a[:, :, 3] > ALPHA)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def crop_alpha(im: Image.Image) -> Image.Image:
    a = np.array(im.convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] < 30, 0, a[:, :, 3])
    box = content_box(a)
    if not box:
        return Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    return Image.fromarray(a, "RGBA").crop(box)


def protect(r, g, b, a) -> bool:
    if a < 40:
        return False
    # NEVER protect chroma magenta / pink AA (sword tips were eaten because
    # tip pixels were literally R≈B high, G≈0 — old blue-channel rule shielded them
    # inconsistently, then hot/defringe still deleted the tip).
    if r > 150 and b > 140 and g < 110 and abs(r - b) < 60 and r > g + 40 and b > g + 40:
        return False
    if r > 160 and g > 90 and b < 120 and r > b + 40:
        return True
    if r > 180 and g > 160 and b > 120 and min(r, g, b) > 110:
        return True
    # cyan visor / blue glow — require g not near-zero (exclude magenta AA)
    if b > 80 and r > 40 and g > 40 and g < 140 and b > g + 15 and not (r > 200 and b > 200 and g < 110):
        return True
    # warrior red plume / cape (low blue)
    if r > 150 and g < 90 and b < 90 and r > g + 60:
        return True
    # metal / cyan visor
    if b > 140 and g > 140 and r < 180 and b >= r:
        return True
    # silver/grey steel (low saturation) — protect blade body
    if min(r, g, b) > 100 and max(r, g, b) - min(r, g, b) < 55:
        return True
    if r > 60 and g > 30 and b < 80 and r > b:
        return True
    if r > 170 and g > 120 and b > 90 and r > b:
        return True
    return False


def is_mag(r, g, b, a) -> bool:
    if a < 12:
        return True
    hot = r > 185 and b > 185 and g < 130 and abs(r - b) < 55
    # soft: do NOT treat silver/grey (low sat) as magenta
    if min(r, g, b) > 100 and max(r, g, b) - min(r, g, b) < 55:
        return False
    soft = r > 155 and b > 145 and g < 165 and r > g + 15 and b > g + 8 and abs(r - b) < 75
    return hot or soft


def chroma(im: Image.Image) -> Image.Image:
    a = np.array(im.convert("RGBA"))
    H, W = a.shape[:2]
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    visited = np.zeros((H, W), bool)
    mask = np.zeros((H, W), bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(W):
        q.append((0, x))
        q.append((H - 1, x))
    for y in range(H):
        q.append((y, 0))
        q.append((y, W - 1))
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= H or x >= W or visited[y, x]:
            continue
        visited[y, x] = True
        rr, gg, bb, aa = int(r[y, x]), int(g[y, x]), int(b[y, x]), int(al[y, x])
        if protect(rr, gg, bb, aa):
            continue
        if not is_mag(rr, gg, bb, aa):
            continue
        mask[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q.append((y + dy, x + dx))
    a[mask, 3] = 0
    hot = (al > 40) & (r > 200) & (b > 200) & (g < 100) & (np.abs(r.astype(int) - b) < 50)
    a[hot, 3] = 0
    # multi-pass edge defringe (soft pink / washed magenta)
    for _ in range(3):
        al2 = a[:, :, 3]
        pad = np.pad(al2 <= 20, 1, constant_values=True)
        edge = np.zeros((H, W), bool)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            edge |= pad[1 + dy : H + 1 + dy, 1 + dx : W + 1 + dx]
        soft = (
            edge
            & (al2 > 20)
            & (a[:, :, 0] > 160)
            & (a[:, :, 2] > 145)
            & (a[:, :, 1] < 175)
            & (a[:, :, 0].astype(int) > a[:, :, 1].astype(int) + 10)
        )
        a[soft, 3] = (a[soft, 3].astype(np.float32) * 0.25).astype(np.uint8)
        hotf = edge & (al2 > 20) & (a[:, :, 0] > 190) & (a[:, :, 2] > 175) & (a[:, :, 1] < 145)
        a[hotf, 3] = 0
    return Image.fromarray(a, "RGBA")


def scale_k(im: Image.Image, k: float) -> Image.Image:
    im = crop_alpha(im)
    nw, nh = max(1, int(im.width * k)), max(1, int(im.height * k))
    return im.resize((nw, nh), Image.Resampling.BICUBIC)


def plant_scaled(crop: Image.Image) -> Image.Image:
    max_w, max_h = CW - 2 * MARGIN, FOOT - MARGIN
    fit = min(max_w / max(1, crop.width), max_h / max(1, crop.height), 1.0)
    if fit < 1:
        crop = scale_k(crop, fit)
    out = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    x = (CW - crop.width) // 2
    y = FOOT - crop.height
    if y < MARGIN:
        y = MARGIN
    out.paste(crop, (x, y))
    return out


def find_src(name: str) -> Path:
    p = CURSOR_ASSETS / name
    if p.is_file():
        return p
    try:
        from asset_layout import find_raw

        return find_raw(name)
    except FileNotFoundError as e:
        raise FileNotFoundError(name) from e


def process_one(char: str, role: str, cols: int, rows: int, src_name: str, anchor_i: int) -> None:
    src = find_src(src_name)
    run_path = ASSETS / "characters" / char / f"{char}-run-sheet.png"
    dest = ASSETS / "characters" / char / f"{char}-{role}-sheet.png"
    run0 = Image.open(run_path).convert("RGBA").crop((0, 0, CW, CH))
    rb = content_box(np.array(run0))
    assert rb
    h_run = rb[3] - rb[1]

    keyed = chroma(Image.open(src).convert("RGBA"))
    keyed_path = src.parent / src_name.replace(".png", "-keyed.png")
    keyed_path.parent.mkdir(parents=True, exist_ok=True)
    keyed.save(keyed_path)

    W, H = keyed.size
    cw, ch = W // cols, H // rows
    n = cols * rows
    raw_crops: list[Image.Image] = []
    for i in range(n):
        ri, ci = divmod(i, cols)
        cell = keyed.crop((ci * cw, ri * ch, (ci + 1) * cw, (ri + 1) * ch))
        raw_crops.append(crop_alpha(cell))

    anchor_h = max(1, raw_crops[anchor_i].height)
    target = int(h_run * ANCHOR_RATIO[role])
    sheet_k = target / anchor_h
    # Cap: after sheet_k, no mid cell taller than h_run (uniform shrink if needed)
    mid_hs = [max(1, raw_crops[i].height) for i in range(1, n - 1)]
    max_mid = max(mid_hs) * sheet_k
    if max_mid > h_run:
        sheet_k *= h_run / max_mid
    print(f"{char}-{role}: h_run={h_run} anchor_h={anchor_h} sheet_k={sheet_k:.3f} src={src.name}")

    cells: list[Image.Image] = [Image.new("RGBA", (CW, CH), (0, 0, 0, 0)) for _ in range(n)]
    cells[0] = run0.copy()
    cells[n - 1] = run0.copy()
    for i in range(1, n - 1):
        scaled = scale_k(raw_crops[i], sheet_k)
        cells[i] = plant_scaled(scaled)

    sheet = Image.new("RGBA", (CW * cols, CH * rows), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        ri, ci = divmod(i, cols)
        sheet.paste(c, (ci * CW, ri * CH))
    sheet.save(dest)

    # verify no edge touch on mids
    a = np.array(sheet)
    for i in range(1, n - 1):
        ri, ci = divmod(i, cols)
        c = a[ri * CH : (ri + 1) * CH, ci * CW : (ci + 1) * CW]
        b = content_box(c)
        if not b:
            print(f"  WARN empty mid {i}")
            continue
        x0, y0, x1, y1 = b
        touch = []
        if x0 <= 2:
            touch.append("L")
        if y0 <= 2:
            touch.append("T")
        if x1 >= CW - 2:
            touch.append("R")
        if y1 >= CH - 2:
            touch.append("B")
        h = y1 - y0
        print(f"  cell{i}: {x1-x0}x{h} footGap={CH-y1} touch={''.join(touch) or '-'}")


def bump() -> None:
    for rel in ["js/config/characters.js", "js/boot-mobile.js", "build-id.txt", "index.html"]:
        p = WWW / rel
        s = re.sub(r"20260821[a-z]", VER, p.read_text(encoding="utf-8"))
        if rel.endswith("build-id.txt"):
            s = VER + "\n"
        p.write_text(s, encoding="utf-8", newline="\n")
    print("ver", VER)


def main() -> None:
    for job in JOBS:
        process_one(*job)
    bump()


if __name__ == "__main__":
    main()
