# -*- coding: utf-8 -*-
"""Plant sheet using content blobs (not blind equal grid).

Ruler: body_core_h vs game run0 (see gen-and-plant-notes.md).
Default cell 512×768 — NOT a hard cap. After same-scale, expand
cellW/cellH so sword/dust fit; NEVER shrink to force-fit.
Bookends: stamp game run0 into (possibly larger) cells, foot-aligned.
"""
from __future__ import annotations

import argparse
import math
import re
import shutil
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from replant_all_action_sheets import (  # noqa: E402
    ASSETS,
    RAW,
    WWW,
    chroma,
    crop_alpha,
    scale_k,
)
from asset_layout import find_raw, raw_action_dir  # noqa: E402

ALPHA = 28
DEFAULT_CW, DEFAULT_CH = 512, 768
FOOT_GAP = 14
MARGIN = 20
CURSOR = Path(r"C:\Users\lin\.cursor\projects\e-Users-lin-Desktop-Home-XRK-AGT\assets")
MIN_BLOB = 800


def resolve_plant_src(src_name: str) -> Path:
    """Resolve --src: absolute/relative path, Cursor assets/, or art-raw basename."""
    p = Path(src_name)
    if p.is_file():
        return p.resolve()
    cand = CURSOR / Path(src_name).name
    if cand.is_file():
        return cand
    return find_raw(Path(src_name).name)


