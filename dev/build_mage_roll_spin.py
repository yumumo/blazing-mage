#!/usr/bin/env python3
"""Build mage roll: spherical ball, forward roll, face-right, ground-planted, fixed size.

- 表头/表尾放跑步帧作尺度参考（不是立绘）
- 动作帧统一缩放：以 tuck 对齐跑步高度比例，禁止单帧放大
- 球去尾气再转；尾气贴左侧；前滚翻顺时针（PIL 负角）
"""

from __future__ import annotations

from collections import deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_layout import ASSETS, RAW  # noqa: E402
ALPHA = 28
# 与跑步表同格，方便对照立绘尺
CW, CH = 512, 768
FOOT = CH - 14
MARGIN = 16


def content_box(a: np.ndarray):
    ys, xs = np.where(a[:, :, 3] > ALPHA)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def components(mask: np.ndarray):
    H, W = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
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
            ys = [c[0] for c in cells]
            xs = [c[1] for c in cells]
            out.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, len(cells)))
    return out


def extract_mains(path: Path, min_area: int = 5000) -> list[Image.Image]:
    a = np.array(Image.open(path).convert("RGBA"))
    comps = [c for c in components(a[:, :, 3] > ALPHA) if c[4] >= min_area]
    comps.sort(key=lambda c: c[0])
    return [Image.fromarray(a[y0:y1, x0:x1], "RGBA") for x0, y0, x1, y1, _ in comps]


def extract_dust(path: Path) -> Image.Image | None:
    a = np.array(Image.open(path).convert("RGBA"))
    comps = components(a[:, :, 3] > ALPHA)
    cands = []
    for x0, y0, x1, y1, area in comps:
        w, h = x1 - x0, y1 - y0
        if 400 <= area <= 2500 and w > h and y1 > a.shape[0] * 0.55:
            cands.append((x0, y0, x1, y1, area))
    if not cands:
        return None
    cands.sort(key=lambda c: c[4], reverse=True)
    x0, y0, x1, y1, _ = cands[0]
    return Image.fromarray(a[y0:y1, x0:x1], "RGBA")


def crop_alpha(im: Image.Image) -> Image.Image:
    a = np.array(im.convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] < 36, 0, a[:, :, 3])
    box = content_box(a)
    if not box:
        return Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    return Image.fromarray(a, "RGBA").crop(box)


def keep_largest(im: Image.Image) -> Image.Image:
    """只留最大连通域，去掉游离粉尘尾气。"""
    a = np.array(im.convert("RGBA"))
    comps = components(a[:, :, 3] > ALPHA)
    if not comps:
        return im
    comps.sort(key=lambda c: c[4], reverse=True)
    x0, y0, x1, y1, _ = comps[0]
    mask = np.zeros(a.shape[:2], dtype=bool)
    # rebuild largest only via flood from seed inside bbox is heavy; use label
    H, W = a.shape[:2]
    seen = np.zeros((H, W), dtype=bool)
    # find a seed in largest bbox with alpha
    seed = None
    for y in range(y0, y1):
        for x in range(x0, x1):
            if a[y, x, 3] > ALPHA:
                seed = (y, x)
                break
        if seed:
            break
    if not seed:
        return im
    q = deque([seed])
    seen[seed] = True
    while q:
        cy, cx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < H and 0 <= nx < W and not seen[ny, nx] and a[ny, nx, 3] > ALPHA:
                seen[ny, nx] = True
                q.append((ny, nx))
    out = a.copy()
    out[~seen, 3] = 0
    return Image.fromarray(out, "RGBA")


