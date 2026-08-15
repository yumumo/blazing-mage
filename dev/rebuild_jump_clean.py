#!/usr/bin/env python3
"""重打跳跃 sheet：真姿态上下衔接，禁止 lerp 残影。

顺序（3×3 / 9 帧）：
  run | ant | jump | jump | fly | fly | land | ant | run

额外：
- 法师：尘土造型参考战士落地尘，重上色为法师紫（落地全尺寸，起跳 ×0.72）
- 战士：清品红幕残留；落地帧已自带尘，只给蓄力/离地贴起跳尘（×0.72）
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from action_sheet_align import (  # noqa: E402
    ASSETS,
    CW,
    CH,
    FOOT,
    SINGLES,
    expand_jump_up_down,
    resolve_single,
    run_ruler_cell,
    write_pose_grid,
)
from build_mage_roll_spin import fit_once  # noqa: F401,E402
from import_jump_roll_sheets import content_box, plant  # noqa: E402

NAMES = ("jump-ant", "jump", "fly", "jump-land")
ALPHA = 28


def strip_magenta_fringe(im: Image.Image) -> Image.Image:
    """去掉品红幕残留与粉边（战士跳常见脚下粉条 / 盔羽粉边）。"""
    a = np.array(im.convert("RGBA"))
    r = a[:, :, 0].astype(np.int16)
    g = a[:, :, 1].astype(np.int16)
    b = a[:, :, 2].astype(np.int16)
    al = a[:, :, 3]
    hot = (al > 8) & (r > 170) & (b > 150) & (g < 150) & ((r + b) > (g * 2 + 40))
    fringe = (
        (al > 8)
        & (r > 150)
        & (b > 130)
        & (g < 190)
        & (np.abs(r - b) < 50)
        & (r > g + 25)
        & (b > g + 15)
    )
    a[hot | fringe, 3] = 0
    a[al < 20, 3] = 0
    return Image.fromarray(a, "RGBA")


def extract_warrior_dust(path: Path) -> Image.Image | None:
    """从战士落地帧抠脚底圆团尘（保留左右团相对位置与原尺寸）。"""
    from collections import deque

    a = np.array(Image.open(path).convert("RGBA"))
    r = a[:, :, 0].astype(np.int16)
    g = a[:, :, 1].astype(np.int16)
    b = a[:, :, 2].astype(np.int16)
    al = a[:, :, 3]
    H, W = a.shape[:2]
    dust = (
        (al > 35)
        & (r > 145)
        & (g > 120)
        & (b < 200)
        & (r > b + 15)
        & (g > b + 5)
        & (np.abs(r - g) < 55)
        & ((r.astype(int) + g) > (2 * b + 30))
    )
    # 只要脚底一带
    dust &= np.arange(H)[:, None] > int(H * 0.82)

    seen = np.zeros((H, W), dtype=bool)
    comps: list[tuple[int, int, int, int, int]] = []
    for y in range(H):
        for x in range(W):
            if not dust[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            cells = [(y, x)]
            while q:
                cy, cx = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and dust[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
                        cells.append((ny, nx))
            ys = [c[0] for c in cells]
            xs = [c[1] for c in cells]
            area = len(cells)
            # 只要团状尘（排除细条噪点）
            if area >= 150 and (max(xs) - min(xs) + 1) >= 18:
                comps.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, area))
    if not comps:
        return None
    comps.sort(key=lambda c: -c[4])
    # 取最大的几团（战士落地通常左右两团 + 中间小团）
    keep = comps[:3]
    x0 = min(c[0] for c in keep)
    y0 = min(c[1] for c in keep)
    x1 = max(c[2] for c in keep)
    y1 = max(c[3] for c in keep)
    out = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
    for cx0, cy0, cx1, cy1, _ in keep:
        patch = a[cy0:cy1, cx0:cx1]
        mask = dust[cy0:cy1, cx0:cx1]
        dest = out[cy0 - y0 : cy1 - y0, cx0 - x0 : cx1 - x0]
        dest[mask] = patch[mask]
    return Image.fromarray(out, "RGBA")


def to_mage_purple_dust(dust: Image.Image) -> Image.Image:
    """战士米色尘 → 法师紫主题（保留明暗作描边层次）。"""
    a = np.array(dust.convert("RGBA"))
    r = a[:, :, 0].astype(np.float32)
    g = a[:, :, 1].astype(np.float32)
    b = a[:, :, 2].astype(np.float32)
    al = a[:, :, 3]
    opaque = al > 30
    if not opaque.any():
        return dust
    lum = 0.35 * r + 0.45 * g + 0.20 * b
    lo = float(lum[opaque].min())
    hi = float(lum[opaque].max())
    t = (lum - lo) / max(1.0, hi - lo)
    dark = np.array([88.0, 42.0, 148.0], dtype=np.float32)
    mid = np.array([150.0, 95.0, 210.0], dtype=np.float32)
    fill = np.array([220.0, 185.0, 250.0], dtype=np.float32)
    rgb = np.where(
        t[:, :, None] < 0.45,
        dark + (mid - dark) * (t[:, :, None] / 0.45),
        mid + (fill - mid) * ((t[:, :, None] - 0.45) / 0.55),
    )
    out = a.copy()
    out[opaque, 0] = np.clip(rgb[:, :, 0][opaque], 0, 255).astype(np.uint8)
    out[opaque, 1] = np.clip(rgb[:, :, 1][opaque], 0, 255).astype(np.uint8)
    out[opaque, 2] = np.clip(rgb[:, :, 2][opaque], 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def stamp_jump_dust(cell: Image.Image, dust: Image.Image | None) -> Image.Image:
    """尘土贴在脚底：居中对齐角色，底边贴 FOOT（与战士落地同尺度）。"""
    if dust is None:
        return cell
    cell = _to_cell(cell)
    a = np.array(cell)
    box = content_box(a)
    if not box:
        return cell
    x0, _y0, x1, y1 = box
    dw, dh = dust.size
    px = int((x0 + x1) / 2 - dw / 2)
    px = max(2, min(CW - dw - 2, px))
    py = FOOT - dh
    py = max(0, min(CH - dh, py))
    out = cell.copy()
    out.alpha_composite(dust, (px, py))
    return out


def load_warrior_dust() -> Image.Image | None:
    """战士落地尘原尺寸（米色，起跳用略缩小）。"""
    src = ASSETS / "warrior-jump-land.png"
    if not src.exists():
        print("  WARN missing warrior-jump-land for dust ref")
        return None
    dust = extract_warrior_dust(src)
    if dust is None:
        print("  WARN extract warrior dust failed")
        return None
    dust = strip_magenta_fringe(dust)
    print(f"  warrior dust size={dust.size}")
    return dust


def load_mage_dust(warrior_dust: Image.Image | None = None) -> Image.Image | None:
    """战士落地尘原尺寸 → 紫色。"""
    base = warrior_dust or load_warrior_dust()
    if base is None:
        return None
    dust = to_mage_purple_dust(base)
    print(f"  mage purple dust (warrior scale) size={dust.size}")
    return dust


def scale_dust(dust: Image.Image, k: float) -> Image.Image:
    if abs(k - 1.0) < 1e-3:
        return dust
    nw = max(8, int(dust.width * k))
    nh = max(8, int(dust.height * k))
    return dust.resize((nw, nh), Image.Resampling.NEAREST)


def _to_cell(im: Image.Image) -> Image.Image:
    if im.size == (CW, CH):
        return im.convert("RGBA")
    return plant(im.convert("RGBA"), CW, CH, FOOT, margin=16)


def rebuild(cid: str, dust: Image.Image | None) -> None:
    poses = []
    for n in NAMES:
        p = resolve_single(cid, n)
        im = Image.open(p).convert("RGBA")
        if cid == "warrior":
            im = strip_magenta_fringe(im)
        poses.append(im)

    ant, jump, fly, land = poses
    SINGLES.mkdir(parents=True, exist_ok=True)
    if dust is not None:
        dust_take = scale_dust(dust, 0.72)
        if cid == "mage":
            # 落地全尺寸紫尘；起跳略小
            ant = stamp_jump_dust(ant, dust_take)
            jump = stamp_jump_dust(jump, dust_take)
            land = stamp_jump_dust(land, dust)
            ant.save(SINGLES / f"{cid}-jump-ant.png")
            jump.save(SINGLES / f"{cid}-jump.png")
            land.save(SINGLES / f"{cid}-jump-land.png")
        else:
            # 战士：落地帧已自带尘，只给蓄力/离地加起跳尘
            ant = stamp_jump_dust(ant, dust_take)
            jump = stamp_jump_dust(jump, dust_take)
            ant.save(SINGLES / f"{cid}-jump-ant.png")
            jump.save(SINGLES / f"{cid}-jump.png")
            land.save(SINGLES / f"{cid}-jump-land.png")  # 仍写回去品红后的落地

    action = expand_jump_up_down(ant, jump, fly, land)
    action = [_to_cell(c) for c in action]
    ruler = run_ruler_cell(cid, idx=3)
    seq = [ruler, *action, ruler]
    assert len(seq) == 9
    dest = ASSETS / f"{cid}-jump-sheet.png"
    write_pose_grid(dest, seq, cols=3, rows=3)
    print(f"{cid}: jump sheet ok (dust={'yes' if dust else 'no'})")


def main() -> None:
    """默认打战士起跳尘。法师需干净底图：传 --mage。"""
    w_dust = load_warrior_dust()
    do_mage = "--mage" in sys.argv
    do_warrior = "--mage" not in sys.argv or "--warrior" in sys.argv
    if do_mage:
        rebuild("mage", load_mage_dust(w_dust))
    if do_warrior:
        rebuild("warrior", w_dust)


if __name__ == "__main__":
    main()