def fill_enclosed_magenta(im: Image.Image) -> Image.Image:
    """Fill magenta that should stay inside the figure (blade holes / tip pits).

    Chroma floods from the border through magenta, so a 1px outline gap lets
    backdrop magenta pour into the blade. We:
      1) treat soft+hot magenta like chroma.is_mag
      2) morphologically close the non-magenta silhouette (seal outline gaps)
      3) flood exterior only through remaining magenta
      4) paint leftover interior magenta with nearby blade/edge color
    """
    a = np.array(im.convert("RGBA"), dtype=np.uint8)
    H, W = a.shape[:2]
    r = a[:, :, 0].astype(np.int16)
    g = a[:, :, 1].astype(np.int16)
    b = a[:, :, 2].astype(np.int16)
    al = a[:, :, 3].astype(np.int16)

    # Match chroma.is_mag (hot | soft), excluding low-sat silver
    hot = (r > 185) & (b > 185) & (g < 130) & (np.abs(r - b) < 55)
    lowsat = (np.minimum(np.minimum(r, g), b) > 100) & (
        (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < 55
    )
    soft = (
        (r > 155)
        & (b > 145)
        & (g < 165)
        & (r > g + 15)
        & (b > g + 8)
        & (np.abs(r - b) < 40)
        & ~lowsat
    )
    is_mag = ((al < 12) | hot | soft) & (al >= 0)
    # ignore fully empty as mag for fill source (keep as transparent)
    is_mag = (hot | soft) & (al >= 12)
    if not is_mag.any():
        return im

    # Silhouette: opaque non-magenta (and low-sat silver always counts as body)
    body = (al >= 40) & ~is_mag
    # Morphological close body: dilate then erode 2px — seals tip outline gaps
    body_c = body.copy()
    for _ in range(2):
        pad = np.pad(body_c, 1, constant_values=False)
        body_c = (
            pad[0:H, 0:W]
            | pad[0:H, 1 : W + 1]
            | pad[0:H, 2 : W + 2]
            | pad[1 : H + 1, 0:W]
            | pad[1 : H + 1, 1 : W + 1]
            | pad[1 : H + 1, 2 : W + 2]
            | pad[2 : H + 2, 0:W]
            | pad[2 : H + 2, 1 : W + 1]
            | pad[2 : H + 2, 2 : W + 2]
        )
    for _ in range(2):
        pad = np.pad(body_c, 1, constant_values=True)
        body_c = (
            pad[0:H, 0:W]
            & pad[0:H, 1 : W + 1]
            & pad[0:H, 2 : W + 2]
            & pad[1 : H + 1, 0:W]
            & pad[1 : H + 1, 1 : W + 1]
            & pad[1 : H + 1, 2 : W + 2]
            & pad[2 : H + 2, 0:W]
            & pad[2 : H + 2, 1 : W + 1]
            & pad[2 : H + 2, 2 : W + 2]
        )

    # Exterior flood: from border through magenta that is NOT inside closed body
    can_flood = is_mag & ~body_c
    visited = np.zeros((H, W), dtype=bool)
    exterior = np.zeros((H, W), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for y in range(H):
        for x in (0, W - 1):
            if can_flood[y, x] and not visited[y, x]:
                visited[y, x] = True
                exterior[y, x] = True
                q.append((y, x))
    for x in range(W):
        for y in (0, H - 1):
            if can_flood[y, x] and not visited[y, x]:
                visited[y, x] = True
                exterior[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and can_flood[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                exterior[ny, nx] = True
                q.append((ny, nx))

    # Interior = any magenta not exterior (includes islands trapped inside body_c)
    interior = is_mag & ~exterior
    n = int(interior.sum())
    if n == 0:
        print("  fill_enclosed_magenta: no interior magenta")
        return im

    ys, xs = np.where(interior)
    filled = 0
    punched = 0
    for y, x in zip(ys.tolist(), xs.tolist()):
        # Only fill when local neighborhood is mostly blade metal / outline.
        # Magenta pockets between sword and helmet/body must become transparent,
        # not silver bridges.
        blade_n = 0
        body_n = 0
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                if dy == 0 and dx == 0:
                    continue
                ny, nx = y + dy, x + dx
                if not (0 <= ny < H and 0 <= nx < W):
                    continue
                if interior[ny, nx] or is_mag[ny, nx]:
                    continue
                rr, gg, bb, aa = map(int, a[ny, nx])
                if aa < 40:
                    continue
                sat = abs(rr - gg) + abs(gg - bb) + abs(rr - bb)
                mean = (rr + gg + bb) / 3
                dark = mean < 55 and sat < 40
                silver = mean >= 90 and mean <= 220 and sat < 70
                if dark or silver:
                    blade_n += 1
                else:
                    body_n += 1
        if blade_n >= 1:
            # Any nearby blade metal → FILL silver (never punch tip AA)
            pass
        elif blade_n < 4 or blade_n <= body_n:
            a[y, x, 3] = 0
            punched += 1
            continue

        best = None
        bestd = 10**9
        for r0 in range(1, 12):
            for dy in range(-r0, r0 + 1):
                for dx in range(-r0, r0 + 1):
                    if abs(dy) != r0 and abs(dx) != r0:
                        continue
                    ny, nx = y + dy, x + dx
                    if not (0 <= ny < H and 0 <= nx < W):
                        continue
                    if interior[ny, nx] or is_mag[ny, nx]:
                        continue
                    rr, gg, bb, aa = a[ny, nx]
                    if aa < 40:
                        continue
                    if gg > 150 and rr > 150 and bb < 90:
                        continue
                    sat = abs(int(rr) - int(gg)) + abs(int(gg) - int(bb)) + abs(int(rr) - int(bb))
                    score = dy * dy + dx * dx + sat
                    if score < bestd:
                        bestd = score
                        best = (int(rr), int(gg), int(bb), 255)
            if best is not None and r0 >= 2:
                break
        if best is None:
            best = (168, 176, 188, 255)
        a[y, x] = best
        filled += 1
    print(
        f"  fill_enclosed_magenta: filled {filled} blade-island px, "
        f"punched {punched} gap px (sealed outline)"
    )
    return Image.fromarray(a, "RGBA")


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


def body_core_h(cell: np.ndarray) -> int | None:
    """Thick-row span = body/legs/head; drops thin overhead sword rows."""
    al = cell[:, :, 3] > ALPHA
    if not al.any():
        return None
    widths = al.sum(axis=1)
    mx = int(widths.max())
    thick = widths >= max(8, int(mx * 0.40))
    ys = np.where(thick)[0]
    if len(ys) == 0:
        return None
    return int(ys.max() - ys.min() + 1)


def scale_ruler(cell: np.ndarray) -> int | None:
    """Pose-stable size ruler: prefer upper/head band width; coreH falls back.

    Using coreH alone enlarges crouch/fly cells (short thick-span) up to standing
    height — looks like '格子变巨'. upperW stays stable across squat/air poses.
    If upperW is tiny vs coreH (bad crop / thin slice), prefer coreH.
    """
    w = upper_w(cell)
    h = body_core_h(cell)
    if w and w >= 12:
        if h and h >= 24 and w < h * 0.22:
            return h
        return w
    return h


def eye_safe_defringe(im: Image.Image, passes: int = 3) -> Image.Image:
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
        cyan = (b > 140) & (g > 140) & (r < 180)
        metal = (r > 90) & (g > 90) & (b > 90) & (np.abs(r - g) < 40) & (np.abs(g - b) < 40)
        royal = (
            (b > g + 18)
            & (g < 125)
            & (b > 55)
            & (b >= r - 8)
            & ~((r > 175) & (b > 175) & (g < 130) & (np.abs(r - b) < 50))
        )
        plume = (r > 150) & (g < 90) & (b < 90) & (r > g + 60)
        protect = whiteish | cream | skin | cyan | metal | royal | plume
        hot = (
            edge
            & (al > 15)
            & (r > 195)
            & (b > 195)
            & (g < 120)
            & (np.abs(r - b) < 50)
            & ~protect
        )
        soft = (
            edge
            & (al > 15)
            & (r > 180)
            & (b > 160)
            & (g < 140)
            & (r > g + 25)
            & (b > g + 20)
            & (np.abs(r - b) < 45)
            & ~protect
        )
        a[hot, 3] = 0
        a[soft, 3] = (a[soft, 3].astype(np.float32) * 0.2).astype(np.uint8)
    r, g, b, al = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int), a[:, :, 3]
    whiteish = (r > 185) & (g > 185) & (b > 185)
    hot2 = (al > 8) & (r > 205) & (b > 205) & (g < 100) & (np.abs(r - b) < 45) & ~whiteish
    a[hot2, 3] = 0
    return Image.fromarray(a, "RGBA")


def scrub_magenta_residue(im: Image.Image) -> Image.Image:
    """Clean chroma pink/purple without chewing the silhouette.

    Deleting edge purple AA leaves a sawtooth sword outline. Instead:
      - edge pink/purple next to metal/outline → solid black outline
      - hot/soft/fleck islands (not outline) → transparent
    Protect red plume / gold trim (strict — do NOT shield hilt pink flecks).
    """
    a = np.array(im.convert("RGBA"))
    H, W = a.shape[:2]
    r = a[:, :, 0].astype(np.int16)
    g = a[:, :, 1].astype(np.int16)
    b = a[:, :, 2].astype(np.int16)
    al = a[:, :, 3].astype(np.int16)

    # Strict plume: true red/orange hair (low blue). Mid-blue pink flecks near hilt
    # were wrongly protected as plume (e.g. RGB≈202,6,62).
    plume = (al > 40) & (r > 160) & (g < 100) & (b < 55) & (r > b + 90)
    gold = (al > 40) & (r > 160) & (g > 100) & (b < 110) & (r > b + 40)
    cream = (al > 40) & (r > 145) & (g > 115) & (b < 210) & (r > b + 6)
    # Mage hat/robe: blue-ish purple. Must NOT match hot magenta (R≈B high).
    hot_mag = (r > 175) & (b > 175) & (g < 130) & (np.abs(r - b) < 50)
    royal = (
        (al > 40)
        & (b > g + 18)
        & (g < 125)
        & (b > 55)
        & (b >= r - 8)
        & ~hot_mag
    )
    protect = plume | gold | cream | royal

    # Broad magenta / purple-pink (includes dark AA like RGB≈37,3,39)
    pinkish = (
        (al > 12)
        & ~protect
        & (g < 100)
        & (r > g + 12)
        & (b > g + 12)
        & (np.abs(r - b) < 80)
        & ((r > 28) | (b > 28))
        & (np.maximum(r, b) > 35)
    )
    hot = (al > 12) & hot_mag & ~protect
    fleck = (
        (al > 12)
        & (g < 40)
        & (r > 48)
        & (b > 40)
        & (r > g + 30)
        & (b > g + 20)
        & ~protect
    )
    # Hilt pink-red chroma (high R, near-zero G, mid B) — not plume
    hilt_pink = (
        (al > 12)
        & (g < 45)
        & (r > 160)
        & (b > 45)
        & (b < 130)
        & (r > b + 25)
        & ~protect
    )
    # Soft purple-gray AA on silhouette (mid sat)
    soft_edge = (
        (al > 20)
        & (al < 220)
        & (r > 140)
        & (b > 125)
        & (g < 165)
        & (r > g + 8)
        & (b > g + 5)
        & (np.abs(r - b) < 55)
        & ~protect
        & ~cream
    )

    pad = np.pad(al <= 20, 1, constant_values=True)
    edge = np.zeros((H, W), bool)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
        edge |= pad[1 + dy : H + 1 + dy, 1 + dx : W + 1 + dx]

    # Neighbors that look like blade metal / existing black outline
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    mean = (r + g + b) / 3.0
    metal = (al > 80) & (mean > 85) & (mean < 230) & (sat < 75) & ~pinkish & ~hilt_pink
    dark_line = (al > 80) & (mean < 55) & (sat < 45) & ~pinkish
    solid = metal | dark_line | gold

    near_solid = np.zeros((H, W), bool)
    spad = np.pad(solid, 1, constant_values=False)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            near_solid |= spad[1 + dy : H + 1 + dy, 1 + dx : W + 1 + dx]

    # Heal outline: pinkish on silhouette edge next to metal → pure black
    # Do NOT heal hilt_pink into black (those are junk → delete)
    heal = pinkish & edge & near_solid & ~hilt_pink
    # pinkish only on edges — interior purple robe must not be wiped
    kill = (
        hot
        | (fleck & edge)
        | hilt_pink
        | (soft_edge & edge)
        | (pinkish & edge & ~heal)
    ) & ~heal

    n_heal = int(heal.sum())
    n_kill = int(kill.sum())
    if n_heal:
        a[heal, 0] = 0
        a[heal, 1] = 0
        a[heal, 2] = 0
        a[heal, 3] = 255
    if n_kill:
        a[kill, 3] = 0
    if n_heal or n_kill:
        print(f"  scrub_magenta_residue: healed {n_heal} outline px, cleared {n_kill} junk px")
    return Image.fromarray(a, "RGBA")


def scrub_edge_grid(im: Image.Image) -> Image.Image:
    """Remove ONLY cut-guide lines near cell edges.

    White/gray grid lines are for splitting — crop/inset should leave them out;
    this only cleans AA stubs that still touch the crop border.

    NEVER globally delete pure white inside the character (armor hilights,
    eye whites, cream dust). Also NEVER kill opaque purple robe/hat.
    """
    a = np.array(im.convert("RGBA"))
    H, W = a.shape[:2]
    r, g, b, al = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int), a[:, :, 3]
    cream = (r > 145) & (g > 115) & (b < 210) & (r > b + 6)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    # bright white/gray guides
    pale = (al > 15) & (r > 160) & (g > 160) & (b > 160) & ((mx - mn) <= 30) & ~cream
    # mid-alpha desaturated purple-gray AA from chroma+grid (NOT opaque robe)
    purple_gray = (
        (al > 25)
        & (al < 160)
        & (r > 100)
        & (g < 160)
        & (np.abs(r - b) < 45)
        & (r >= g - 5)
        & ((mx - mn) <= 55)
        & ~cream
    )
    guide = pale | purple_gray

    band = max(8, min(H, W) // 24)
    edge = np.zeros((H, W), bool)
    edge[:band, :] = edge[-band:, :] = edge[:, :band] = edge[:, -band:] = True

    kill = np.zeros((H, W), bool)
    q = deque()
    ys, xs = np.where(edge & guide)
    for y, x in zip(ys.tolist(), xs.tolist()):
        q.append((y, x))
        kill[y, x] = True
    while q:
        cy, cx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if not (0 <= ny < H and 0 <= nx < W):
                continue
            if not edge[ny, nx]:
                continue
            if guide[ny, nx] and not kill[ny, nx]:
                kill[ny, nx] = True
                q.append((ny, nx))

    if kill.any():
        a[kill, 3] = 0
    a = _scrub_thin_guide_spans(a)
    return Image.fromarray(a, "RGBA")


def _scrub_thin_guide_spans(a: np.ndarray) -> np.ndarray:
    """Kill thin mid-alpha guide stubs that span much of the crop.

    Requires mid-alpha mean so opaque purple hat/robe rows are not wiped.
    """
    H, W = a.shape[:2]
    r, g, b, al = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int), a[:, :, 3]
    cream = (r > 145) & (g > 115) & (b < 210) & (r > b + 6)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    pale = (al > 15) & (r > 160) & (g > 160) & (b > 160) & ((mx - mn) <= 30) & ~cream
    purple_gray = (
        (al > 25)
        & (al < 160)
        & (r > 100)
        & (g < 160)
        & (np.abs(r - b) < 45)
        & (r >= g - 5)
        & ((mx - mn) <= 55)
        & ~cream
    )
    mark = pale | purple_gray
    for y in range(H):
        row = mark[y]
        n = int(row.sum())
        if n < max(14, W // 18):
            continue
        xs = np.where(row)[0]
        if int(xs.max() - xs.min() + 1) < W * 0.28:
            continue
        mean_a = float(al[y, row].mean()) if n else 255
        if mean_a >= 150:
            continue  # opaque character band
        above = int(mark[y - 1].sum()) if y > 0 else 0
        below = int(mark[y + 1].sum()) if y + 1 < H else 0
        if above < n * 0.4 and below < n * 0.4:
            a[y, row, 3] = 0
    for x in range(W):
        col = mark[:, x]
        n = int(col.sum())
        if n < max(14, H // 18):
            continue
        ys = np.where(col)[0]
        if int(ys.max() - ys.min() + 1) < H * 0.28:
            continue
        mean_a = float(al[col, x].mean()) if n else 255
        if mean_a >= 150:
            continue
        left = int(mark[:, x - 1].sum()) if x > 0 else 0
        right = int(mark[:, x + 1].sum()) if x + 1 < W else 0
        if left < n * 0.4 and right < n * 0.4:
            a[col, x, 3] = 0
    return a


# Target standing body height when replacing a run sheet (matches characters.js refH).
RUN_TARGET_CORE_H = 296


def find_blobs(a: np.ndarray, min_area: int = MIN_BLOB) -> list[tuple[int, int, int, int, int]]:
    H, W = a.shape[:2]
    mask = a[:, :, 3] > ALPHA
    seen = np.zeros((H, W), bool)
    out = []
    for y in range(H):
        for x in range(W):
            if not mask[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            cells = [(y, x)]
            while q:
                cy, cx = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
                        cells.append((ny, nx))
            if len(cells) < min_area:
                continue
            ys = [c[0] for c in cells]
            xs = [c[1] for c in cells]
            out.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, len(cells)))
    out.sort(key=lambda b: b[4], reverse=True)
    return out


def assign_grid(
    blobs: list, cols: int, rows: int, W: int, H: int
) -> list[tuple[int, int, int, int] | None]:
    need = cols * rows
    # Only the N largest islands — dust/orb fragments near a cell center
    # must not beat the actual character in that slot.
    cands = blobs[:need]
    if len(cands) < need:
        return [None] * need
    slots = []
    for ri in range(rows):
        for ci in range(cols):
            slots.append(((ci + 0.5) * (W / cols), (ri + 0.5) * (H / rows)))
    used: set[int] = set()
    assigned: list[tuple[int, int, int, int] | None] = []
    for tx, ty in slots:
        best_i, best_d = None, 1e18
        for i, (x0, y0, x1, y1, _area) in enumerate(cands):
            if i in used:
                continue
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            d = (cx - tx) ** 2 + (cy - ty) ** 2
            if d < best_d:
                best_d, best_i = d, i
        if best_i is None:
            assigned.append(None)
            continue
        used.add(best_i)
        x0, y0, x1, y1, _ = cands[best_i]
        assigned.append((x0, y0, x1, y1))
    return assigned


def cell_size_for(crops: list[Image.Image | None], run0: Image.Image) -> tuple[int, int, int]:
    """Pick unified cellW/cellH (may expand past default). Returns (cw, ch, foot_y)."""
    need_w, need_h = DEFAULT_CW, DEFAULT_CH
    for crop in list(crops) + [run0]:
        if crop is None:
            continue
        need_w = max(need_w, crop.width + 2 * MARGIN)
        need_h = max(need_h, crop.height + FOOT_GAP + MARGIN)
    # even sizes play nicer with some decoders
    cw = int(math.ceil(need_w / 2) * 2)
    ch = int(math.ceil(need_h / 2) * 2)
    foot_y = ch - FOOT_GAP
    return cw, ch, foot_y


def heal_hot_edge_to_neighbor(im: Image.Image) -> Image.Image:
    """Recolor magenta fringe to nearest solid pixel instead of punching it out.

    Deleting AA leaves a jagged black outline; leaving it looks like a pink halo.
    """
    a = np.array(im.convert("RGBA"))
    H, W = a.shape[:2]
    r = a[:, :, 0].astype(np.int16)
    g = a[:, :, 1].astype(np.int16)
    b = a[:, :, 2].astype(np.int16)
    al = a[:, :, 3]
    hot = (al > 12) & (r > 170) & (b > 170) & (g < 140) & (np.abs(r - b) < 55)
    pad = np.pad(al <= 20, 1, constant_values=True)
    edge = np.zeros((H, W), bool)
    for dy, dx in (
        (1, 0),
        (-1, 0),
        (0, 1),
        (0, -1),
        (1, 1),
        (1, -1),
        (-1, 1),
        (-1, -1),
    ):
        edge |= pad[1 + dy : H + 1 + dy, 1 + dx : W + 1 + dx]
    ys, xs = np.where(hot & edge)
    n_heal = 0
    n_kill = 0
    for y, x in zip(ys.tolist(), xs.tolist()):
        best = None
        for rad in range(1, 8):
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    if abs(dy) != rad and abs(dx) != rad:
                        continue
                    ny, nx = y + dy, x + dx
                    if not (0 <= ny < H and 0 <= nx < W):
                        continue
                    if hot[ny, nx]:
                        continue
                    if int(al[ny, nx]) < 120:
                        continue
                    best = (int(a[ny, nx, 0]), int(a[ny, nx, 1]), int(a[ny, nx, 2]))
                    break
                if best is not None:
                    break
            if best is not None:
                break
        if best is not None:
            a[y, x, 0], a[y, x, 1], a[y, x, 2] = best
            n_heal += 1
        else:
            a[y, x, 3] = 0
            n_kill += 1
    if n_heal or n_kill:
        print(f"  heal_hot_edge: healed {n_heal} killed {n_kill}")
    return Image.fromarray(a, "RGBA")


def plant_foot(crop: Image.Image, cell_w: int, cell_h: int, foot_y: int) -> Image.Image:
    """Place crop with feet on foot_y. NEVER shrink to fit — caller expands cell."""
    if crop.width + 2 * MARGIN > cell_w or crop.height + FOOT_GAP + MARGIN > cell_h:
        raise ValueError(
            f"crop {crop.size} does not fit cell {cell_w}x{cell_h} "
            f"(expand cell before plant; no fit-shrink)"
        )
    out = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    x = (cell_w - crop.width) // 2
    y = foot_y - crop.height
    if y < MARGIN:
        raise ValueError(f"foot plant y={y} < MARGIN; need taller cell")
    # Copy RGBA as-is. paste(..., mask=crop) composites onto black and
    # premuls the outline AA, leaving a chewed dark fringe vs run0.
    out.paste(crop, (x, y))
    return out


def bump_ver(ver: str) -> None:
    for rel in ["js/config/characters.js", "js/boot-mobile.js", "build-id.txt", "index.html"]:
        p = WWW / rel
        s = p.read_text(encoding="utf-8")
        if rel.endswith("build-id.txt"):
            s = ver + "\n"
        else:
            s = re.sub(r"20260821[a-z]+", ver, s)
        p.write_text(s, encoding="utf-8", newline="\n")


def plant(
    char: str,
    role: str,
    src_name: str,
    cols: int,
    rows: int,
    ver: str,
    *,
    head_lock: bool = False,
) -> int:
    src = resolve_plant_src(src_name)
    # Keep iterations under art-raw/<char>/<role>/; do not re-dump to art-raw root.
    work_dir = raw_action_dir(char, role)
    if src.parent.resolve() != work_dir.resolve():
        staged = work_dir / src.name
        if not staged.exists():
            shutil.copy2(src, staged)
        src = staged

    run_sheet = Image.open(ASSETS / "characters" / char / f"{char}-run-sheet.png").convert("RGBA")
    # game run0 = first cell of run sheet (may be default 512×768)
    run_cw = run_sheet.width // 3
    run_ch = run_sheet.height // 3
    game_run0 = run_sheet.crop((0, 0, run_cw, run_ch))
    # If run cell is not default, still OK — use its pixels as bookend source
    h_game = scale_ruler(np.array(game_run0))
    assert h_game

    raw_im = Image.open(src).convert("RGBA")
    # Mage has no blade islands; fill/punch was chewing robe/hat gaps.
    if char != "mage":
        raw_im = fill_enclosed_magenta(raw_im)
    # 法师：只洪水抠热品红；关 soft/defringe，保留描边 AA（避免啃边锯齿）
    if char == "mage":
        keyed = chroma(raw_im, defringe=False, soft_mag=False)
        keyed = heal_hot_edge_to_neighbor(keyed)
    else:
        keyed = eye_safe_defringe(chroma(raw_im), passes=2)
        keyed = scrub_magenta_residue(keyed)
    keyed = scrub_edge_grid(keyed)  # strip white/gray cut-guides before blob/equal crop
    keyed_path = src.with_name(src.name.replace(".png", "-keyed-blob.png"))
    keyed.save(keyed_path)
    a = np.array(keyed)
    H, W = a.shape[:2]
    blobs = find_blobs(a)
    max_blob = int(W * H * 0.22)
    blobs = [b for b in blobs if b[4] <= max_blob]
    print(f"  blobs={len(blobs)} (top areas={[b[4] for b in blobs[:12]]})")
    boxes = assign_grid(blobs, cols, rows, W, H)
    # Fallback: equal grid if any slot missing or box too large vs sheet.
    # 2×2 fly/atk sheets often have a wide horizontal cruise silhouette;
    # 0.45 of full sheet width is too tight and forces equal-grid (scale break).
    max_bw = W * (0.62 if cols <= 2 else 0.45)
    max_bh = H * (0.62 if rows <= 2 else 0.45)
    areas = [
        (b[2] - b[0]) * (b[3] - b[1]) if b is not None else 0
        for b in boxes
    ]
    finite = [a for a in areas if a > 0]
    med = sorted(finite)[len(finite) // 2] if finite else 0
    tiny = bool(med) and any(a > 0 and a < med * 0.35 for a in areas)
    bad = (
        any(b is None for b in boxes)
        or tiny
        or any(
            b is not None and (b[2] - b[0] > max_bw or b[3] - b[1] > max_bh)
            for b in boxes
        )
    )
    if bad:
        print("  FALLBACK equal-grid crop (blob assign failed)")
        cw_s, ch_s = W // cols, H // rows
        # inset to avoid white/gray grid lines bleeding into cells
        # inset past white/gray cut-guides — prefer exclude lines over deleting whites
        inset = max(14, min(cw_s, ch_s) // 16)
        boxes = []
        for i in range(cols * rows):
            ri, ci = divmod(i, cols)
            x0, y0 = ci * cw_s + inset, ri * ch_s + inset
            x1, y1 = (ci + 1) * cw_s - inset, (ri + 1) * ch_s - inset
            boxes.append((x0, y0, x1, y1))

    crops: list[Image.Image | None] = []
    for i, box in enumerate(boxes):
        if box is None:
            crops.append(None)
            print(f"  slot{i}: MISSING")
            continue
        x0, y0, x1, y1 = box
        # CRITICAL: blob bbox is flush to content (tip often marginT=0).
        # Pad source crop, then AFTER crop_alpha re-add transparent margin —
        # otherwise crop_alpha undoes the pad and tip sits on y=0 again.
        pad = max(28, min(W, H) // 36)
        pad_top = pad + max(12, pad // 2)
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad_top)
        x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
        c = scrub_edge_grid(Image.fromarray(a[y0:y1, x0:x1], "RGBA"))
        c = crop_alpha(c)
        tw, th = c.size
        keep = 20
        keep_top = 28
        padded = Image.new("RGBA", (tw + 2 * keep, th + keep_top + keep), (0, 0, 0, 0))
        padded.paste(c, (keep, keep_top), c)
        c = padded
        crops.append(c)
        ca = np.array(c)
        ys_t, xs_t = np.where(ca[:, :, 3] > ALPHA)
        tip_flush = len(ys_t) > 0 and int(ys_t.min()) <= 1
        print(
            f"  slot{i}: {c.size} ruler={scale_ruler(ca)} upperW={upper_w(ca)} "
            f"coreH={body_core_h(ca)} box=({x0},{y0})-({x1},{y1}) "
            f"tipMargin={int(ys_t.min()) if len(ys_t) else -1}"
            + (" TIP_FLUSH" if tip_flush else "")
        )

    if crops[0] is None:
        raise SystemExit("missing sheet_run0 blob at slot0")
    h_sheet = scale_ruler(np.array(crops[0]))
    assert h_sheet and h_sheet > 12
    self_bookends = role == "run"  # replacing run: plant all cells; do NOT stamp old run0
    if self_bookends:
        # Scale sheet to game standing body height (refH), not leave tiny gen pixels
        h_core = body_core_h(np.array(crops[0])) or h_sheet
        sheet_k = RUN_TARGET_CORE_H / max(h_core, 1)
        h_game = RUN_TARGET_CORE_H
        print(f"  sheet_k={sheet_k:.3f} (role=run → target coreH={RUN_TARGET_CORE_H}, src={h_core})")
    else:
        sheet_k = h_game / h_sheet
        print(f"  sheet_k={sheet_k:.3f} (upperW/ruler vs run0) head_lock={head_lock}")

    n = cols * rows
    scaled_cells: list[Image.Image | None] = [None] * n
    index_iter = range(n) if self_bookends else range(1, n - 1)
    for i in index_iter:
        if crops[i] is None:
            print(f"  WARN empty slot {i}, skip")
            continue
        crop = crops[i]
        # 一个 sheet_k，禁止按格拧 upperW（举剑/挥杖会撑宽尺子，拧完 v3 变小、v456 变大）
        h_src = scale_ruler(np.array(crop))
        h_ref = scale_ruler(np.array(crops[0])) if crops[0] is not None else h_sheet
        if h_src and h_src > 8 and h_ref:
            r_sheet = h_src / h_ref
            if abs(r_sheet - 1.0) > 0.12:
                print(f"  WARN scale vs sheet0 c{i} upperW={r_sheet:.3f} (not per-cell corrected)")
        scaled = scale_k(crop, sheet_k)
        if head_lock and not self_bookends:
            h2 = scale_ruler(np.array(scaled))
            if h2 and h2 > 8:
                ratio = h2 / h_game
                if abs(ratio - 1.0) > 0.02:
                    scaled = scale_k(scaled, h_game / h2)
                    print(f"  RULER-LOCK c{i} was {ratio:.3f}")
        if char == "mage" and not self_bookends:
            scaled = heal_hot_edge_to_neighbor(scaled)
        scaled_cells[i] = scaled

    # Run sheet: hard-lock every cell upperW to planted c0 (visual size == run0)
    if self_bookends and scaled_cells[0] is not None:
        u0 = upper_w(np.array(scaled_cells[0]))
        if u0 and u0 > 8:
            for i in range(n):
                if scaled_cells[i] is None:
                    continue
                ui = upper_w(np.array(scaled_cells[i]))
                if ui and ui > 8 and abs(ui / u0 - 1.0) > 0.02:
                    scaled_cells[i] = scale_k(scaled_cells[i], u0 / ui)
                    print(f"  RUN0-UPPERW-LOCK c{i} was {ui / u0:.3f}")

    ruler = game_run0 if not self_bookends else (scaled_cells[0] or game_run0)
    cell_w, cell_h, foot_y = cell_size_for(scaled_cells, ruler)
    if cell_w != DEFAULT_CW or cell_h != DEFAULT_CH:
        print(f"  EXPAND cell {DEFAULT_CW}x{DEFAULT_CH} -> {cell_w}x{cell_h} foot_y={foot_y}")
    else:
        print(f"  cell {cell_w}x{cell_h} (default) foot_y={foot_y}")

    out = Image.new("RGBA", (cell_w * cols, cell_h * rows), (0, 0, 0, 0))
    if self_bookends:
        print("  SELF-BOOKENDS (role=run): plant all 9 from sheet; no old-run0 stamp")
        for i in range(n):
            if scaled_cells[i] is None:
                continue
            ri, ci = divmod(i, cols)
            planted = plant_foot(scaled_cells[i], cell_w, cell_h, foot_y)
            out.paste(planted, (ci * cell_w, ri * cell_h))
    else:
        for i in range(1, n - 1):
            if scaled_cells[i] is None:
                continue
            ri, ci = divmod(i, cols)
            planted = plant_foot(scaled_cells[i], cell_w, cell_h, foot_y)
            out.paste(planted, (ci * cell_w, ri * cell_h))
        # Bookends: foot-align game run0 into (possibly larger) cell — no stretch
        book = plant_foot(game_run0, cell_w, cell_h, foot_y)
        out.paste(book, (0, 0))
        ri, ci = divmod(n - 1, cols)
        out.paste(book, (ci * cell_w, ri * cell_h))

    dest = ASSETS / "characters" / char / f"{char}-{role}-sheet.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Do not scrub the assembled sheet: bookends are game run0 pixels.
    # Magenta residue is already cleaned on the keyed source.
    out.save(dest)

    fails = 0
    aa = np.array(out)
    # run: audit upperW vs c0 (visual size); other roles: ruler vs game run0
    if self_bookends:
        audit_ref = upper_w(aa[0:cell_h, 0:cell_w])
    else:
        audit_ref = h_game
    for i in range(n):
        ri, ci = divmod(i, cols)
        cell = aa[ri * cell_h : (ri + 1) * cell_h, ci * cell_w : (ci + 1) * cell_w]
        hh = upper_w(cell) if self_bookends else scale_ruler(cell)
        ratio = hh / audit_ref if (hh and audit_ref) else 0
        ok = 0.88 <= ratio <= 1.12
        if not ok:
            fails += 1
        # edge clip warn
        ys, xs = np.where(cell[:, :, 3] > ALPHA)
        edge = []
        if len(xs) and int(xs.min()) <= 1:
            edge.append("L")
        if len(xs) and int(xs.max()) >= cell_w - 2:
            edge.append("R")
        if len(ys) and int(ys.min()) <= 1:
            edge.append("T")
        print(
            f"  audit c{i}: {'OK' if ok else 'FAIL'} ratio={ratio:.3f}"
            f" upperW={upper_w(cell)} coreH={body_core_h(cell)}"
            + (f" EDGE {edge}" if edge else "")
        )
    print("wrote", dest, f"canvas={out.size} cell={cell_w}x{cell_h}", "FAIL", fails)

    bump_ver(ver)
    print("ver", ver)
    return fails


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Blob-plant action sheet; expands cell if needed (no fit-shrink)."
    )
    ap.add_argument("--char", required=True)
    ap.add_argument("--role", required=True)
    ap.add_argument("--src", required=True)
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--ver", required=True)
    ap.add_argument(
        "--head-lock",
        action="store_true",
        help="Force mid-cell coreH to match game run0 after sheet_k",
    )
    args = ap.parse_args()
    raise SystemExit(
        plant(
            args.char,
            args.role,
            args.src,
            args.cols,
            args.rows,
            args.ver,
            head_lock=args.head_lock,
        )
        and 1
        or 0
    )


if __name__ == "__main__":
    main()