def fill_enclosed_holes(im: Image.Image, max_area: int = 2800) -> Image.Image:
    """填成球内部抠穿（与边不连通的透明岛）。不填开口到画布外的空隙。"""
    a = np.array(im.convert("RGBA"))
    H, W = a.shape[:2]
    empty = a[:, :, 3] < 12
    vis = np.zeros((H, W), dtype=bool)
    q = deque()
    for x in range(W):
        if empty[0, x]:
            vis[0, x] = True
            q.append((0, x))
        if empty[H - 1, x]:
            vis[H - 1, x] = True
            q.append((H - 1, x))
    for y in range(H):
        if empty[y, 0]:
            vis[y, 0] = True
            q.append((y, 0))
        if empty[y, W - 1]:
            vis[y, W - 1] = True
            q.append((y, W - 1))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and empty[ny, nx] and not vis[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))
    interior = empty & ~vis
    if not interior.any():
        return im
    seen = np.zeros((H, W), dtype=bool)
    filled = 0
    for y, x in zip(*np.where(interior & ~seen)):
        if seen[y, x]:
            continue
        q = deque([(y, x)])
        seen[y, x] = True
        cells = [(y, x)]
        border = []
        while q:
            cy, cx = q.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if not (0 <= ny < H and 0 <= nx < W):
                    continue
                if interior[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
                    cells.append((ny, nx))
                elif a[ny, nx, 3] > 40:
                    border.append(a[ny, nx, :3])
        if len(cells) > max_area or not border:
            continue
        col = np.median(np.stack(border), axis=0).astype(np.uint8)
        for cy, cx in cells:
            a[cy, cx, :3] = col
            a[cy, cx, 3] = 255
            filled += 1
    if filled:
        print(f"  fill_enclosed_holes: {filled} px")
    return Image.fromarray(a, "RGBA")


def strip_trail_pixels(im: Image.Image) -> Image.Image:
    """只清外围粉/米色尘；保护白毛领、肤色、眼、袍、杖橙。"""
    a = np.array(im.convert("RGBA"))
    r = a[:, :, 0].astype(int)
    g = a[:, :, 1].astype(int)
    b = a[:, :, 2].astype(int)
    al = a[:, :, 3]
    ys, xs = np.where(al > ALPHA)
    if len(ys) == 0:
        return im
    cy, cx = float(ys.mean()), float(xs.mean())
    H, W = a.shape[:2]
    yy = np.arange(H)[:, None]
    xx = np.arange(W)[None, :]
    # 尾气区：身体左下外围（原稿脸朝左时尘在左下）
    trail_zone = (xx < cx - 8) & (yy > cy - 10)

    pink = (
        (al > 12)
        & (r > 155)
        & (b > 140)
        & (g > 120)
        & (g < 210)
        & (np.abs(r - b) < 55)
        & (g + 30 >= (r + b) // 2)
    )
    beige = (
        (al > 12)
        & (r > 175)
        & (g > 145)
        & (b > 110)
        & (b < 195)
        & (r >= g - 5)
        & (g >= b - 10)
        & ((r + g + b) > 430)
        & ((r + g + b) < 560)  # 太白的是毛领，不杀
    )
    # 白/奶油毛领、高光
    fur = (al > 40) & (r > 185) & (g > 165) & (b > 140) & ((r + g + b) > 520)
    orange = (r > 175) & (g > 85) & (g < 190) & (b < 100)
    gold = (r > 180) & (g > 140) & (b < 110) & (r > b + 40)
    eye = (b > r + 20) & (b > g + 30) & (r < 200) & (al > 40)
    kill = pink | beige
    kill &= trail_zone & ~fur & ~orange & ~gold & ~eye
    if kill.any():
        pad = np.pad(kill, 1, constant_values=False)
        dil = np.zeros_like(kill)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                dil |= pad[1 + dy : H + 1 + dy, 1 + dx : W + 1 + dx]
        a[dil, 3] = 0
    return Image.fromarray(a, "RGBA")


def clean_ball(im: Image.Image) -> Image.Image:
    """成球旋转前：去游离尾气、填内部抠穿；尾气旋转后再 stamp。"""
    # 不再 clip_soft_aura：会啃掉半透明脸边与毛领 AA
    return crop_alpha(fill_enclosed_holes(strip_trail_pixels(keep_largest(im))))


def fit_once(im: Image.Image, target_max: int) -> Image.Image:
    im = crop_alpha(im)
    m = max(im.size)
    if m <= 0:
        return im
    k = target_max / m
    if abs(k - 1.0) < 1e-3:
        return im
    nw, nh = max(1, int(im.width * k)), max(1, int(im.height * k))
    return im.resize((nw, nh), Image.Resampling.BICUBIC)


def plant_ground(crop: Image.Image, *, dx: int = 0) -> Image.Image:
    """内容底边贴 FOOT。"""
    crop = crop_alpha(crop)
    nw, nh = crop.size
    out = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    x = (CW - nw) // 2 + dx
    x = max(4, min(CW - nw - 4, x))
    y = FOOT - nh
    if y < MARGIN:
        y = MARGIN
    out.paste(crop, (x, y))
    return out


def rotate_body(crop: Image.Image, angle: float) -> Image.Image:
    pad = max(crop.size) // 2 + 16
    canvas = Image.new("RGBA", (crop.width + 2 * pad, crop.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(crop, (pad, pad))
    spun = canvas.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        expand=True,
        fillcolor=(0, 0, 0, 0),
    )
    return crop_alpha(spun)


def ball_spin_cell(ball: Image.Image, angle: float, lock: int) -> Image.Image:
    """旋转 → 统一 fit(lock) → 填旋转产生的内部洞 → 贴地。"""
    spun = fit_once(fill_enclosed_holes(rotate_body(ball, angle)), lock)
    return plant_ground(spun)


def stamp_dust(cell: Image.Image, dust: Image.Image | None) -> Image.Image:
    """尾气固定贴地、贴在身左；永不参与旋转/lock。"""
    if dust is None:
        return cell
    a = np.array(cell)
    box = content_box(a)
    if not box:
        return cell
    x0, y0, x1, y1 = box
    dw, dh = dust.size
    px = max(4, x0 - dw - 6)
    # 贴地：底边对齐 FOOT，不跟旋转后的 bbox 上飘
    py = FOOT - dh
    out = cell.copy()
    out.alpha_composite(dust, (px, py))
    return out


def fit_height(im: Image.Image, target_h: int) -> Image.Image:
    im = crop_alpha(im)
    if im.height <= 0:
        return im
    k = target_h / im.height
    nw, nh = max(1, int(im.width * k)), max(1, int(im.height * k))
    return im.resize((nw, nh), Image.Resampling.BICUBIC)


def scale_uniform(im: Image.Image, k: float) -> Image.Image:
    im = crop_alpha(im)
    if abs(k - 1.0) < 1e-3:
        return im
    nw, nh = max(1, int(im.width * k)), max(1, int(im.height * k))
    return im.resize((nw, nh), Image.Resampling.BICUBIC)


def run_target_height(run_path: Path) -> int:
    """跑步表内容高度中位数（支持 1×N / 4×4）。"""
    im = Image.open(run_path).convert("RGBA")
    cols = max(1, im.width // CW)
    rows = max(1, im.height // CH)
    hs = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * CW, r * CH, (c + 1) * CW, (r + 1) * CH))
            box = content_box(np.array(cell))
            if not box:
                continue
            h = box[3] - box[1]
            if h < CH * 0.92:
                hs.append(h)
    if not hs:
        raise SystemExit(f"no content in run sheet {run_path}")
    hs.sort()
    return int(hs[len(hs) // 2])


def run_ruler_cell(run_path: Path, idx: int = 3) -> Image.Image:
    """直接取跑步表一格作尺（不是立绘）；支持宫格。"""
    im = Image.open(run_path).convert("RGBA")
    cols = max(1, im.width // CW)
    rows = max(1, im.height // CH)
    cells = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * CW, r * CH, (c + 1) * CW, (r + 1) * CH))
            box = content_box(np.array(cell))
            if box and (box[3] - box[1]) < CH * 0.92:
                cells.append(cell)
    if not cells:
        raise SystemExit(f"no run frames in {run_path}")
    idx = max(0, min(len(cells) - 1, idx))
    cell = cells[idx]
    if cell.size != (CW, CH):
        out = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        out.paste(cell, (0, 0))
        return out
    return cell


def load_pose(path: Path) -> Image.Image:
    if not path.exists():
        raise SystemExit(f"missing {path}")
    return crop_alpha(Image.open(path).convert("RGBA"))


def lerp_cell(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    """RGBA 像素插值（同尺寸格），作姿态衔接，不改成球 lock。"""
    t = max(0.0, min(1.0, float(t)))
    aa = np.asarray(a.convert("RGBA"), dtype=np.float32)
    bb = np.asarray(b.convert("RGBA"), dtype=np.float32)
    out = aa * (1.0 - t) + bb * t
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def main() -> None:
    run_path = ASSETS / "mage-run-sheet.png"
    dust_src = RAW / "mage-roll-sheet.png"
    ball_src = RAW / "mage-roll-ball.png"
    tuck_src = RAW / "mage-roll-f1-tuck-keyed.png"
    dive_src = RAW / "mage-roll-f2-dive-keyed.png"
    unroll_src = RAW / "mage-roll-f4-unroll-keyed.png"

    for p in (run_path, ball_src, tuck_src, dive_src, unroll_src):
        if not p.exists():
            raise SystemExit(f"missing {p}")

    h_run = run_target_height(run_path)
    # 首尾 = 跑步帧参考（原样取格）
    ruler = run_ruler_cell(run_path, idx=3)
    print(f"h_run={h_run} run_ruler_ok")

    tuck0 = load_pose(tuck_src)
    dive0 = load_pose(dive_src)
    unroll0 = load_pose(unroll_src)
    ball0 = clean_ball(Image.open(ball_src).convert("RGBA"))

    # 统一缩放：以 tuck 为锚，蹲姿约 = 跑步高的 72%（勿把俯扑/起身拉到站立全高）
    crouch_h = max(1, int(h_run * 0.72))
    sheet_k = crouch_h / max(1, tuck0.height)
    tuck = scale_uniform(tuck0, sheet_k)
    dive = scale_uniform(dive0, sheet_k)
    unroll = scale_uniform(unroll0, sheet_k)
    ball = scale_uniform(ball0, sheet_k)
    ball = ball.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

    # 俯扑/起身两帧源图过长：收到接近跑步身宽（参考跑帧）
    compact_max_w = int(h_run * 0.95)
    for name, im in (("dive", dive), ("unroll", unroll)):
        if im.width > compact_max_w:
            ck = compact_max_w / im.width
            print(f"compact {name}: {im.size} → k={ck:.3f}")
            if name == "dive":
                dive = scale_uniform(dive, ck)
            else:
                unroll = scale_uniform(unroll, ck)

    # 若仍超格，整表再同比例收一点（保持统一，不单拧一帧）
    max_w = CW - 2 * MARGIN
    widest = max(tuck.width, dive.width, unroll.width, ball.width)
    if widest > max_w:
        fit_k = max_w / widest
        print(f"WARN width clamp fit_k={fit_k:.3f} widest={widest}>{max_w}")
        tuck = scale_uniform(tuck, fit_k)
        dive = scale_uniform(dive, fit_k)
        unroll = scale_uniform(unroll, fit_k)
        ball = scale_uniform(ball, fit_k)
        sheet_k *= fit_k

    lock = max(ball.size)
    print(f"sheet_k={sheet_k:.4f} tuck={tuck.size} dive={dive.size} ball={ball.size} unroll={unroll.size} lock={lock}")

    dust = extract_dust(dust_src) if dust_src.exists() else None
    if dust is not None:
        dust = fit_once(dust, max(28, lock // 4))

    # 前滚翻顺时针（PIL 负角）。
    # 起转：俯冲后接「头在球底」约 -120°（旧表第 6 帧）。
    # 收转：第 12 格 = -360°（旧第 12 帧）；13–14 = 球→起身像素衔接；15 = 起身。
    # 16 格：run | tuck | dive | spin×9 | lerp×2 | unroll | run；成球 lock 不变。
    spin_start = -120.0
    spin_end = -360.0
    spin_n = 9
    spin_step = (spin_end - spin_start) / (spin_n - 1)  # -30°
    unroll_cell = stamp_dust(plant_ground(unroll), dust)
    action = [
        stamp_dust(plant_ground(tuck), dust),
        stamp_dust(plant_ground(dive), dust),
    ]
    for i in range(spin_n):
        ang = spin_start + i * spin_step
        action.append(stamp_dust(ball_spin_cell(ball, float(ang), lock), dust))
    exit_ball = action[-1]
    action.append(lerp_cell(exit_ball, unroll_cell, 0.34))
    action.append(lerp_cell(exit_ball, unroll_cell, 0.67))
    action.append(unroll_cell)

    seq = [ruler, *action, ruler]
    assert len(seq) == 16, f"want 16 got {len(seq)}"

    n = len(seq)
    for i, cell in enumerate(seq):
        box = content_box(np.array(cell))
        h = (box[3] - box[1]) if box else 0
        foot_gap = (CH - 1 - box[3]) if box else -1
        tag = "runRef" if i in (0, n - 1) else "action"
        print(f"  [{i}] {tag} {(box[2]-box[0]) if box else 0}x{h} footGap={foot_gap}")

    dest = ASSETS / "mage-roll-sheet.png"
    grid = Image.new("RGBA", (CW * 4, CH * 4), (0, 0, 0, 0))
    for i, cell in enumerate(seq):
        row, col = divmod(i, 4)
        grid.paste(cell, (col * CW, row * CH))
    grid.save(dest)
    (RAW / "mage-roll-sheet.cols").write_text(f"{n}\n", encoding="utf-8")
    (RAW / "mage-roll-sheet.grid").write_text("4x4\n", encoding="utf-8")
    grid.save(RAW / "mage-roll-sheet-spun.png")
    print(f"wrote {dest} grid=4x4 frameCount={n} spin={spin_start}→{spin_end}×{spin_n} +lerp×2 lock={lock}")


if __name__ == "__main__":
    main()
