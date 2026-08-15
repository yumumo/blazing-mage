#!/usr/bin/env python3
"""战士跳跃 — 同法师模板：跑步尺 + 同表统一缩放。

战士跳表常有品红细缝把盔/身拆成小岛；content-aware + keep_local 会只留头盔。
这里用 equal-split + morph-close 接回全身，再按跑步 content 高统一缩放。
"""

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
from import_jump_roll_sheets import split_cells_equal_reconnected  # noqa: E402

NAMES = ("jump-ant", "jump", "fly", "jump-land")
CID = "warrior"
ART_SHEETS = Path(__file__).resolve().parent / "art-sheets"


def main() -> None:
    src = RAW / "warrior-jump-sheet.png"
    if not (ASSETS / f"{CID}-run-sheet.png").exists():
        raise SystemExit(f"missing {CID}-run-sheet.png")
    if not src.exists():
        raise SystemExit(f"missing {src} (chroma magenta first)")

    h_run = run_target_height(CID)
    ruler = run_ruler_cell(CID, idx=3)
    print(f"h_run={h_run} (run content median — scale ruler)")

    cells = split_cells_equal_reconnected(src, cols=4, hard_magenta=False, close_rad=4)
    if len(cells) != 4:
        raise SystemExit(f"need 4 jump poses, got {len(cells)}")

    poses0 = [crop_alpha(c) for c in cells]
    print(f"source sizes={[p.size for p in poses0]}")
    poses, sheet_k = uniform_scale_poses(
        poses0,
        h_run=h_run,
        anchor_ratio=0.88,
        anchor_heights=[poses0[0].height, poses0[-1].height],
    )
    print(f"sheet_k={sheet_k:.4f} sizes={[p.size for p in poses]}")

    planted = plant_poses(poses)
    save_singles(CID, NAMES, planted)
    action = expand_jump_up_down(*planted)
    seq = [ruler, *action, ruler]
    write_pose_grid(
        ASSETS / "warrior-jump-sheet.png",
        seq,
        cols=3,
        rows=3,
        raw_aligned=RAW / "warrior-jump-sheet-aligned.png",
    )
    write_bookend_sheet(
        ART_SHEETS / "warrior-jump-sheet.png",
        planted,
        ruler,
        cols_meta=RAW / "warrior-jump-sheet.cols",
    )


if __name__ == "__main__":
    main()
