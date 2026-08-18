#!/usr/bin/env python3
"""动作表对齐通用逻辑（跳/攻/滚共用）。

尺子 = 跑步表脚在地上的帧（content 高度中位）。
同表统一 sheet_k；首尾可贴跑步参考格（局内播放可跳过）。
画布默认与跑步同格 512×768。
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from import_jump_roll_sheets import content_box, plant
from asset_layout import RAW, SINGLES, find_asset, find_raw

CW, CH = 512, 768
FOOT = CH - 14
MARGIN = 16

DEV = Path(__file__).resolve().parent
ASSETS = DEV.parent / "www" / "castle-parkour" / "assets"


def resolve_single(cid: str, name: str) -> Path:
    """散帧查找顺序：art-raw/singles → art-raw（递归）→ assets。"""
    fname = f"{cid}-{name}.png"
    direct = SINGLES / fname
    if direct.is_file():
        return direct
    try:
        return find_raw(fname)
    except FileNotFoundError:
        pass
    try:
        return find_asset(fname)
    except FileNotFoundError as e:
        raise FileNotFoundError(fname) from e


def crop_alpha(im: Image.Image) -> Image.Image:
    a = np.array(im.convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] < 36, 0, a[:, :, 3])
    box = content_box(a)
    if not box:
        return Image.new("RGBA", (8, 8), (0, 0, 0, 0))
    return Image.fromarray(a, "RGBA").crop(box)


def scale_uniform(im: Image.Image, k: float) -> Image.Image:
    im = crop_alpha(im)
    if abs(k - 1.0) < 1e-3:
        return im
    nw, nh = max(1, int(im.width * k)), max(1, int(im.height * k))
    return im.resize((nw, nh), Image.Resampling.BICUBIC)


def iter_run_cells(im: Image.Image):
    """遍历跑步表各格（支持 1×N 横条或 4×4 宫格）。"""
    cols = max(1, im.width // CW)
    rows = max(1, im.height // CH)
    for r in range(rows):
        for c in range(cols):
            yield im.crop((c * CW, r * CH, (c + 1) * CW, (r + 1) * CH))


def run_target_height(cid: str) -> int:
    """跑步表各格 content 高度中位数（跳过空格）。"""
    run_path = find_asset(f"{cid}-run-sheet.png")
    im = Image.open(run_path).convert("RGBA")
    hs: list[int] = []
    for cell in iter_run_cells(im):
        box = content_box(np.array(cell))
        if not box:
            continue
        h = box[3] - box[1]
        if h < CH * 0.92:  # 空格常被测成满格
            hs.append(h)
    if not hs:
        raise SystemExit(f"no content in {run_path}")
    hs.sort()
    return int(hs[len(hs) // 2])


def run_ruler_cell(cid: str, idx: int = 3) -> Image.Image:
    """取跑步表一格作尺度参考（不是立绘）。"""
    run_path = find_asset(f"{cid}-run-sheet.png")
    im = Image.open(run_path).convert("RGBA")
    cells = []
    for cell in iter_run_cells(im):
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


def uniform_scale_poses(
    poses0: list[Image.Image],
    *,
    h_run: int,
    anchor_ratio: float,
    anchor_heights: list[int] | None = None,
) -> tuple[list[Image.Image], float]:
    """同表统一缩放。

    anchor_ratio: 锚姿势目标高 / h_run（蹲≈0.72～0.88，站姿攻击≈0.95）。
    anchor_heights: 参与算锚的源图高度；默认用全部姿势平均高。
    """
    if not poses0:
        raise SystemExit("no poses")
    if anchor_heights is None:
        anchor_h = max(1, int(sum(p.height for p in poses0) / len(poses0)))
    else:
        anchor_h = max(1, int(sum(anchor_heights) / max(1, len(anchor_heights))))
    target = max(8, int(h_run * anchor_ratio))
    sheet_k = target / anchor_h
    poses = [scale_uniform(p, sheet_k) for p in poses0]

    max_w = CW - 2 * MARGIN
    widest = max(p.width for p in poses)
    if widest > max_w:
        fit_k = max_w / widest
        print(f"WARN width clamp fit_k={fit_k:.3f} widest={widest}>{max_w}")
        poses = [scale_uniform(p, fit_k) for p in poses]
        sheet_k *= fit_k
    return poses, sheet_k


def plant_poses(poses: list[Image.Image]) -> list[Image.Image]:
    return [plant(p, CW, CH, FOOT, margin=MARGIN) for p in poses]


def lerp_cell(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    """RGBA 像素插值（同尺寸格），作姿态衔接。"""
    t = max(0.0, min(1.0, float(t)))
    aa = np.asarray(a.convert("RGBA"), dtype=np.float32)
    bb = np.asarray(b.convert("RGBA"), dtype=np.float32)
    if aa.shape != bb.shape:
        raise SystemExit(f"lerp size mismatch {aa.shape} vs {bb.shape}")
    out = aa * (1.0 - t) + bb * t
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def pad_with_lerps(poses: list[Image.Image], target: int) -> list[Image.Image]:
    """在相邻姿态间插入 lerp，补到 target；只补不减。"""
    if target < 1:
        raise SystemExit("pad target < 1")
    if not poses:
        raise SystemExit("no poses to pad")
    if len(poses) >= target:
        return list(poses)
    if len(poses) == 1:
        return [poses[0].copy() for _ in range(target)]
    need = target - len(poses)
    gaps = len(poses) - 1
    per_gap = [0] * gaps
    for i in range(need):
        per_gap[i % gaps] += 1
    out: list[Image.Image] = [poses[0]]
    for g in range(gaps):
        a, b = poses[g], poses[g + 1]
        n = per_gap[g]
        for k in range(1, n + 1):
            out.append(lerp_cell(a, b, k / (n + 1)))
        out.append(b)
    assert len(out) == target, f"pad want {target} got {len(out)}"
    return out


def pad_with_holds(poses: list[Image.Image], target: int) -> list[Image.Image]:
    """用已有姿态复用/停顿补到 target；无像素残影。只补不减。"""
    if target < 1:
        raise SystemExit("pad target < 1")
    if not poses:
        raise SystemExit("no poses to pad")
    if len(poses) >= target:
        return list(poses)
    if len(poses) == 1:
        return [poses[0].copy() for _ in range(target)]
    # 优先在「上升/腾空」段加长：中间姿态多停几拍
    out = list(poses)
    # 从靠近中段的姿势开始复制
    mid = max(0, len(poses) // 2)
    i = 0
    while len(out) < target:
        src = out[min(mid + (i % max(1, len(poses) - mid)), len(out) - 1)]
        # 插在 mid 之后，拉长腾空
        insert_at = min(len(out) - 1, mid + 1 + i)
        out.insert(insert_at, src.copy())
        i += 1
    return out[:target]


def expand_jump_up_down(
    ant: Image.Image,
    jump: Image.Image,
    fly: Image.Image,
    land: Image.Image,
) -> list[Image.Image]:
    """跳跃 7 动作帧（真姿态，无残影）：

    起跳：蓄力(ant) → 离地(jump) → 上升(jump)
    腾空：顶点(fly) → 下落(fly)
    落地：着地(land) → 起身衔接(ant，接回跑步尺)
    """
    return [
        ant.copy(),
        jump.copy(),
        jump.copy(),
        fly.copy(),
        fly.copy(),
        land.copy(),
        ant.copy(),
    ]


def nearest_grid_count(n: int) -> int:
    """对齐到 4 / 9 / 16（只升不降）。"""
    for t in (4, 9, 16):
        if n <= t:
            return t
    raise SystemExit(f"frame count {n} > 16; split sheet first")


def write_pose_grid(
    dest: Path,
    planted: list[Image.Image],
    *,
    cols: int = 2,
    rows: int = 2,
    raw_aligned: Path | None = None,
) -> tuple[int, int]:
    """动作帧打成宫格。返回 (cols, rows)。"""
    out = Image.new("RGBA", (CW * cols, CH * rows), (0, 0, 0, 0))
    for i, cell in enumerate(planted):
        if i >= cols * rows:
            break
        row, col = divmod(i, cols)
        out.paste(cell, (col * CW, row * CH))
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)
    if raw_aligned is not None:
        raw_aligned.parent.mkdir(parents=True, exist_ok=True)
        out.save(raw_aligned)
    print(f"wrote {dest} grid={cols}x{rows} frames={min(len(planted), cols * rows)}")
    return cols, rows


def write_pose_grid_bookends(
    dest: Path,
    planted: list[Image.Image],
    ruler: Image.Image,
    *,
    cols: int | None = None,
    rows: int | None = None,
    raw_aligned: Path | None = None,
    pad_to: int | None = None,
    pad_mode: str = "hold",
) -> int:
    """首尾跑步参考 + 动作帧 → 宫格（局内播放跳过首尾）。返回 frameCount。

    pad_to: 对齐到 4/9/16（只补）；pad_mode=hold 复用真帧，lerp 仅特殊需要。
    """
    action = list(planted)
    total_raw = len(action) + 2
    target = pad_to if pad_to is not None else nearest_grid_count(total_raw)
    action_n = target - 2
    if len(action) > action_n:
        raise SystemExit(f"action frames {len(action)} > slot {action_n} (不可减)")
    if len(action) < action_n:
        if pad_mode == "lerp":
            action = pad_with_lerps(action, action_n)
        else:
            action = pad_with_holds(action, action_n)
    seq = [ruler, *action, ruler]
    if cols is None or rows is None:
        side = 3 if target == 9 else (2 if target == 4 else 4)
        cols = rows = side
    write_pose_grid(dest, seq, cols=cols, rows=rows, raw_aligned=raw_aligned)
    print(f"  bookends=run frameCount={len(seq)} grid={cols}x{rows} pad={pad_mode}")
    return len(seq)


def write_bookend_sheet(
    dest: Path,
    planted: list[Image.Image],
    ruler: Image.Image,
    *,
    raw_aligned: Path | None = None,
    cols_meta: Path | None = None,
) -> int:
    """首尾跑步参考 + 动作帧 → sheet。返回列数。"""
    seq = [ruler, *planted, ruler]
    out = Image.new("RGBA", (CW * len(seq), CH), (0, 0, 0, 0))
    for i, cell in enumerate(seq):
        out.paste(cell, (i * CW, 0))
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)
    if raw_aligned is not None:
        raw_aligned.parent.mkdir(parents=True, exist_ok=True)
        out.save(raw_aligned)
    if cols_meta is not None:
        cols_meta.write_text(f"{len(seq)}\n", encoding="utf-8")
    print(f"wrote {dest} cols={len(seq)} (bookends=run)")
    return len(seq)


def save_singles(cid: str, names: tuple[str, ...], planted: list[Image.Image]) -> None:
    """调试散帧写入 art-raw/singles/（局内不加载）。"""
    SINGLES.mkdir(parents=True, exist_ok=True)
    for name, cell in zip(names, planted):
        dest = SINGLES / f"{cid}-{name}.png"
        cell.save(dest)
        box = content_box(np.array(cell))
        wh = f"{(box[2]-box[0]) if box else 0}x{(box[3]-box[1]) if box else 0}"
        print(f"  wrote singles/{dest.name} content={wh}")
