#!/usr/bin/env python3
"""节点2：法师攻击 — 跑步尺 + 同表统一缩放。见 action_sheet_align.py。"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from action_sheet_align import (  # noqa: E402
    ASSETS,
    RAW,
    crop_alpha,
    plant_poses,
    run_ruler_cell,
    run_target_height,
    save_singles,
    uniform_scale_poses,
    write_bookend_sheet,
    write_pose_grid_bookends,
)
from import_jump_roll_sheets import split_cells  # noqa: E402

SINGLE_NAMES = ("atk-wind", "atk")
ART_SHEETS = Path(__file__).resolve().parent / "art-sheets"


def main() -> None:
    cid = "mage"
    src = RAW / "mage-atk-sheet.png"
    if not (ASSETS / f"{cid}-run-sheet.png").exists():
        raise SystemExit(f"missing {cid}-run-sheet.png")
    if not src.exists():
        raise SystemExit(f"missing {src} (chroma magenta first)")

    h_run = run_target_height(cid)
    ruler = run_ruler_cell(cid, idx=3)
    print(f"h_run={h_run}")

    cells = split_cells(src, cols=3)
    if len(cells) < 2:
        cells = split_cells(src, cols=2)
    if len(cells) < 2:
        raise SystemExit(f"need ≥2 atk poses, got {len(cells)}")

    poses0 = [crop_alpha(c) for c in cells]
    poses, sheet_k = uniform_scale_poses(poses0, h_run=h_run, anchor_ratio=0.95)
    print(f"sheet_k={sheet_k:.4f} n={len(poses)} sizes={[p.size for p in poses]}")

    planted = plant_poses(poses[:2])
    save_singles(cid, SINGLE_NAMES, planted)
    write_pose_grid_bookends(
        ASSETS / "mage-atk-sheet.png",
        planted,
        ruler,
        cols=2,
        rows=2,
        raw_aligned=RAW / "mage-atk-sheet-aligned.png",
    )
    write_bookend_sheet(
        ART_SHEETS / "mage-atk-sheet.png",
        planted,
        ruler,
        cols_meta=RAW / "mage-atk-sheet.cols",
    )


if __name__ == "__main__":
    main()
