#!/usr/bin/env python3
"""节点1：法师跳跃 — 跑步尺 + 同表统一缩放。见 action_sheet_align.py。"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from action_sheet_align import (  # noqa: E402
    ASSETS,
    RAW,
    crop_alpha,
    expand_jump_up_down,
    plant_poses,
    run_ruler_cell,
    run_target_height,
    save_singles,
    uniform_scale_poses,
    write_bookend_sheet,
    write_pose_grid,
)
from import_jump_roll_sheets import split_cells  # noqa: E402

NAMES = ("jump-ant", "jump", "fly", "jump-land")
ART_SHEETS = Path(__file__).resolve().parent / "art-sheets"


def main() -> None:
    cid = "mage"
    src = RAW / "mage-jump-sheet.png"
    if not (ASSETS / f"{cid}-run-sheet.png").exists():
        raise SystemExit(f"missing {cid}-run-sheet.png")
    if not src.exists():
        raise SystemExit(f"missing {src} (chroma magenta first)")

    h_run = run_target_height(cid)
    ruler = run_ruler_cell(cid, idx=3)
    print(f"h_run={h_run}")

    cells = split_cells(src, cols=4)
    if len(cells) != 4:
        raise SystemExit(f"need 4 jump poses, got {len(cells)}")

    poses0 = [crop_alpha(c) for c in cells]
    # 蹲起/落地为锚 ≈ 跑步高 88%
    poses, sheet_k = uniform_scale_poses(
        poses0,
        h_run=h_run,
        anchor_ratio=0.88,
        anchor_heights=[poses0[0].height, poses0[-1].height],
    )
    print(f"sheet_k={sheet_k:.4f} sizes={[p.size for p in poses]}")

    planted = plant_poses(poses)
    save_singles(cid, NAMES, planted)  # 调试散帧；局内真源是宫格
    action = expand_jump_up_down(*planted)
    seq = [ruler, *action, ruler]
    write_pose_grid(
        ASSETS / "mage-jump-sheet.png",
        seq,
        cols=3,
        rows=3,
        raw_aligned=RAW / "mage-jump-sheet-aligned.png",
    )
    write_bookend_sheet(
        ART_SHEETS / "mage-jump-sheet.png",
        planted,
        ruler,
        cols_meta=RAW / "mage-jump-sheet.cols",
    )


if __name__ == "__main__":
    main()
