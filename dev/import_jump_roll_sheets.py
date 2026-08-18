#!/usr/bin/env python3
"""Import refined jump/roll sheets from art-raw into assets + plant.

Crop / cell rules (hard):
1. Strip AI guide rectangles (thin purple/magenta rings) BEFORE content_box
2. Flood near-black / residual magenta from edges
3. Prefer vertical divider peaks over blind equal-split; inset from dividers
4. Plant with margin — never scale so content touches cell edges
5. paste WITHOUT RGBA self-mask (alpha squaring collapses bbox)
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "dev" / "art-raw"
ASSETS = ROOT / "www" / "castle-parkour" / "assets"
ALPHA = 28
# 分隔线内侧留白；过小 → 邻格渗入 / 贴边裁切
DIVIDER_INSET = 10
CELL_MARGIN = 10  # plant 后内容距画布边至少这么多


def content_box(a: np.ndarray, alpha: int = ALPHA):
    ys, xs = np.where(a[:, :, 3] > alpha)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def is_guide_purple(r: np.ndarray, g: np.ndarray, b: np.ndarray, al: np.ndarray) -> np.ndarray:
    """Thin guide stroke: purple/magenta-ish, not solid mage robe fill."""
    return (
        (al > 40)
        & (r > 70)
        & (b > 90)
        & (g < 110)
        & (b + r > g * 2 + 30)
        & (np.abs(r.astype(int) - b) < 90)
    )


def flood_key_bg(arr: np.ndarray) -> np.ndarray:
    """Transparent residual magenta + near-black reachable from borders."""
    a = arr.copy()
    H, W = a.shape[:2]
    r = a[:, :, 0].astype(int)
    g = a[:, :, 1].astype(int)
    b = a[:, :, 2].astype(int)
    al = a[:, :, 3]

    mag = (r > 180) & (b > 180) & (g < 120) & (np.abs(r - b) < 50)
    a[mag, 3] = 0

    dark = (a[:, :, 3] > 0) & (r < 30) & (g < 30) & (b < 30)
    vis = np.zeros((H, W), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(W):
        for y in (0, H - 1):
            if dark[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if dark[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        a[y, x, 3] = 0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and not vis[ny, nx] and dark[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))
    return a


def key_magenta_hard(arr: np.ndarray) -> np.ndarray:
    """Aggressive magenta/pink key for warrior FX dust + fringe.

    Keeps red cape/plume (high R, low B) and gold (high R/G, low B).
    Removes hot-pink dust clouds and magenta AA left by soft chroma.
    """
    a = arr.copy()
    r = a[:, :, 0].astype(int)
    g = a[:, :, 1].astype(int)
    b = a[:, :, 2].astype(int)
    al = a[:, :, 3]
    # Solid + dusty magenta/pink (both R and B elevated, B not tiny)
    mag = (
        (al > 8)
        & (r >= 150)
        & (b >= 135)
        & (g <= 140)
        & (b > g + 18)
        & (r > g + 18)
        & (np.abs(r - b) <= 95)
    )
    a[mag, 3] = 0
    # Soft pink dust FX (~R230 G155 B190) — not cape red, not gold
    dust = (
        (a[:, :, 3] > 8)
        & (r > 195)
        & (g > 100)
        & (g < 200)
        & (b > 140)
        & (r > g + 35)
        & (b > g)
        & (np.abs(r - b) < 90)
    )
    a[dust, 3] = 0
    # Near-magenta fringe mixed into dark edges
    fringe = (
        (a[:, :, 3] > 0)
        & (r >= 120)
        & (b >= 110)
        & (g <= 100)
        & (b > g + 25)
        & (r > g + 25)
        & (np.abs(r - b) <= 70)
        & ((r + b) > 280)
    )
    a[fringe, 3] = 0
    return a


def clear_cell_chrome(arr: np.ndarray) -> np.ndarray:
    """Drop top label band + bottom guide hairline common on AI roll sheets."""
    a = arr.copy()
    H, W = a.shape[:2]
    # top ~10%: mostly labels / dashed guides
    top = max(8, H // 10)
    a[:top, :, 3] = 0
    # bottom 2 rows often have pink baseline
    a[max(0, H - 3) :, :, 3] = 0
    return a


def strip_guide_lines(arr: np.ndarray) -> np.ndarray:
    """Remove thin purple/magenta guide frames without eating mage robe fill.

    Only:
    1) edge-ring flood of guide-purple
    2) high-purity stroke rows/cols (opaque pixels almost all guide-purple)
    """
    a = arr.copy()
    H, W = a.shape[:2]
    r = a[:, :, 0].astype(int)
    g = a[:, :, 1].astype(int)
    b = a[:, :, 2].astype(int)
    al = a[:, :, 3]
    pur = is_guide_purple(r, g, b, al)
    op = al > 40

    # High-purity horizontal strokes (guide top/bottom of AI frame)
    for y in range(H):
        pu = int(pur[y].sum())
        oc = int(op[y].sum())
        if pu < max(30, W // 5) or oc == 0:
            continue
        if pu / oc < 0.88:
            continue
        # neighboring rows should be much less "line-like"
        neigh = 0
        for yy in (y - 2, y - 1, y + 1, y + 2):
            if 0 <= yy < H:
                neigh = max(neigh, int(pur[yy].sum()))
        if neigh > pu * 0.55:
            continue  # thick fill, not a 1px guide
        y0, y1 = max(0, y - 1), min(H, y + 2)
        band = pur[y0:y1]
        a[y0:y1][band, 3] = 0

    # High-purity vertical strokes
    for x in range(W):
        pu = int(pur[:, x].sum())
        oc = int(op[:, x].sum())
        if pu < max(30, H // 6) or oc == 0:
            continue
        if pu / oc < 0.88:
            continue
        neigh = 0
        for xx in (x - 2, x - 1, x + 1, x + 2):
            if 0 <= xx < W:
                neigh = max(neigh, int(pur[:, xx].sum()))
        if neigh > pu * 0.55:
            continue
        x0, x1 = max(0, x - 1), min(W, x + 2)
        band = pur[:, x0:x1]
        a[:, x0:x1][band, 3] = 0

    # Edge-ring guide purple only (no flood into robe interior)
    pur2 = is_guide_purple(
        a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int), a[:, :, 3]
    )
    ring = max(3, min(H, W) // 40)
    edge = np.zeros((H, W), dtype=bool)
    edge[:ring, :] = True
    edge[-ring:, :] = True
    edge[:, :ring] = True
    edge[:, -ring:] = True
    a[pur2 & edge, 3] = 0
    return a


def components(mask: np.ndarray) -> list[dict]:
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    comps: list[dict] = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            q: deque[tuple[int, int]] = deque([(y, x)])
            seen[y, x] = True
            cells = [(y, x)]
            while q:
                cy, cx = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
                        cells.append((ny, nx))
            ys = [p[0] for p in cells]
            xs = [p[1] for p in cells]
            comps.append(
                {
                    "n": len(cells),
                    "y0": min(ys),
                    "y1": max(ys),
                    "x0": min(xs),
                    "x1": max(xs),
                    "cells": cells,
                }
            )
    return comps


def keep_local_parts(arr: np.ndarray, *, pad: int = 48, min_n: int = 60) -> np.ndarray:
    """Keep largest blob + nearby parts (weapon/cape). Drop neighbor-cell bleed."""
    H, W = arr.shape[:2]
    mask = arr[:, :, 3] > ALPHA
    comps = components(mask)
    if not comps:
        return arr
    comps.sort(key=lambda c: c["n"], reverse=True)
    main = comps[0]
    y0, y1 = main["y0"] - pad, main["y1"] + pad
    x0, x1 = main["x0"] - pad, main["x1"] + pad
    edge = max(6, W // 14)
    out = np.zeros_like(arr)
    for c in comps:
        # 贴左右边且相对小的块 = 邻格渗入
        edge_bleed = (c["x1"] <= edge or c["x0"] >= W - edge) and c["n"] < main["n"] * 0.28
        if edge_bleed:
            continue
        near = c["x1"] >= x0 and c["x0"] <= x1 and c["y1"] >= y0 and c["y0"] <= y1
        if c is main or (near and c["n"] >= min_n):
            for y, x in c["cells"]:
                out[y, x] = arr[y, x]
    return out


def prep_cell(im: Image.Image, *, hard_magenta: bool = False) -> Image.Image:
    """Clean one character crop.

    Do NOT call clear_cell_chrome here — that blanks the top ~10% and chops
    warrior helmet plumes after content-aware extract already cropped tight.
    Label/top chrome is cleared on the full sheet inside extract_characters.
    """
    a = np.array(im.convert("RGBA"))
    if hard_magenta:
        a = key_magenta_hard(a)
    a = flood_key_bg(a)
    a = strip_guide_lines(a)
    if hard_magenta:
        a = key_magenta_hard(a)  # second pass after flood
    a[:, :, 3] = np.where(a[:, :, 3] < 36, 0, a[:, :, 3])
    a = keep_local_parts(a)
    return Image.fromarray(a, "RGBA")


def morph_close_mask(mask: np.ndarray, rad: int = 4) -> np.ndarray:
    """Binary close — reconnects armor islands split by thin magenta seams."""
    from PIL import ImageFilter

    if rad < 1:
        return mask
    s = rad * 2 + 1
    im = Image.fromarray((mask.astype(np.uint8) * 255))
    dil = np.array(im.filter(ImageFilter.MaxFilter(s))) > 127
    return np.array(Image.fromarray((dil.astype(np.uint8) * 255)).filter(ImageFilter.MinFilter(s))) > 127


def extract_reconnected(arr: np.ndarray, *, close_rad: int = 4) -> Image.Image:
    """Largest body after morph-close connectivity (keeps original opaque pixels only).

    Warrior jump AI sheets often have magenta 1px seams that shatter the body into
    helmet/shoulder/leg islands; content-aware + keep_local then keeps only the helm.
    """
    a = arr.copy()
    a = flood_key_bg(a)
    a = strip_guide_lines(a)
    a[:, :, 3] = np.where(a[:, :, 3] < 36, 0, a[:, :, 3])
    opaque = a[:, :, 3] > ALPHA
    closed = morph_close_mask(opaque, close_rad)
    comps = components(closed)
    if not comps:
        return Image.fromarray(a, "RGBA")
    best = None
    best_n = -1
    for c in comps:
        n = 0
        for y, x in c["cells"]:
            if opaque[y, x]:
                n += 1
        if n > best_n:
            best_n = n
            best = c
    out = np.zeros_like(a)
    assert best is not None
    for y, x in best["cells"]:
        if opaque[y, x]:
            out[y, x] = a[y, x]
    box = content_box(out)
    if not box:
        return Image.fromarray(out, "RGBA")
    x0, y0, x1, y1 = box
    return Image.fromarray(out[y0:y1, x0:x1], "RGBA")


def split_cells_equal_reconnected(
    path: Path, cols: int, *, hard_magenta: bool = False, close_rad: int = 4
) -> list[Image.Image]:
    """Equal-split + reconnect (prefer when content-aware collapses to helmet)."""
    im = Image.open(path).convert("RGBA")
    raw = np.array(im)
    if hard_magenta:
        raw = key_magenta_hard(raw)
        raw = clear_cell_chrome(raw)
    raw = flood_key_bg(raw)
    W, H = im.size
    cw = W // cols
    cells: list[Image.Image] = []
    for i in range(cols):
        cell = raw[:, i * cw : (i + 1) * cw].copy()
        if hard_magenta:
            cell = key_magenta_hard(cell)
        cells.append(extract_reconnected(cell, close_rad=close_rad))
    print(f"  split: equal+reconnect {cols} cells (rad={close_rad})")
    return cells


def find_divider_xs(arr: np.ndarray, cols: int) -> list[int] | None:
    """Return x cuts [0, d1, d2, ..., W] from dark/purple vertical dividers."""
    H, W = arr.shape[:2]
    if cols < 2:
        return [0, W]
    r = arr[:, :, 0].astype(int)
    g = arr[:, :, 1].astype(int)
    b = arr[:, :, 2].astype(int)
    al = arr[:, :, 3]
    dark = (al > 20) & (r < 45) & (g < 45) & (b < 45)
    pur = is_guide_purple(r, g, b, al)
    score = (dark | pur).mean(axis=0).astype(np.float64)
    # smooth
    k = max(3, W // 200)
    ker = np.ones(k) / k
    score = np.convolve(score, ker, mode="same")

    expected = [int(round(i * W / cols)) for i in range(1, cols)]
    picks: list[int] = []
    used = np.zeros(W, dtype=bool)
    margin = max(8, W // (cols * 6))
    for exp in expected:
        lo, hi = max(margin, exp - margin * 2), min(W - margin, exp + margin * 2)
        if lo >= hi:
            continue
        # avoid already chosen neighborhoods
        band = score.copy()
        band[used] = -1
        x = int(lo + np.argmax(band[lo:hi]))
        if score[x] < 0.08:
            x = exp  # weak peak → fall back to equal
        picks.append(x)
        used[max(0, x - margin) : min(W, x + margin)] = True

    if len(picks) != cols - 1:
        return None
    picks = sorted(picks)
    return [0, *picks, W]


def extract_characters(arr: np.ndarray, n: int, *, hard_magenta: bool = False) -> list[Image.Image]:
    """Content-aware: N largest well-separated blobs, left→right."""
    a = arr.copy()
    if hard_magenta:
        a = key_magenta_hard(a)
        a = clear_cell_chrome(a)
    a = flood_key_bg(a)
    a = strip_guide_lines(a)
    if hard_magenta:
        a = key_magenta_hard(a)
    a[:, :, 3] = np.where(a[:, :, 3] < 36, 0, a[:, :, 3])
    comps = components(a[:, :, 3] > ALPHA)
    if len(comps) < n:
        return []
    ranked = sorted(comps, key=lambda c: c["n"], reverse=True)
    picked: list[dict] = []
    for c in ranked:
        if len(picked) >= n:
            break
        if c["n"] < ranked[0]["n"] * 0.15:
            break
        cx = (c["x0"] + c["x1"]) / 2
        if any(abs(cx - (p["x0"] + p["x1"]) / 2) < max(50, (p["x1"] - p["x0"]) * 0.4) for p in picked):
            continue
        picked.append(c)
    if len(picked) < n:
        return []
    picked.sort(key=lambda c: (c["x0"] + c["x1"]) / 2)

    cells: list[Image.Image] = []
    for main in picked:
        # 先只拷主体像素，再并入近旁较大部件（武器），避免 pad 框吞邻角
        out = np.zeros_like(a)
        for y, x in main["cells"]:
            out[y, x] = a[y, x]
        pad = 36
        y0, y1 = main["y0"] - pad, main["y1"] + pad
        x0, x1 = main["x0"] - pad, main["x1"] + pad
        for c in comps:
            if c is main:
                continue
            if c["n"] < 70:
                continue
            near = c["x1"] >= x0 and c["x0"] <= x1 and c["y1"] >= y0 and c["y0"] <= y1
            # 拒绝越过相邻角色中心的碎片
            cx = (c["x0"] + c["x1"]) / 2
            if any(
                abs(cx - (p["x0"] + p["x1"]) / 2) < abs(cx - (main["x0"] + main["x1"]) / 2) * 0.9
                and p is not main
                for p in picked
            ):
                continue
            if near:
                for y, x in c["cells"]:
                    out[y, x] = a[y, x]
        box = content_box(out)
        if not box:
            continue
        # 再扩 2px 防描边被切
        H, W = out.shape[:2]
        x0, y0, x1, y1 = box
        x0, y0 = max(0, x0 - 2), max(0, y0 - 2)
        x1, y1 = min(W, x1 + 2), min(H, y1 + 2)
        cells.append(Image.fromarray(out[y0:y1, x0:x1], "RGBA"))
    return cells if len(cells) == n else []


def split_cells(path: Path, cols: int | None = None, *, hard_magenta: bool = False) -> list[Image.Image]:
    im = Image.open(path).convert("RGBA")
    raw = np.array(im)
    W, H = im.size
    if cols is None:
        guess = max(3, round(W / 512))
        cols = guess if abs(W / guess - 512) < 80 or W % guess == 0 else 3
        cols = min(15, max(3, cols))

    # Prefer content-aware extraction (fixes equal-split chopping limbs)
    cells = extract_characters(raw, cols, hard_magenta=hard_magenta)
    if len(cells) == cols:
        print(f"  split: content-aware {cols} characters")
        return [prep_cell(c, hard_magenta=hard_magenta) for c in cells]

    print(f"  split: fallback equal/divider ({len(cells)}/{cols})")
    if hard_magenta:
        raw = key_magenta_hard(raw)
        raw = clear_cell_chrome(raw)
    raw = flood_key_bg(raw)
    cuts = find_divider_xs(raw, cols)
    if cuts is None:
        cw = W // cols
        cuts = [i * cw for i in range(cols)] + [W]

    cells = []
    for i in range(len(cuts) - 1):
        x0 = cuts[i] + DIVIDER_INSET
        x1 = cuts[i + 1] - DIVIDER_INSET
        if x1 <= x0 + 8:
            x0, x1 = cuts[i] + 2, cuts[i + 1] - 2
        cell = Image.fromarray(raw, "RGBA").crop((x0, DIVIDER_INSET, x1, H - DIVIDER_INSET))
        cells.append(prep_cell(cell, hard_magenta=hard_magenta))
    return cells


def plant(
    crop: Image.Image,
    canvas_w: int,
    canvas_h: int,
    foot: int,
    *,
    target_h: int | None = None,
    margin: int = CELL_MARGIN,
) -> Image.Image:
    a = np.array(crop.convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] < 36, 0, a[:, :, 3])
    box = content_box(a)
    if not box:
        return Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    crop = Image.fromarray(a, "RGBA").crop(box)
    nw, nh = crop.size
    max_h = max(8, foot - margin - 2)
    max_w = max(8, canvas_w - 2 * margin)
    # 禁止为装格单独缩放：各帧缩得不一样会破坏与跑步的统一尺度。
    # 装不下 → WARN，原尺寸种植（越界部分被画布裁掉），应重生加大留白。
    if nh > max_h or nw > max_w:
        print(
            f"  WARN plant overflow {nw}x{nh} > cell {max_w}x{max_h} "
            f"— not auto-shrinking; regenerate with more padding"
        )
    out = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    out.paste(crop, ((canvas_w - nw) // 2, foot - nh))
    return out


def import_jump(cid: str, ref_h: int) -> None:
    src = RAW / f"{cid}-jump-sheet.png"
    if not src.exists():
        print(f"  skip jump (missing {src.name})")
        return
    # 4 格：蹲起 → 起跳 → 腾空 → 落地；兼容旧 3 格（无 land）
    im0 = Image.open(src)
    guess = max(3, round(im0.size[0] / 512))
    cols = 4 if guess >= 4 else 3
    cells = split_cells(src, cols=cols)
    names = ("jump-ant", "jump", "fly", "jump-land") if cols >= 4 else ("jump-ant", "jump", "fly")
    for cell, name in zip(cells, names):
        out = plant(cell, 512, 512, 509)
        dest = ASSETS / f"{cid}-{name}.png"
        out.save(dest)
        box = content_box(np.array(out))
        print(
            f"  wrote {dest.name} content="
            f"{(box[2]-box[0]) if box else 0}x{(box[3]-box[1]) if box else 0}"
        )


def roll_target_h(ref_h: int, i: int, n: int) -> int:
    if n <= 1:
        return int(ref_h * 0.92)
    t = i / (n - 1)
    if t < 0.25:
        mul = 0.92
    elif t < 0.75:
        mul = 0.84 + 0.04 * abs(0.5 - t)
    else:
        mul = 0.94 + 0.04 * ((t - 0.75) / 0.25)
    return int(ref_h * mul)


MAGE_ROLL_SINGLES = (
    "mage-roll-f1-tuck-keyed.png",
    "mage-roll-f2-dive-keyed.png",
    "mage-roll-f3-ball-keyed.png",
    "mage-roll-f4-unroll-keyed.png",
    "mage-roll-f5-recover-keyed.png",
)


def import_roll_from_singles(paths: list[Path], ref_h: int, dest_name: str) -> None:
    """Build 1xN roll strip from already-keyed single frames (no sheet split)."""
    n = len(paths)
    cw, ch = 512, 1024
    foot = ch - CELL_MARGIN
    out = Image.new("RGBA", (cw * n, ch), (0, 0, 0, 0))
    for i, path in enumerate(paths):
        arr = flood_key_bg(np.array(Image.open(path).convert("RGBA")))
        arr = strip_guide_lines(arr)
        cell = Image.fromarray(arr, "RGBA")
        th = roll_target_h(ref_h, i, n)
        planted = plant(cell, cw, ch, foot, target_h=th, margin=CELL_MARGIN)
        out.paste(planted, (i * cw, 0))
        box = content_box(np.array(planted))
        print(
            f"  roll[{i}/{n}] from {path.name} targetH={th} content="
            f"{(box[2]-box[0]) if box else 0}x{(box[3]-box[1]) if box else 0}"
        )
    dest = ASSETS / dest_name
    out.save(dest)
    print(f"  wrote {dest.name} {out.size} cols={n}")


def import_roll(cid: str, ref_h: int, cols: int | None = None) -> None:
    # 法师：优先用已验证的彩色单帧（art-raw 里旧 sheet 是品红剪影，会毁掉贴图）
    if cid == "mage":
        singles = [RAW / n for n in MAGE_ROLL_SINGLES]
        if all(p.exists() for p in singles):
            print("  using keyed singles (skip silhouette sheet)")
            import_roll_from_singles(singles, ref_h, "mage-roll-sheet.png")
            (RAW / "mage-roll-sheet.cols").write_text("5\n", encoding="utf-8")
            return

    src = RAW / f"{cid}-roll-sheet.png"
    meta = RAW / f"{cid}-roll-sheet.cols"
    if cols is None and meta.exists():
        cols = int(meta.read_text(encoding="utf-8").strip())
    if cols is None:
        im0 = Image.open(src)
        W0, _ = im0.size
        cols = 5 if W0 == 1536 else None
    hard = cid == "warrior"  # 战士 roll 品红尘烟/描边更脏
    cells = split_cells(src, cols=cols, hard_magenta=hard)
    n = len(cells)
    cw, ch = 512, 1024
    foot = ch - CELL_MARGIN
    out = Image.new("RGBA", (cw * n, ch), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        th = roll_target_h(ref_h, i, n)
        planted = plant(cell, cw, ch, foot, target_h=th, margin=CELL_MARGIN)
        out.paste(planted, (i * cw, 0))
        box = content_box(np.array(planted))
        touch = []
        if box:
            x0, y0, x1, y1 = box
            if y0 <= 1:
                touch.append("TOP")
            if y1 >= ch - 2:
                touch.append("BOT")
            if x0 <= 1:
                touch.append("LEFT")
            if x1 >= cw - 2:
                touch.append("RIGHT")
        print(
            f"  roll[{i}/{n}] targetH={th} content="
            f"{(box[2]-box[0]) if box else 0}x{(box[3]-box[1]) if box else 0} "
            f"touch={touch or 'ok'}"
        )
    dest = (ASSETS / "characters" / cid / f"{cid}-roll-sheet.png")
    out.save(dest)
    print(f"  wrote {dest.name} {out.size} cols={n}")


def strip_guides_in_assets_roll(cid: str) -> None:
    """In-place cleanup if re-import not desired — strips guide purple per cell."""
    path = (ASSETS / "characters" / cid / f"{cid}-roll-sheet.png")
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    H, W = a.shape[:2]
    cols = max(3, round(W / 512))
    cw = W // cols
    for i in range(cols):
        cell = a[:, i * cw : (i + 1) * cw]
        cleaned = strip_guide_lines(flood_key_bg(cell))
        a[:, i * cw : (i + 1) * cw] = cleaned
    Image.fromarray(a, "RGBA").save(path)
    print(f"  stripped guides in {path.name}")


def main() -> None:
    # 与 run sheet / manifest.refH 对齐（仅作「过高则压矮」上限，不会上采样）
    ref = {"mage": 296, "warrior": 214}
    for cid in ("mage", "warrior"):
        print(f"# {cid} jump")
        import_jump(cid, ref[cid])
        print(f"# {cid} roll")
        import_roll(cid, ref[cid])


if __name__ == "__main__":
    main()
