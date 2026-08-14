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

CW, CH = 512, 768
FOOT = CH - 14
MARGIN = 16

DEV = Path(__file__).resolve().parent
ASSETS = DEV.parent / "www" / "castle-parkour" / "assets"
RAW = DEV / "art-raw"


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


def run_target_height(cid: str) -> int:
    """跑步表各格 content 高度中位数。"""
    run_path = ASSETS / f"{cid}-run-sheet.png"
    im = Image.open(run_path).convert("RGBA")
    cols = max(1, im.width // CW)
    hs: list[int] = []
    for i in range(cols):
        cell = im.crop((i * CW, 0, (i + 1) * CW, min(CH, im.height)))
        box = content_box(np.array(cell))
        if box:
            hs.append(box[3] - box[1])
    if not hs:
        raise SystemExit(f"no content in {run_path}")
    hs.sort()
    return int(hs[len(hs) // 2])


def run_ruler_cell(cid: str, idx: int = 3) -> Image.Image:
    """取跑步表一格作尺度参考（不是立绘）。"""
    run_path = ASSETS / f"{cid}-run-sheet.png"
    im = Image.open(run_path).convert("RGBA")
    cols = max(1, im.width // CW)
    idx = max(0, min(cols - 1, idx))
    cell = im.crop((idx * CW, 0, (idx + 1) * CW, im.height))
    if cell.height != CH:
        return plant(crop_alpha(cell), CW, CH, FOOT, margin=MARGIN)
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
    for name, cell in zip(names, planted):
        dest = ASSETS / f"{cid}-{name}.png"
        cell.save(dest)
        box = content_box(np.array(cell))
        wh = f"{(box[2]-box[0]) if box else 0}x{(box[3]-box[1]) if box else 0}"
        print(f"  wrote {dest.name} content={wh}")
